import { useRef, useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

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

function createBlackVideoTrack(): MediaStreamTrack {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const stream = (canvas as any).captureStream(1) as MediaStream;
    return stream.getVideoTracks()[0];
}

function createSilentAudioTrack(): MediaStreamTrack {
    const ctx = new AudioContext();
    const dst = ctx.createMediaStreamDestination();
    ctx.createOscillator().connect(dst);
    return dst.stream.getAudioTracks()[0];
}

export function useWebRTC({ socket, roomId, userName }: UseWebRTCProps) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<RemotePeer[]>([]);
    const [peerMediaStates, setPeerMediaStates] = useState<Record<string, PeerMediaState>>({});

    const [isMicOn, setIsMicOn] = useState(false);
    const [isCamOn, setIsCamOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // Core WebRTC refs
    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const hasJoined = useRef(false);

    // Negotiation state tracking to prevent offer storms and ICE races
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const makingOffer = useRef<Map<string, boolean>>(new Map());
    const ignoreOffer = useRef<Map<string, boolean>>(new Map());

    /** Emits our hardware availability state to the room */
    const emitMediaState = useCallback((type: 'camera' | 'mic' | 'screen', enabled: boolean) => {
        if (!socket) return;
        socket.emit('media-state-change', { roomId, type, enabled });
    }, [socket, roomId]);

    /** Helper: Safely trigger renegotiation utilizing perfect negotiation pattern */
    const triggerRenegotiation = useCallback(async (pc: RTCPeerConnection, socketId: string) => {
        try {
            console.log(`[WebRTC] Negotiation started for peer: ${socketId}`);
            makingOffer.current.set(socketId, true);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log(`[WebRTC] Offer sent to ${socketId}`);
            socket?.emit('offer', { targetSocketId: socketId, sdp: pc.localDescription });
        } catch (e) {
            console.error('[WebRTC] Renegotiation failed:', e);
        } finally {
            makingOffer.current.set(socketId, false);
        }
    }, [socket]);

    /** Helper: create and register a new RTCPeerConnection */
    const createPeerConnection = useCallback((remotePeer: RemotePeer): RTCPeerConnection => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        // 1. PRE-CREATE TRANSCEIVERS
        // Ensures `replaceTrack` never fails because the underlying WebRTC RTP senders are guaranteed to exist instantly.
        const streams = localStreamRef.current ? [localStreamRef.current] : [];
        pc.addTransceiver('audio', { direction: 'sendrecv', streams });
        pc.addTransceiver('video', { direction: 'sendrecv', streams });

        // 2. ATTACH EXISTING TRACKS
        localStreamRef.current?.getTracks().forEach((track) => {
            const transceiver = pc.getTransceivers().find(t =>
                t.sender.track === null && t.receiver.track.kind === track.kind
            );
            if (transceiver) {
                transceiver.sender.replaceTrack(track);
            } else {
                pc.addTrack(track, localStreamRef.current!);
            }
        });

        // 3. HANDLE INCOMING TRACKS
        pc.ontrack = (event) => {
            setPeers((prev) => prev.map((p) => {
                if (p.socketId === remotePeer.socketId) {
                    const currentStream = p.stream || event.streams[0] || new MediaStream();
                    if (!currentStream.getTracks().includes(event.track)) {
                        currentStream.addTrack(event.track);
                    }
                    return { ...p, stream: currentStream };
                }
                return p;
            }));
        };

        // 4. ICE CANDIDATES
        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                console.log(`[WebRTC] ICE Candidate generated & sent to ${remotePeer.socketId}`);
                socket.emit('ice-candidate', {
                    targetSocketId: remotePeer.socketId,
                    candidate: event.candidate,
                });
            }
        };

        // 5. NEGOTIATION NEEDED
        pc.onnegotiationneeded = () => {
            console.log(`[WebRTC] onnegotiationneeded triggered for ${remotePeer.socketId}`);
            triggerRenegotiation(pc, remotePeer.socketId);
        };

        // 6. DEBUGGING STATE LISTENERS
        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state with ${remotePeer.socketId}: ${pc.connectionState}`);
        };
        pc.onsignalingstatechange = () => {
            console.log(`[WebRTC] Signaling state with ${remotePeer.socketId}: ${pc.signalingState}`);
        };
        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE connection state with ${remotePeer.socketId}: ${pc.iceConnectionState}`);
        };

        peerConnections.current.set(remotePeer.socketId, pc);
        return pc;
    }, [socket, triggerRenegotiation]);

    /** Initiate WebRTC connection to a newly joined peer */
    const callPeer = useCallback(async (remotePeer: RemotePeer) => {
        createPeerConnection(remotePeer);
        // We do NOT manually trigger renegotiation here anymore.
        // Adding tracks in `createPeerConnection` triggers `onnegotiationneeded`, 
        // which will automatically create the offer via `triggerRenegotiation`.
    }, [createPeerConnection]);

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

            // Always ensure the local stream has 1 audio and 1 video track to establish receivers for peers.
            stream.addTrack(userStream && userStream.getAudioTracks().length > 0 ? userStream.getAudioTracks()[0] : createSilentAudioTrack());
            stream.addTrack(userStream && userStream.getVideoTracks().length > 0 ? userStream.getVideoTracks()[0] : createBlackVideoTrack());

            localStreamRef.current = stream;
            setLocalStream(stream);
            socket?.emit('join-room', { roomId, userName });

            // Broadcast initial state
            emitMediaState('camera', isCamOn);
            emitMediaState('mic', isMicOn);
            emitMediaState('screen', false);

        } catch (err) {
            hasJoined.current = false;
            console.error('Failed to setup local stream:', err);
        }
    }, [socket, roomId, userName, isCamOn, isMicOn, emitMediaState]);

    // ── SIGNALING EVENT LISTENERS ─────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        socket.on('room-participants', (participants: (RemotePeer & { mediaState: PeerMediaState })[]) => {
            setPeers(participants);
            // Initialize accurate media states from backend
            const newStates: Record<string, PeerMediaState> = {};
            participants.forEach(p => {
                newStates[p.socketId] = p.mediaState || { camera: false, mic: false, screen: false };
                callPeer(p);
            });
            setPeerMediaStates(prev => ({ ...prev, ...newStates }));
        });

        socket.on('user-joined', (newPeer: RemotePeer) => {
            setPeers((prev) => prev.find((p) => p.socketId === newPeer.socketId) ? prev : [...prev, newPeer]);
            setPeerMediaStates(prev => ({ ...prev, [newPeer.socketId]: { camera: false, mic: false, screen: false } }));
            callPeer(newPeer);
        });

        socket.on('participant-media-state', ({ socketId, type, enabled }: { socketId: string; type: 'camera' | 'mic' | 'screen'; enabled: boolean }) => {
            setPeerMediaStates(prev => ({
                ...prev,
                [socketId]: {
                    ...(prev[socketId] || { camera: false, mic: false, screen: false }),
                    [type]: enabled
                }
            }));
        });

        socket.on('participant-screen-state', ({ socketId, screen, camera }: { socketId: string; screen: boolean; camera: boolean }) => {
            setPeerMediaStates(prev => ({
                ...prev,
                [socketId]: {
                    ...(prev[socketId] || { camera: false, mic: false, screen: false }),
                    screen,
                    camera
                }
            }));
        });

        socket.on('offer', async ({ sdp, fromSocketId }: { sdp: RTCSessionDescriptionInit; fromSocketId: string }) => {
            try {
                let pc = peerConnections.current.get(fromSocketId);
                if (!pc) {
                    const remotePeer: RemotePeer = { socketId: fromSocketId, userId: '', userName: 'Unknown' };
                    pc = createPeerConnection(remotePeer);
                }

                // Perfect Negotiation Handling
                const isPolite = String(socket.id || '') > fromSocketId;
                const isMakingOffer = makingOffer.current.get(fromSocketId) || false;
                const offerCollision = (isMakingOffer || pc.signalingState !== 'stable');

                const shouldIgnoreOffer = !isPolite && offerCollision;
                ignoreOffer.current.set(fromSocketId, shouldIgnoreOffer);
                if (shouldIgnoreOffer) {
                    console.log('Ignored collided offer from', fromSocketId);
                    return;
                }

                // If polite and collision, setRemoteDescription will automatically rollback the local offer.
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', { targetSocketId: fromSocketId, sdp: answer });

                // Flush pending candidates now that remote SDP is correctly set
                const queue = pendingCandidates.current.get(fromSocketId) || [];
                for (const candidate of queue) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
                pendingCandidates.current.delete(fromSocketId);
            } catch (e) {
                console.error('Error handling offer:', e);
            }
        });

        socket.on('answer', async ({ sdp, fromSocketId }: { sdp: RTCSessionDescriptionInit; fromSocketId: string }) => {
            console.log(`[WebRTC] Answer received from ${fromSocketId}`);
            try {
                const pc = peerConnections.current.get(fromSocketId);
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

                    const queue = pendingCandidates.current.get(fromSocketId) || [];
                    for (const candidate of queue) pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
                    pendingCandidates.current.delete(fromSocketId);
                }
            } catch (e) {
                console.error('Error handling answer:', e);
            }
        });

        socket.on('ice-candidate', async ({ candidate, fromSocketId }: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
            console.log(`[WebRTC] ICE Candidate received from ${fromSocketId}`);
            const pc = peerConnections.current.get(fromSocketId);
            const isIgnoringOffer = ignoreOffer.current.get(fromSocketId) || false;
            if (isIgnoringOffer) return;

            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            } else {
                const queue = pendingCandidates.current.get(fromSocketId) || [];
                queue.push(candidate);
                pendingCandidates.current.set(fromSocketId, queue);
            }
        });

        socket.on('user-left', ({ socketId }: { socketId: string }) => {
            peerConnections.current.get(socketId)?.close();
            peerConnections.current.delete(socketId);
            pendingCandidates.current.delete(socketId);
            makingOffer.current.delete(socketId);
            ignoreOffer.current.delete(socketId);
            setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
            setPeerMediaStates((prev) => {
                const updated = { ...prev };
                delete updated[socketId];
                return updated;
            });
        });

        socket.on('force-mute', ({ muted }: { muted: boolean }) => {
            handleMicOff(muted);
        });

        return () => {
            socket.off('room-participants');
            socket.off('user-joined');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('user-left');
            socket.off('force-mute');
            socket.off('participant-media-state');
            socket.off('participant-screen-state');
        };
    }, [socket, callPeer, createPeerConnection]);

    // ── REPLACE A TRACK IN ALL PEER CONNECTIONS ───────────────────────────────
    const replaceTrackInPeers = async (kind: 'video' | 'audio', newTrack: MediaStreamTrack) => {
        const promises = Array.from(peerConnections.current.entries()).map(async ([socketId, pc]) => {
            let sender = pc.getSenders().find((s) => s.track?.kind === kind);
            if (!sender) {
                const transceiver = pc.getTransceivers().find(t => t.receiver.track.kind === kind);
                if (transceiver) sender = transceiver.sender;
            }
            if (sender) {
                console.log(`[WebRTC] Replacing ${kind} track for peer ${socketId}`);
                await sender.replaceTrack(newTrack).catch(e => console.error(`Replace ${kind} track failed:`, e));
            } else {
                pc.addTrack(newTrack, localStreamRef.current!);
            }
            // Trigger renegotiation explicitly just in case browser requires it for the new track
            triggerRenegotiation(pc, socketId);
        });
        await Promise.all(promises);
    };

    // ── MIC CONTROL ──────────────────────────────────────────────────────────
    const handleMicOff = (forceOff?: boolean) => {
        const turnOff = forceOff !== undefined ? forceOff : isMicOn;
        if (turnOff) {
            localStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
            const silentTrack = createSilentAudioTrack();
            replaceTrackInPeers('audio', silentTrack);

            if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                localStreamRef.current.addTrack(silentTrack);
            }
            setIsMicOn(false);
            emitMediaState('mic', false);
        }
    };

    const toggleMic = async () => {
        if (isMicOn) {
            handleMicOff(true);
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

    // ── CAMERA CONTROL ────────────────────────────────────────────────────────
    const toggleCam = async () => {
        if (isCamOn) {
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

    // ── SCREEN SHARE ──────────────────────────────────────────────────────────
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
            let replacementTrack;
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

    // ── LEAVE ROOM ────────────────────────────────────────────────────────────
    const leaveRoom = () => {
        socket?.emit('leave-room');
        peerConnections.current.forEach((pc) => pc.close());
        peerConnections.current.clear();
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
