import { useRef, useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';

// ── ICE SERVER CONFIGURATION ─────────────────────────────────────────────────
// Reads from env so you can use your own TURN server in production.
// Falls back to Google's public STUN servers for local dev.
function buildIceConfig(): RTCConfiguration {
    const servers: RTCIceServer[] = [];

    const stunUrl = import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302';
    servers.push({ urls: stunUrl });

    // Always add a second STUN for redundancy
    servers.push({ urls: 'stun:stun1.l.google.com:19302' });

    // Optional TURN server (required for symmetric NAT / corporate firewalls)
    const turnUrl = import.meta.env.VITE_TURN_URL;
    if (turnUrl) {
        servers.push({
            urls: turnUrl,
            username: import.meta.env.VITE_TURN_USERNAME || '',
            credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
        });
    }

    return { iceServers: servers };
}

const ICE_SERVERS = buildIceConfig();
const SIGNALING_DEBUG = import.meta.env.VITE_DEBUG_SIGNALING === 'true';

function debugLog(message: string, payload?: unknown) {
    if (!SIGNALING_DEBUG) return;
    if (payload !== undefined) {
        console.log(message, payload);
        return;
    }
    console.log(message);
}

// ── TYPE DEFINITIONS ─────────────────────────────────────────────────────────
export interface PeerMediaState {
    camera: boolean;
    mic: boolean;
    screen: boolean;
}

export interface RemotePeer {
    socketId: string;
    userId: string;
    userName: string;
    stream?: MediaStream;
}

interface UseWebRTCProps {
    socket: Socket | null;
    roomId: string;
    userName: string;
}

// ── HELPER: PLACEHOLDER TRACKS ───────────────────────────────────────────────
// We always keep 1 audio + 1 video track in the local stream so that
// pre-created transceivers have something to send from the start.

function createBlackVideoTrack(): MediaStreamTrack {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const stream = canvas.captureStream(1);
    return stream.getVideoTracks()[0];
}

function createSilentAudioTrack(): MediaStreamTrack {
    const ctx = new AudioContext();
    const dst = ctx.createMediaStreamDestination();
    ctx.createOscillator().connect(dst);
    return dst.stream.getAudioTracks()[0];
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════
export function useWebRTC({ socket, roomId, userName }: UseWebRTCProps) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<RemotePeer[]>([]);
    const [peerMediaStates, setPeerMediaStates] = useState<Record<string, PeerMediaState>>({});

    const [isMicOn, setIsMicOn] = useState(false);
    const [isCamOn, setIsCamOn] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // Core WebRTC refs
    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const hasJoined = useRef(false);

    // Negotiation state tracking (perfect negotiation pattern)
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const makingOffer = useRef<Map<string, boolean>>(new Map());
    const ignoreOffer = useRef<Map<string, boolean>>(new Map());
    const handleMicOffRef = useRef<() => void>(() => undefined);

    // ── MEDIA STATE BROADCAST ────────────────────────────────────────────────
    const emitMediaState = useCallback((type: 'camera' | 'mic' | 'screen', enabled: boolean) => {
        if (!socket) return;
        socket.emit('media-state-change', { roomId, type, enabled });
    }, [socket, roomId]);

    // ── RENEGOTIATION (OFFER CREATION) ───────────────────────────────────────
    const flushPendingCandidates = useCallback(async (socketId: string, pc: RTCPeerConnection) => {
        const queue = pendingCandidates.current.get(socketId);
        if (!queue?.length) return;

        for (const candidate of queue) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error(`[WebRTC] Failed to add queued ICE candidate for ${socketId}:`, error);
            }
        }

        pendingCandidates.current.delete(socketId);
    }, []);

    // ── TRIGGER RENEGOTIATION ───────────────────────────────────────────────
    const triggerRenegotiation = useCallback(async (
        pc: RTCPeerConnection,
        socketId: string
    ) => {
        if (!socket) return false;

        const isBusy = (makingOffer.current.get(socketId) ?? false) || pc.signalingState !== 'stable';
        if (isBusy) {
            debugLog(`[WebRTC] Skipping renegotiation for ${socketId}; signalingState=${pc.signalingState}`);
            return false;
        }

        try {
            debugLog(`[WebRTC] Renegotiation started for peer: ${socketId}`);
            makingOffer.current.set(socketId, true);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', { targetSocketId: socketId, sdp: pc.localDescription });
            debugLog(`[WebRTC] Renegotiation offer sent to ${socketId}`);
            return true;
        } catch (e) {
            console.error('[WebRTC] Renegotiation failed:', e);
            return false;
        } finally {
            makingOffer.current.set(socketId, false);
        }
    }, [socket]);

    // Factory for a new RTCPeerConnection wired with event handlers.
    const createPeerConnection = useCallback((remotePeer: RemotePeer): RTCPeerConnection => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        // 1. ATTACH EXISTING LOCAL TRACKS via addTrack
        // We know localStreamRef.current always has 1 audio and 1 video track
        // thanks to our placeholder track generation at join time.
        // This implicitly creates the transceivers and ensures onnegotiationneeded fires appropriately.
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        // 3. HANDLE INCOMING REMOTE TRACKS
        //    We build a single MediaStream per peer and keep adding/replacing
        //    tracks on it. React state update triggers re-render.
        pc.ontrack = (event) => {
            debugLog(`[WebRTC] ontrack from ${remotePeer.socketId}: kind=${event.track.kind}`);
            setPeers((prev) => prev.map((p) => {
                if (p.socketId === remotePeer.socketId) {
                    // Reuse existing stream or start a new one
                    const currentStream = p.stream || new MediaStream();

                    // Remove old track of same kind to replace it cleanly
                    currentStream.getTracks()
                        .filter(t => t.kind === event.track.kind && t.id !== event.track.id)
                        .forEach(t => currentStream.removeTrack(t));

                    if (!currentStream.getTracks().includes(event.track)) {
                        currentStream.addTrack(event.track);
                    }

                    // Return a NEW object reference with a NEW MediaStream wrapper
                    // so React detects the change and <video>.srcObject is re-assigned
                    return { ...p, stream: new MediaStream(currentStream.getTracks()) };
                }
                return p;
            }));
        };

        // 4. ICE CANDIDATE FORWARDING
        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('ice-candidate', {
                    targetSocketId: remotePeer.socketId,
                    candidate: event.candidate,
                });
            }
        };

        // 5. NEGOTIATION NEEDED
        //    Fires when addTransceiver/addTrack changes the SDP.
        //    This is the ONLY place offers are created for the initial handshake.
        pc.onnegotiationneeded = () => {
            debugLog(`[WebRTC] onnegotiationneeded for ${remotePeer.socketId}`);
            void triggerRenegotiation(pc, remotePeer.socketId);
        };

        // 6. ICE CONNECTION STATE — restart on failure
        pc.oniceconnectionstatechange = () => {
            debugLog(`[WebRTC] ICE state ${remotePeer.socketId}: ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === 'failed') {
                console.warn(`[WebRTC] ICE failed for ${remotePeer.socketId}, attempting restart`);
                pc.restartIce();
            }
        };

        // 7. CONNECTION STATE LOGGING
        pc.onconnectionstatechange = () => {
            debugLog(`[WebRTC] Connection state ${remotePeer.socketId}: ${pc.connectionState}`);
            if (pc.connectionState === 'connected' && pc.remoteDescription) {
                void flushPendingCandidates(remotePeer.socketId, pc);
            }
        };
        pc.onsignalingstatechange = () => {
            debugLog(`[WebRTC] Signaling state ${remotePeer.socketId}: ${pc.signalingState}`);
        };

        peerConnections.current.set(remotePeer.socketId, pc);
        return pc;
    }, [flushPendingCandidates, socket, triggerRenegotiation]);



    // ── INITIATE CONNECTION TO A PEER (joiner side only) ─────────────────────
    // Creates a PeerConnection. The addTrack calls inside
    // createPeerConnection will trigger onnegotiationneeded → offer is sent.
    const callPeer = useCallback(async (remotePeer: RemotePeer) => {
        createPeerConnection(remotePeer);
        // onnegotiationneeded fires automatically from addTrack
    }, [createPeerConnection]);

    // ── JOIN ROOM ────────────────────────────────────────────────────────────
    const joinRoom = useCallback(async () => {
        if (hasJoined.current) return;
        hasJoined.current = true;

        try {
            const stream = new MediaStream();
            let userStream: MediaStream | null = null;

            if (isCamOn || isMicOn) {
                try {
                    userStream = await navigator.mediaDevices.getUserMedia({ video: isCamOn, audio: isMicOn });
                } catch (err) {
                    console.warn('Could not get initial user media', err);
                }
            }

            // Always have exactly 1 audio + 1 video track (placeholder if needed)
            stream.addTrack(
                userStream && userStream.getAudioTracks().length > 0
                    ? userStream.getAudioTracks()[0]
                    : createSilentAudioTrack()
            );
            stream.addTrack(
                userStream && userStream.getVideoTracks().length > 0
                    ? userStream.getVideoTracks()[0]
                    : createBlackVideoTrack()
            );

            localStreamRef.current = stream;
            console.log("stream", stream)
            setLocalStream(stream);
            socket?.emit('join-room', {
                roomId,
                userName,
                mediaState: { camera: isCamOn, mic: isMicOn, screen: false },
            });

        } catch (err) {
            hasJoined.current = false;
            console.error('Failed to setup local stream:', err);
        }
    }, [socket, roomId, userName, isCamOn, isMicOn, emitMediaState]);

    // ══════════════════════════════════════════════════════════════════════════
    //  SIGNALING EVENT LISTENERS
    // ══════════════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!socket) return;

        // ── room-state: joiner receives full room state ────────
        // The JOINER calls callPeer() for each existing user → creates offer.
        socket.on('room-state', ({ participants, screenSharerSocketId }: {
            participants: (RemotePeer & { mediaState: PeerMediaState })[];
            screenSharerSocketId?: string;
        }) => {
            debugLog(`[WebRTC] Received room-state: ${participants.length} peers`);
            setPeers(participants);

            const newStates: Record<string, PeerMediaState> = {};
            participants.forEach(p => {
                const state = { ...(p.mediaState || { camera: false, mic: false, screen: false }) };
                // If this is the screen sharer, make sure their state reflects it accurately
                if (p.socketId === screenSharerSocketId) {
                    state.screen = true;
                    state.camera = false;
                }
                newStates[p.socketId] = state;

                // JOINER creates PeerConnection + sends offer to each existing peer
                callPeer(p);
            });
            setPeerMediaStates(prev => ({ ...prev, ...newStates }));
        });

        // ── user-joined: existing peer learns a new user joined ─────────────
        // JOINER initiates call, so existing peer simply waits for offer.
        socket.on('user-joined', (newPeer: RemotePeer & { mediaState: PeerMediaState }) => {
            debugLog(`[WebRTC] user-joined: ${newPeer.userName} (${newPeer.socketId})`);
            setPeers((prev) =>
                prev.find((p) => p.socketId === newPeer.socketId) ? prev : [...prev, newPeer]
            );
            setPeerMediaStates(prev => ({
                ...prev,
                [newPeer.socketId]: newPeer.mediaState || { camera: false, mic: false, screen: false },
            }));

            // ⛔ NO callPeer here — we wait for their offer
        });

        // ── Media state updates ─────────────────────────────────────────────
        socket.on('participant-media-state', ({ socketId, type, enabled }: {
            socketId: string; type: 'camera' | 'mic' | 'screen'; enabled: boolean;
        }) => {
            setPeerMediaStates(prev => ({
                ...prev,
                [socketId]: {
                    ...(prev[socketId] || { camera: false, mic: false, screen: false }),
                    [type]: enabled,
                },
            }));
        });

        socket.on('participant-screen-state', ({ socketId, screen, camera }: {
            socketId: string; screen: boolean; camera: boolean;
        }) => {
            setPeerMediaStates(prev => ({
                ...prev,
                [socketId]: {
                    ...(prev[socketId] || { camera: false, mic: false, screen: false }),
                    screen,
                    camera,
                },
            }));
        });

        // ── offer: received from a peer who wants to connect ────────────────
        socket.on('offer', async ({ sdp, fromSocketId }: {
            sdp: RTCSessionDescriptionInit; fromSocketId: string;
        }) => {
            try {
                debugLog(`[WebRTC] Offer received from ${fromSocketId}`);
                let pc = peerConnections.current.get(fromSocketId);
                if (!pc) {
                    // Existing peer creates PeerConnection only when the joiner's offer arrives
                    const remotePeer: RemotePeer = { socketId: fromSocketId, userId: '', userName: 'Unknown' };
                    // Also ensure the peer is in the peers list (it should be from user-joined)
                    setPeers(prev => {
                        if (prev.find(p => p.socketId === fromSocketId)) return prev;
                        return [...prev, remotePeer];
                    });
                    pc = createPeerConnection(remotePeer);
                }

                // Perfect Negotiation: polite peer is the one with the "greater" socket id
                const isPolite = String(socket.id || '') > fromSocketId;
                const isMakingOffer = makingOffer.current.get(fromSocketId) || false;
                const offerCollision = isMakingOffer || pc.signalingState !== 'stable';
                const shouldIgnoreOffer = !isPolite && offerCollision;

                ignoreOffer.current.set(fromSocketId, shouldIgnoreOffer);
                if (shouldIgnoreOffer) {
                    debugLog(`[WebRTC] Ignored collided offer from ${fromSocketId}`);
                    return;
                }

                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', { targetSocketId: fromSocketId, sdp: answer });

                await flushPendingCandidates(fromSocketId, pc);

            } catch (e) {
                console.error('[WebRTC] Error handling offer:', e);
            }
        });

        // ── answer ──────────────────────────────────────────────────────────
        socket.on('answer', async ({ sdp, fromSocketId }: {
            sdp: RTCSessionDescriptionInit; fromSocketId: string;
        }) => {
            debugLog(`[WebRTC] Answer received from ${fromSocketId}`);
            try {
                const pc = peerConnections.current.get(fromSocketId);
                if (pc) {
                    if (pc.signalingState !== 'have-local-offer') {
                        debugLog(`[WebRTC] Ignoring answer because signalingState is ${pc.signalingState}`);
                        return; // Ignore answers if we didn't send an offer or it was rolled back due to polite collision
                    }
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

                    await flushPendingCandidates(fromSocketId, pc);
                }
            } catch (e) {
                console.error('[WebRTC] Error handling answer:', e);
            }
        });

        // ── ICE candidate ───────────────────────────────────────────────────
        socket.on('ice-candidate', async ({ candidate, fromSocketId }: {
            candidate: RTCIceCandidateInit; fromSocketId: string;
        }) => {
            const pc = peerConnections.current.get(fromSocketId);
            if (ignoreOffer.current.get(fromSocketId)) return;

            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            } else {
                // Queue candidates until remote SDP is set
                const queue = pendingCandidates.current.get(fromSocketId) || [];
                queue.push(candidate);
                pendingCandidates.current.set(fromSocketId, queue);
            }
        });


        // ── user-left ───────────────────────────────────────────────────────
        socket.on('user-left', ({ socketId }: { socketId: string }) => {
            debugLog(`[WebRTC] user-left: ${socketId}`);
            peerConnections.current.get(socketId)?.close();
            peerConnections.current.delete(socketId);
            pendingCandidates.current.delete(socketId);
            makingOffer.current.delete(socketId);
            ignoreOffer.current.delete(socketId);
            ignoreOffer.current.delete(socketId);
            setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
            setPeerMediaStates((prev) => {
                const updated = { ...prev };
                delete updated[socketId];
                return updated;
            });
        });

        // ── force-mute (host control) ───────────────────────────────────────
        socket.on('force-mute', ({ muted }: { muted: boolean }) => {
            if (muted) handleMicOffRef.current();
        });

        return () => {
            socket.off('room-state');
            socket.off('user-joined');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('user-left');
            socket.off('force-mute');
            socket.off('participant-media-state');
            socket.off('participant-screen-state');
        };
    }, [socket, callPeer, createPeerConnection, flushPendingCandidates, triggerRenegotiation]);

    // ── RECONNECTION LOGIC ──────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const handleReconnect = () => {
            debugLog('[WebRTC] Socket reconnected, ensuring room participation');
            if (hasJoined.current) {
                socket.emit('join-room', {
                    roomId,
                    userName,
                    mediaState: { camera: isCamOn, mic: isMicOn, screen: isScreenSharing },
                });
            }
        };

        socket.on('connect', handleReconnect);

        return () => {
            socket.off('connect', handleReconnect);
        };
    }, [socket, roomId, userName, isCamOn, isMicOn, isScreenSharing]);

    // ── REPLACE TRACK IN ALL PEER CONNECTIONS ────────────────────────────────
    // BUG-2 FIX: replaceTrack does NOT require renegotiation. It swaps the
    // underlying media without changing the SDP. We only renegotiate if we
    // had to fall back to addTrack (which DOES change the SDP).
    const replaceTrackInPeers = useCallback(async (kind: 'video' | 'audio', newTrack: MediaStreamTrack) => {
        const promises = Array.from(peerConnections.current.entries()).map(async ([socketId, pc]) => {
            // Find sender by track kind, or by transceiver receiver kind
            let sender = pc.getSenders().find((s) => s.track?.kind === kind);
            if (!sender) {
                const transceiver = pc.getTransceivers().find(t => t.receiver.track.kind === kind);
                if (transceiver) sender = transceiver.sender;
            }

            if (sender) {
                try {
                    debugLog(`[WebRTC] replaceTrack(${kind}) for peer ${socketId}`);
                    await sender.replaceTrack(newTrack);
                    return;
                } catch (error) {
                    console.error(`[WebRTC] replaceTrack(${kind}) failed for ${socketId}:`, error);
                }
            }

            if (!localStreamRef.current) {
                console.warn(`[WebRTC] addTrack(${kind}) skipped for ${socketId} (missing local stream)`);
                return;
            }

            debugLog(`[WebRTC] addTrack(${kind}) fallback for ${socketId}`);
            pc.addTrack(newTrack, localStreamRef.current);
            await triggerRenegotiation(pc, socketId);
        });
        await Promise.all(promises);
    }, [triggerRenegotiation]);

    // ── MIC CONTROL ──────────────────────────────────────────────────────────
    const handleMicOff = useCallback(() => {
        localStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
        const silentTrack = createSilentAudioTrack();
        void replaceTrackInPeers('audio', silentTrack);

        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
            localStreamRef.current.addTrack(silentTrack);
        }
        setIsMicOn(false);
        emitMediaState('mic', false);
    }, [emitMediaState, replaceTrackInPeers]);
    handleMicOffRef.current = handleMicOff;

    const toggleMic = async () => {
        if (isMicOn) {
            handleMicOff();
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const newAudioTrack = stream.getAudioTracks()[0];
                await replaceTrackInPeers('audio', newAudioTrack);

                if (localStreamRef.current) {
                    localStreamRef.current.getAudioTracks().forEach((t) => {
                        t.stop();
                        localStreamRef.current!.removeTrack(t);
                    });
                    localStreamRef.current.addTrack(newAudioTrack);
                }
                setIsMicOn(true);
                emitMediaState('mic', true);
            } catch (err) {
                console.error('Could not restart microphone:', err);
            }
        }
    };

    // ── CAMERA CONTROL ───────────────────────────────────────────────────────
    const toggleCam = async () => {
        if (isCamOn) {
            // Turn OFF: replace with a black canvas track
            localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
            const blackTrack = createBlackVideoTrack();
            await replaceTrackInPeers('video', blackTrack);

            if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                localStreamRef.current.addTrack(blackTrack);
            }
            setIsCamOn(false);
            emitMediaState('camera', false);
        } else {
            // Turn ON: acquire real camera and replaceTrack (no renegotiation)
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newVideoTrack = stream.getVideoTracks()[0];
                await replaceTrackInPeers('video', newVideoTrack);

                if (localStreamRef.current) {
                    localStreamRef.current.getVideoTracks().forEach((t) => {
                        t.stop();
                        localStreamRef.current!.removeTrack(t);
                    });
                    localStreamRef.current.addTrack(newVideoTrack);
                }
                setIsCamOn(true);
                emitMediaState('camera', true);
            } catch (err) {
                console.error('Could not restart camera:', err);
            }
        }
    };

    // ── SCREEN SHARE ─────────────────────────────────────────────────────────
    const startScreenShare = async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const screenTrack = screenStream.getVideoTracks()[0];

            localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
            await replaceTrackInPeers('video', screenTrack);

            if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                localStreamRef.current.addTrack(screenTrack);
            }

            screenTrack.onended = () => stopScreenShare();
            setIsScreenSharing(true);
            socket?.emit('screen-share-start', { roomId });

        } catch (err) {
            console.error('Screen share error:', err);
        }
    };

    const stopScreenShare = async () => {
        try {
            let replacementTrack: MediaStreamTrack;
            if (isCamOn) {
                const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
                replacementTrack = camStream.getVideoTracks()[0];
            } else {
                replacementTrack = createBlackVideoTrack();
            }

            await replaceTrackInPeers('video', replacementTrack);

            if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
                localStreamRef.current.getVideoTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                localStreamRef.current.addTrack(replacementTrack);
            }

            setIsScreenSharing(false);
            socket?.emit('screen-share-stop', { roomId, isCamOn });

        } catch (err) {
            console.error('Restore camera error:', err);
        }
    };

    // ── LEAVE ROOM ───────────────────────────────────────────────────────────
    const leaveRoom = () => {
        socket?.emit('leave-room');
        peerConnections.current.forEach((pc) => pc.close());
        peerConnections.current.clear();
        pendingCandidates.current.clear();
        makingOffer.current.clear();
        ignoreOffer.current.clear();
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setPeers([]);
        setPeerMediaStates({});
        hasJoined.current = false;
    };

    return {
        localStream,
        peers,
        peerMediaStates,
        isMicOn,
        isCamOn,
        isScreenSharing,
        joinRoom,
        leaveRoom,
        toggleMic,
        toggleCam,
        startScreenShare,
        stopScreenShare,
    };
}
