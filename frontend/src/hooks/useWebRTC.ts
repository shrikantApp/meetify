import { useRef, useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';

// ── ICE SERVER CONFIGURATION ─────────────────────────────────────────────────
function buildIceConfig(): RTCConfiguration {
    const useWlanTunnel = import.meta.env.VITE_USE_WLAN_TUNNEL === 'true';
    const stunUrl = import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302';
    const turnUrl = import.meta.env.VITE_TURN_URL;
    const turnUser = import.meta.env.VITE_TURN_USERNAME;
    const turnCred = import.meta.env.VITE_TURN_CREDENTIAL;

    const servers: RTCIceServer[] = [{ urls: stunUrl }];

    if (useWlanTunnel) {
        if (turnUrl) {
            servers.push({
                urls: turnUrl,
                username: turnUser,
                credential: turnCred
            });
        }
    } else {
        servers.push({ urls: 'stun:stun1.l.google.com:19302' });
        if (turnUrl) {
            servers.push({
                urls: turnUrl,
                username: turnUser,
                credential: turnCred
            });
        }
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

// ── HELPER: PLACEHOLDER TRACKS (SINGLETONS) ──────────────────────────────────
const PLACEHOLDER_RESOURCES = {
    audioContext: null as AudioContext | null,
    canvas: null as HTMLCanvasElement | null,
    silentTrack: null as MediaStreamTrack | null,
    blackTrack: null as MediaStreamTrack | null,
};

function getSilentAudioTrack(): MediaStreamTrack {
    if (PLACEHOLDER_RESOURCES.silentTrack && PLACEHOLDER_RESOURCES.silentTrack.readyState === 'live') {
        return PLACEHOLDER_RESOURCES.silentTrack;
    }
    if (!PLACEHOLDER_RESOURCES.audioContext) {
        PLACEHOLDER_RESOURCES.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const dst = PLACEHOLDER_RESOURCES.audioContext.createMediaStreamDestination();
    const track = dst.stream.getAudioTracks()[0];
    PLACEHOLDER_RESOURCES.silentTrack = track;
    return track;
}

function getBlackVideoTrack(): MediaStreamTrack {
    if (PLACEHOLDER_RESOURCES.blackTrack && PLACEHOLDER_RESOURCES.blackTrack.readyState === 'live') {
        return PLACEHOLDER_RESOURCES.blackTrack;
    }
    if (!PLACEHOLDER_RESOURCES.canvas) {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        PLACEHOLDER_RESOURCES.canvas = canvas;
    }
    const stream = (PLACEHOLDER_RESOURCES.canvas as any).captureStream(1);
    const track = stream.getVideoTracks()[0];
    PLACEHOLDER_RESOURCES.blackTrack = track;
    return track;
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

    // Device management
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedAudioId, setSelectedAudioId] = useState<string>('');
    const [selectedVideoId, setSelectedVideoId] = useState<string>('');
    const [isMirrored, setIsMirrored] = useState(true);

    // Core WebRTC refs
    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const hasJoined = useRef(false);

    // Negotiation state tracking (perfect negotiation pattern)
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const makingOffer = useRef<Map<string, boolean>>(new Map());
    const ignoreOffer = useRef<Map<string, boolean>>(new Map());
    const handleMicOffRef = useRef<() => void>(() => undefined);
    const handleCamOffRef = useRef<() => void>(() => undefined);

    const isRealAudio = useRef(false);
    const isRealVideo = useRef(false);

    // ── MEDIA STATE BROADCAST ────────────────────────────────────────────────
    const emitMediaState = useCallback((type: 'camera' | 'mic' | 'screen', enabled: boolean) => {
        if (!socket) return;
        socket.emit('media-state-change', { roomId, type, enabled });
    }, [socket, roomId]);

    // ── RENEGOTIATION (OFFER CREATION) ───────────────────────────────────────
    const flushPendingCandidates = useCallback(async (socketId: string, pc: RTCPeerConnection) => {
        const queue = pendingCandidates.current.get(socketId);
        if (!queue?.length) return;

        if (!pc.remoteDescription?.type) {
            debugLog(`[WebRTC] Postponing flush; still no remoteDescription for ${socketId}`);
            return;
        }

        for (const candidate of queue) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error(`[WebRTC] Failed to add queued ICE candidate for ${socketId}:`, error);
            }
        }

        pendingCandidates.current.delete(socketId);
    }, []);

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

    const createPeerConnection = useCallback((remotePeer: RemotePeer): RTCPeerConnection => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pc.ontrack = (event) => {
            debugLog(`[WebRTC] ontrack from ${remotePeer.socketId}: kind=${event.track.kind}`);
            setPeers((prev) => prev.map((p) => {
                if (p.socketId === remotePeer.socketId) {
                    const currentStream = p.stream || new MediaStream();
                    currentStream.getTracks()
                        .filter(t => t.kind === event.track.kind && t.id !== event.track.id)
                        .forEach(t => currentStream.removeTrack(t));

                    if (!currentStream.getTracks().includes(event.track)) {
                        currentStream.addTrack(event.track);
                    }
                    return { ...p, stream: new MediaStream(currentStream.getTracks()) };
                }
                return p;
            }));
        };

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('ice-candidate', {
                    targetSocketId: remotePeer.socketId,
                    candidate: event.candidate,
                });
            }
        };

        pc.onnegotiationneeded = () => {
            debugLog(`[WebRTC] onnegotiationneeded for ${remotePeer.socketId}`);
            void triggerRenegotiation(pc, remotePeer.socketId);
        };

        pc.oniceconnectionstatechange = () => {
            debugLog(`[WebRTC] ICE state ${remotePeer.socketId}: ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === 'failed') {
                pc.restartIce();
            }
        };

        pc.onconnectionstatechange = () => {
            debugLog(`[WebRTC] Connection state ${remotePeer.socketId}: ${pc.connectionState}`);
            if (pc.connectionState === 'connected' && pc.remoteDescription) {
                void flushPendingCandidates(remotePeer.socketId, pc);
            }
        };

        peerConnections.current.set(remotePeer.socketId, pc);
        return pc;
    }, [flushPendingCandidates, socket, triggerRenegotiation]);

    const callPeer = useCallback(async (remotePeer: RemotePeer) => {
        createPeerConnection(remotePeer);
    }, [createPeerConnection]);

    const joinRoom = useCallback(async (initialMedia?: { camera: boolean; mic: boolean }) => {
        if (hasJoined.current) return;
        hasJoined.current = true;

        try {
            debugLog('[WebRTC] Joining room and acquiring media...');
            const stream = new MediaStream();
            let userStream: MediaStream | null = null;

            const targetMic = initialMedia?.mic ?? isMicOn;
            const targetCam = initialMedia?.camera ?? isCamOn;

            if (targetMic || targetCam) {
                try {
                    userStream = await navigator.mediaDevices.getUserMedia({
                        audio: targetMic,
                        video: targetCam
                    });
                    if (targetMic) {
                        isRealAudio.current = true;
                        setIsMicOn(true);
                    }
                    if (targetCam) {
                        isRealVideo.current = true;
                        setIsCamOn(true);
                    }
                } catch (err) {
                    console.warn('[WebRTC] Pre-join media acquisition failed. Using placeholders.', err);
                }
            }

            const aTrack = (userStream && userStream.getAudioTracks().length > 0)
                ? userStream.getAudioTracks()[0]
                : getSilentAudioTrack();
            const vTrack = (userStream && userStream.getVideoTracks().length > 0)
                ? userStream.getVideoTracks()[0]
                : getBlackVideoTrack();

            aTrack.enabled = true;
            vTrack.enabled = true;

            stream.addTrack(aTrack);
            stream.addTrack(vTrack);

            localStreamRef.current = stream;
            setLocalStream(new MediaStream(stream.getTracks()));

            socket?.emit('join-room', {
                roomId,
                userName,
                mediaState: { camera: targetCam, mic: targetMic, screen: false },
            });

        } catch (err) {
            hasJoined.current = false;
            console.error('[WebRTC] Failed to setup local stream:', err);
        }
    }, [socket, roomId, userName, isCamOn, isMicOn]);

    useEffect(() => {
        if (!socket) return;

        const handleRoomState = ({ participants, screenSharerSocketId }: {
            participants: (RemotePeer & { mediaState: PeerMediaState })[];
            screenSharerSocketId?: string;
        }) => {
            setPeers(participants);
            const newStates: Record<string, PeerMediaState> = {};
            participants.forEach(p => {
                const state = { ...(p.mediaState || { camera: false, mic: false, screen: false }) };
                if (p.socketId === screenSharerSocketId) {
                    state.screen = true;
                    state.camera = false;
                }
                newStates[p.socketId] = state;
                callPeer(p);
            });
            setPeerMediaStates(prev => ({ ...prev, ...newStates }));
        };
        socket.on('room-state', handleRoomState);

        const handleUserJoined = (newPeer: RemotePeer & { mediaState: PeerMediaState }) => {
            setPeers((prev) =>
                prev.find((p) => p.socketId === newPeer.socketId) ? prev : [...prev, newPeer]
            );
            setPeerMediaStates(prev => ({
                ...prev,
                [newPeer.socketId]: newPeer.mediaState || { camera: false, mic: false, screen: false },
            }));
        };
        socket.on('user-joined', handleUserJoined);

        const handleMediaState = ({ socketId, type, enabled }: {
            socketId: string; type: 'camera' | 'mic' | 'screen'; enabled: boolean;
        }) => {
            setPeerMediaStates(prev => ({
                ...prev,
                [socketId]: {
                    ...(prev[socketId] || { camera: false, mic: false, screen: false }),
                    [type]: enabled,
                },
            }));
        };
        socket.on('participant-media-state', handleMediaState);

        const handleScreenState = ({ socketId, screen, camera }: {
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
        };
        socket.on('participant-screen-state', handleScreenState);

        const handleOffer = async ({ sdp, fromSocketId }: {
            sdp: RTCSessionDescriptionInit; fromSocketId: string;
        }) => {
            try {
                let pc = peerConnections.current.get(fromSocketId);
                if (!pc) {
                    const remotePeer: RemotePeer = { socketId: fromSocketId, userId: '', userName: 'Unknown' };
                    pc = createPeerConnection(remotePeer);
                }

                const isPolite = String(socket.id || '') > fromSocketId;
                const isMakingOffer = makingOffer.current.get(fromSocketId) || false;
                const offerCollision = isMakingOffer || pc.signalingState !== 'stable';
                const shouldIgnoreOffer = !isPolite && offerCollision;

                ignoreOffer.current.set(fromSocketId, shouldIgnoreOffer);
                if (shouldIgnoreOffer) return;

                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', { targetSocketId: fromSocketId, sdp: answer });
                await flushPendingCandidates(fromSocketId, pc);
            } catch (e) {
                console.error('[WebRTC] Error handling offer:', e);
            }
        };
        socket.on('offer', handleOffer);

        const handleAnswer = async ({ sdp, fromSocketId }: {
            sdp: RTCSessionDescriptionInit; fromSocketId: string;
        }) => {
            try {
                const pc = peerConnections.current.get(fromSocketId);
                if (pc && pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                    await flushPendingCandidates(fromSocketId, pc);
                }
            } catch (e) {
                console.error('[WebRTC] Error handling answer:', e);
            }
        };
        socket.on('answer', handleAnswer);

        const handleIceCandidate = async ({ candidate, fromSocketId }: {
            candidate: RTCIceCandidateInit; fromSocketId: string;
        }) => {
            const pc = peerConnections.current.get(fromSocketId);
            if (ignoreOffer.current.get(fromSocketId)) return;

            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            } else {
                const queue = pendingCandidates.current.get(fromSocketId) || [];
                queue.push(candidate);
                pendingCandidates.current.set(fromSocketId, queue);
            }
        };
        socket.on('ice-candidate', handleIceCandidate);

        const handleUserLeft = ({ socketId }: { socketId: string }) => {
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
        };
        socket.on('user-left', handleUserLeft);
        
        socket.on('participant-action', ({ action }: { action: 'mute' | 'stop-video' | 'remove' }) => {
            if (action === 'mute') {
                handleMicOffRef.current();
            } else if (action === 'stop-video') {
                handleCamOffRef.current();
            } else if (action === 'remove') {
                window.location.href = '/meeting-ended';
            }
        });

        socket.on('force-mute', () => {
            handleMicOffRef.current();
        });

        socket.on('force-disable-cam', () => {
            handleCamOffRef.current();
        });

        return () => {
            socket.off('room-state');
            socket.off('user-joined');
            socket.off('participant-media-state');
            socket.off('participant-screen-state');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('user-left');
            socket.off('participant-action');
        };
    }, [socket, callPeer, createPeerConnection, flushPendingCandidates, triggerRenegotiation]);

    useEffect(() => {
        if (!socket) return;
        const handleReconnect = () => {
            if (hasJoined.current) {
                socket.emit('join-room', {
                    roomId,
                    userName,
                    mediaState: { camera: isCamOn, mic: isMicOn, screen: isScreenSharing },
                });
            }
        };
        socket.on('connect', handleReconnect);
        return () => { socket.off('connect', handleReconnect); };
    }, [socket, roomId, userName, isCamOn, isMicOn, isScreenSharing]);

    // ── MEDIA TRACK HELPERS ──────────────────────────────────────────────────
    const replaceTrackInPeers = useCallback(async (kind: 'video' | 'audio', newTrack: MediaStreamTrack) => {
        const promises = Array.from(peerConnections.current.entries()).map(async ([socketId, pc]) => {
            let sender = pc.getSenders().find((s) => s.track?.kind === kind);
            if (!sender) {
                const transceiver = pc.getTransceivers().find(t => t.sender.track?.kind === kind);
                if (transceiver) sender = transceiver.sender;
            }
            if (sender) {
                try {
                    await sender.replaceTrack(newTrack);
                    return;
                } catch (error) {
                    console.error(`[WebRTC] replaceTrack(${kind}) failed for ${socketId}:`, error);
                }
            }
            if (!localStreamRef.current) return;
            const oldSender = pc.getSenders().find(s => s.track?.kind === kind);
            if (oldSender) pc.removeTrack(oldSender);
            pc.addTrack(newTrack, localStreamRef.current);
            await triggerRenegotiation(pc, socketId);
        });
        await Promise.all(promises);
    }, [triggerRenegotiation]);

    const updateLocalStreamTracks = useCallback((kind: 'audio' | 'video', newTrack: MediaStreamTrack) => {
        if (!localStreamRef.current) return;
        const oldTracks = kind === 'audio' ? localStreamRef.current.getAudioTracks() : localStreamRef.current.getVideoTracks();
        oldTracks.forEach((t) => {
            t.stop();
            localStreamRef.current!.removeTrack(t);
        });
        localStreamRef.current.addTrack(newTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    }, []);

    const handleMicOff = useCallback(() => {
        if (!localStreamRef.current) return;
        localStreamRef.current.getAudioTracks().forEach((t) => t.stop());
        const silentTrack = getSilentAudioTrack();
        void replaceTrackInPeers('audio', silentTrack);
        updateLocalStreamTracks('audio', silentTrack);
        isRealAudio.current = false;
        setIsMicOn(false);
        emitMediaState('mic', false);
    }, [emitMediaState, replaceTrackInPeers, updateLocalStreamTracks]);

    const handleCamOff = useCallback(() => {
        if (!localStreamRef.current) return;
        localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
        const blackTrack = getBlackVideoTrack();
        void replaceTrackInPeers('video', blackTrack);
        updateLocalStreamTracks('video', blackTrack);
        isRealVideo.current = false;
        setIsCamOn(false);
        emitMediaState('camera', false);
    }, [emitMediaState, replaceTrackInPeers, updateLocalStreamTracks]);

    handleMicOffRef.current = handleMicOff;
    handleCamOffRef.current = handleCamOff;

    const toggleMic = async (forceState?: boolean | any) => {
        const forced = typeof forceState === 'boolean' ? forceState : undefined;
        if (typeof forceState === 'string') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: forceState } } });
                const track = stream.getAudioTracks()[0];
                await replaceTrackInPeers('audio', track);
                updateLocalStreamTracks('audio', track);
                track.enabled = isMicOn;
                isRealAudio.current = true;
                setSelectedAudioId(forceState);
            } catch (err) { console.error('[WebRTC] Mic switch failed', err); }
            return;
        }
        if (localStreamRef.current) {
            const newState = forced !== undefined ? forced : !isMicOn;
            if (!newState) {
                handleMicOff();
            } else if (!isRealAudio.current) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true });
                    const track = stream.getAudioTracks()[0];
                    await replaceTrackInPeers('audio', track);
                    updateLocalStreamTracks('audio', track);
                    isRealAudio.current = true;
                    setIsMicOn(true);
                    emitMediaState('mic', true);
                } catch (err) { console.error('[WebRTC] Mic acquisition failed', err); }
            }
        }
    };

    const toggleCam = async (forceState?: boolean | any) => {
        const forced = typeof forceState === 'boolean' ? forceState : undefined;
        if (typeof forceState === 'string') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: forceState } } });
                const track = stream.getVideoTracks()[0];
                await replaceTrackInPeers('video', track);
                updateLocalStreamTracks('video', track);
                track.enabled = isCamOn;
                isRealVideo.current = true;
                setSelectedVideoId(forceState);
            } catch (err) { console.error('[WebRTC] Cam switch failed', err); }
            return;
        }
        if (localStreamRef.current) {
            const newState = forced !== undefined ? forced : !isCamOn;
            if (!newState) {
                handleCamOff();
            } else if (!isRealVideo.current) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true });
                    const track = stream.getVideoTracks()[0];
                    await replaceTrackInPeers('video', track);
                    updateLocalStreamTracks('video', track);
                    isRealVideo.current = true;
                    setIsCamOn(true);
                    emitMediaState('camera', true);
                } catch (err) { console.error('[WebRTC] Cam acquisition failed', err); }
            }
        }
    };

    const startScreenShare = async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const track = screenStream.getVideoTracks()[0];
            await replaceTrackInPeers('video', track);
            updateLocalStreamTracks('video', track);
            track.onended = () => stopScreenShare();
            setIsScreenSharing(true);
            socket?.emit('screen-share-start', { roomId });
        } catch (err) { console.error('Screen share error:', err); }
    };

    const stopScreenShare = async () => {
        try {
            let track: MediaStreamTrack;
            if (isCamOn) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                track = stream.getVideoTracks()[0];
            } else {
                track = getBlackVideoTrack();
            }
            await replaceTrackInPeers('video', track);
            updateLocalStreamTracks('video', track);
            setIsScreenSharing(false);
            socket?.emit('screen-share-stop', { roomId, isCamOn });
        } catch (err) { console.error('Restore camera error:', err); }
    };

    const leaveRoom = useCallback(() => {
        socket?.emit('leave-room');
        peerConnections.current.forEach(pc => pc.close());
        peerConnections.current.clear();
        pendingCandidates.current.clear();
        makingOffer.current.clear();
        ignoreOffer.current.clear();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setPeers([]);
        setPeerMediaStates({});
        hasJoined.current = false;
    }, [socket]);

    useEffect(() => {
        const handleUnload = () => leaveRoom();
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [leaveRoom]);

    const refreshDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
            setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        } catch (err) { console.error('Error enumerating devices:', err); }
    }, []);

    useEffect(() => {
        refreshDevices();
        navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    }, [refreshDevices]);

    return {
        localStream, peers, peerMediaStates, isMicOn, isCamOn, isScreenSharing,
        audioDevices, videoDevices, selectedAudioId, selectedVideoId, isMirrored,
        setIsMirrored, joinRoom, leaveRoom, toggleMic, toggleCam,
        startScreenShare, stopScreenShare, refreshDevices,
    };
}
