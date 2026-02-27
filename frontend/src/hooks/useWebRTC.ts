import { useRef, useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';

/**
 * ICE Server config – using public Google STUN servers.
 * In production, add TURN servers for better NAT traversal.
 */
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

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

/** Creates a 1-frame-per-second black video track (used when camera is off) */
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

/** Creates a silent audio track (used when mic is off) */
function createSilentAudioTrack(): MediaStreamTrack {
    const ctx = new AudioContext();
    const dst = ctx.createMediaStreamDestination();
    ctx.createOscillator().connect(dst);
    return dst.stream.getAudioTracks()[0];
}

export function useWebRTC({ socket, roomId, userName }: UseWebRTCProps) {
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<RemotePeer[]>([]);
    const [isMicOn, setIsMicOn] = useState(false);
    const [isCamOn, setIsCamOn] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // Map of socketId -> RTCPeerConnection
    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
    // Keep local stream ref for use inside async callbacks
    const localStreamRef = useRef<MediaStream | null>(null);
    // Guard: prevent joinRoom from running more than once per socket
    const hasJoined = useRef(false);

    /** Helper: create and register a new RTCPeerConnection */
    const createPeerConnection = useCallback(
        (remotePeer: RemotePeer): RTCPeerConnection => {
            const pc = new RTCPeerConnection(ICE_SERVERS);

            // Add our local tracks to the peer connection
            localStreamRef.current?.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
            });

            // When remote tracks arrive, attach them to the peer's state
            pc.ontrack = (event) => {
                const [remoteStream] = event.streams;
                setPeers((prev) =>
                    prev.map((p) =>
                        p.socketId === remotePeer.socketId ? { ...p, stream: remoteStream } : p,
                    ),
                );
            };

            // Forward our ICE candidates to the remote peer via signaling server
            pc.onicecandidate = (event) => {
                if (event.candidate && socket) {
                    socket.emit('ice-candidate', {
                        targetSocketId: remotePeer.socketId,
                        candidate: event.candidate,
                    });
                }
            };

            peerConnections.current.set(remotePeer.socketId, pc);
            return pc;
        },
        [socket],
    );

    /** Initiate WebRTC offer to a newly joined peer */
    const callPeer = useCallback(
        async (remotePeer: RemotePeer) => {
            const pc = createPeerConnection(remotePeer);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket?.emit('offer', { targetSocketId: remotePeer.socketId, sdp: offer });
        },
        [createPeerConnection, socket],
    );

    /**
     * Join the room:
     * 1. Get user media (camera + mic)
     * 2. Emit join-room to the signaling server
     * Guard prevents this from running more than once per socket instance.
     */
    const joinRoom = useCallback(async () => {
        if (!isCamOn && !isMicOn) {
            console.warn('Neither camera nor microphone is requested. Cannot get user media.');
            hasJoined.current = false;
            socket?.emit('join-room', { roomId, userName });
            return; // Exit the function or block
        }
        if (hasJoined.current) return; // ← Guard: only join once
        hasJoined.current = true;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: isCamOn, audio: isMicOn });
            localStreamRef.current = stream;
            setLocalStream(stream);
            socket?.emit('join-room', { roomId, userName });
        } catch (err) {
            hasJoined.current = false; // Reset if getUserMedia fails so user can retry
            console.error('Failed to get user media:', err);
        }
    }, [socket, roomId, userName]);

    // ── SIGNALING EVENT LISTENERS ─────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        socket.on('room-participants', (participants: RemotePeer[]) => {
            setPeers(participants);
            participants.forEach((p) => callPeer(p));
        });

        socket.on('user-joined', (newPeer: RemotePeer) => {
            setPeers((prev) => {
                if (prev.find((p) => p.socketId === newPeer.socketId)) return prev;
                return [...prev, newPeer];
            });
        });

        socket.on(
            'offer',
            async ({ sdp, fromSocketId }: { sdp: RTCSessionDescriptionInit; fromSocketId: string }) => {
                const remotePeer: RemotePeer = { socketId: fromSocketId, userId: '', userName: 'Unknown' };
                const pc = createPeerConnection(remotePeer);
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', { targetSocketId: fromSocketId, sdp: answer });
            },
        );

        socket.on(
            'answer',
            async ({ sdp, fromSocketId }: { sdp: RTCSessionDescriptionInit; fromSocketId: string }) => {
                const pc = peerConnections.current.get(fromSocketId);
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            },
        );

        socket.on(
            'ice-candidate',
            async ({ candidate, fromSocketId }: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
                const pc = peerConnections.current.get(fromSocketId);
                if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
            },
        );

        socket.on('user-left', ({ socketId }: { socketId: string }) => {
            peerConnections.current.get(socketId)?.close();
            peerConnections.current.delete(socketId);
            setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
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
        };
    }, [socket, callPeer, createPeerConnection]);

    // ── REPLACE A TRACK IN ALL PEER CONNECTIONS ───────────────────────────────
    const replaceTrackInPeers = (kind: 'video' | 'audio', newTrack: MediaStreamTrack) => {
        peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === kind);
            sender?.replaceTrack(newTrack);
        });
    };

    // ── MIC CONTROL ──────────────────────────────────────────────────────────
    /**
     * Turns mic OFF: stops the real audio track (releases hardware),
     * replaces with a silent track in all peer connections.
     * Turns mic ON: gets a fresh audio track from getUserMedia.
     */
    const handleMicOff = (forceOff?: boolean) => {
        const turnOff = forceOff !== undefined ? forceOff : isMicOn;
        if (turnOff) {
            // Stop real mic track → releases the microphone 
            localStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
            const silentTrack = createSilentAudioTrack();
            replaceTrackInPeers('audio', silentTrack);
            if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                localStreamRef.current.addTrack(silentTrack);
            }
            setIsMicOn(false);
        }
    };

    const toggleMic = async () => {
        if (isMicOn) {
            // Turn OFF: stop track, replace with silent
            localStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
            const silentTrack = createSilentAudioTrack();
            replaceTrackInPeers('audio', silentTrack);
            if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                localStreamRef.current.addTrack(silentTrack);
            }
            setIsMicOn(false);
        } else {
            // Turn ON: get a real audio track again
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const newAudioTrack = stream.getAudioTracks()[0];
                replaceTrackInPeers('audio', newAudioTrack);
                if (localStreamRef.current) {
                    localStreamRef.current.getAudioTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                    localStreamRef.current.addTrack(newAudioTrack);
                    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                }
                setIsMicOn(true);
            } catch (err) {
                console.error('Could not restart microphone:', err);
            }
        }
    };

    // ── CAMERA CONTROL ────────────────────────────────────────────────────────
    /**
     * Turns camera OFF: stops the real video track (releases hardware + turns off LED),
     * replaces with a black video track so peers see a black tile.
     * Turns camera ON: gets a fresh video track from getUserMedia.
     */
    const toggleCam = async () => {
        if (isCamOn) {
            // Turn OFF: stop track → camera LED turns off
            localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
            const blackTrack = createBlackVideoTrack();
            replaceTrackInPeers('video', blackTrack);
            if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                localStreamRef.current.addTrack(blackTrack);
                setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            }
            setIsCamOn(false);
        } else {
            // Turn ON: get a new real camera track
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newVideoTrack = stream.getVideoTracks()[0];
                replaceTrackInPeers('video', newVideoTrack);
                if (localStreamRef.current) {
                    localStreamRef.current.getVideoTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                    localStreamRef.current.addTrack(newVideoTrack);
                    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                }
                setIsCamOn(true);
            } catch (err) {
                console.error('Could not restart camera:', err);
            }
        }
    };

    // ── SCREEN SHARE ──────────────────────────────────────────────────────────
    const startScreenShare = async () => {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];

            // Stop real camera first so LED turns off
            localStreamRef.current?.getVideoTracks().forEach((t) => t.stop());
            replaceTrackInPeers('video', screenTrack);

            if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                localStreamRef.current.addTrack(screenTrack);
                setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            }

            // When user clicks "Stop sharing" in browser UI
            screenTrack.onended = () => stopScreenShare();
            setIsScreenSharing(true);
        } catch (err) {
            console.error('Screen share error:', err);
        }
    };

    const stopScreenShare = async () => {
        try {
            const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const camTrack = camStream.getVideoTracks()[0];

            replaceTrackInPeers('video', camTrack);

            if (localStreamRef.current) {
                localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
                localStreamRef.current.getVideoTracks().forEach((t) => localStreamRef.current!.removeTrack(t));
                localStreamRef.current.addTrack(camTrack);
                setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            }

            setIsScreenSharing(false);
            setIsCamOn(true);
        } catch (err) {
            console.error('Restore camera error:', err);
        }
    };

    // ── LEAVE ROOM ────────────────────────────────────────────────────────────
    const leaveRoom = () => {
        socket?.emit('leave-room');
        peerConnections.current.forEach((pc) => pc.close());
        peerConnections.current.clear();
        // Stop ALL tracks to fully release camera and mic hardware
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setPeers([]);
        hasJoined.current = false;
    };

    return {
        localStream,
        peers,
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
