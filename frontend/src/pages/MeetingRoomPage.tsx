import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { useLobby } from '../hooks/useLobby';
import { api } from '../services/api';
import WaitingRoomView from '../components/WaitingRoomView';
import HostLobbyPanel from '../components/HostLobbyPanel';
import JoinRequestToast from '../components/JoinRequestToast';
import HostControlsPanel from '../components/HostControlsPanel';
import {
    Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Copy, Check,
    Users, MessageSquare, DoorOpen, Hand,
} from 'lucide-react';

interface ChatMessage {
    message: string;
    userName: string;
    timestamp: string;
}

interface MeetingInfo {
    id: string;
    meetingCode: string;
    title: string;
    lobbyEnabled: boolean;
    host: { id: string; name: string };
}

/**
 * MeetingRoomPage
 * ───────────────
 * Orchestrates the full meeting flow:
 * 1. Fetches meeting info (lobby status, host identity) via REST
 * 2. If lobby enabled + not host → shows WaitingRoomView
 * 3. After admission (or if no lobby / is host) → renders video room
 * 4. Host sees HostLobbyPanel + JoinRequestToast + HostControlsPanel
 * 5. Handles page refresh confirmation via beforeunload
 */
export default function MeetingRoomPage() {
    const { meetingCode } = useParams<{ meetingCode: string }>();
    const { user, token } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();

    // ── Meeting Info ─────────────────────────────────────────────────────
    const [meeting, setMeeting] = useState<MeetingInfo | null>(null);
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [infoError, setInfoError] = useState('');

    useEffect(() => {
        if (!meetingCode || !token) return;
        setLoadingInfo(true);
        api.meetings
            .get(meetingCode)
            .then((data: MeetingInfo) => {
                setMeeting(data);
                setInfoError('');
            })
            .catch((err: Error) => {
                setInfoError(err?.message || 'Meeting not found');
            })
            .finally(() => setLoadingInfo(false));
    }, [meetingCode, token]);

    const isHost = meeting ? meeting.host.id === user?.id : false;

    // ── Lobby Hook ───────────────────────────────────────────────────────
    const {
        lobbyStatus,
        deniedReason,
        // admittedRole is available if needed for role-based UI within the room
        sendJoinRequest,
        cancelRequest,
        resetLobby,
        pendingRequests,
        approveRequest,
        denyRequest,
        bulkApprove,
        hostAction,
        configureRoom,
        latestRequest,
        dismissToast,
    } = useLobby({
        socket,
        roomId: meetingCode || '',
        userName: user?.name || 'Guest',
        userId: user?.id || '',
    });

    // ── Lobby-waiting listener (server tells us lobby is enabled) ────────
    const [lobbyGate, setLobbyGate] = useState<'checking' | 'lobby' | 'direct'>('checking');

    useEffect(() => {
        if (!socket) return;

        const onLobbyWaiting = () => {
            setLobbyGate('lobby');
        };

        const onRoomState = () => {
            setLobbyGate('direct');
        };

        socket.on('lobby-waiting', onLobbyWaiting);
        socket.on('room-state', onRoomState);

        return () => {
            socket.off('lobby-waiting', onLobbyWaiting);
            socket.off('room-state', onRoomState);
        };
    }, [socket]);

    // When admitted through lobby, transition gate
    useEffect(() => {
        if (lobbyStatus === 'admitted') {
            setLobbyGate('direct');
        }
    }, [lobbyStatus]);

    // Determine if we should show the meeting room
    const admitted =
        lobbyGate === 'direct' ||
        isHost ||
        !meeting?.lobbyEnabled ||
        lobbyStatus === 'admitted';

    const {
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
    } = useWebRTC({ socket, roomId: meetingCode!, userName: user?.name || 'Guest' });

    // Track the media state chosen in the waiting room to apply it once admitted
    const pendingMediaState = useRef<{ camera: boolean; mic: boolean } | null>(null);

    const handleRequestJoin = (mediaState: { camera: boolean; mic: boolean; screen: boolean }) => {
        pendingMediaState.current = mediaState;
        sendJoinRequest(mediaState);
    };

    // Apply the pending media state once the user is officially admitted to the room UI
    useEffect(() => {
        if (admitted && pendingMediaState.current) {
            const desired = pendingMediaState.current;
            pendingMediaState.current = null; // Clear to prevent loops

            if (desired.camera && !isCamOn) void toggleCam();
            if (desired.mic && !isMicOn) void toggleMic();
        }
    }, [admitted, isCamOn, isMicOn, toggleCam, toggleMic]);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [sidebarTab, setSidebarTab] = useState<'participants' | 'chat' | 'lobby'>('participants');
    const [copied, setCopied] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [handRaised, setHandRaised] = useState(false);

    // Timer
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!admitted) return;
        const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
        return () => clearInterval(timer);
    }, [admitted]);
    const formatTimer = (s: number) =>
        `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, isCamOn, isScreenSharing]);

    // Join room + configure (host sends lobby config)
    useEffect(() => {
        if (!socket || !meeting) return;

        if (isHost) {
            // Host configures room settings before joining
            configureRoom(meeting.lobbyEnabled);
        }

        joinRoom();
    }, [socket, meeting, isHost, joinRoom, configureRoom]);

    // Chat messages from socket
    useEffect(() => {
        if (!socket) return;
        const handler = (msg: ChatMessage) => {
            setChatMessages((prev) => [...prev, msg]);
        };
        socket.on('chat-message', handler);
        return () => { socket.off('chat-message', handler); };
    }, [socket]);

    // Host action applied listener
    useEffect(() => {
        if (!socket) return;
        const handler = (data: { action: string; reason?: string; targetSocketId?: string }) => {
            switch (data.action) {
                case 'mute-all':
                    // If this is not the host, mute locally
                    if (!isHost) {
                        // Mute mic via the hook
                        if (isMicOn) void toggleMic();
                    }
                    break;
                case 'removed':
                    leaveRoom();
                    navigate('/dashboard');
                    break;
                case 'end-meeting':
                    leaveRoom();
                    navigate('/dashboard');
                    break;
                case 'lock-room':
                    setIsLocked(true);
                    break;
                case 'unlock-room':
                    setIsLocked(false);
                    break;
            }
        };
        socket.on('host-action-applied', handler);
        return () => { socket.off('host-action-applied', handler); };
    }, [socket, isHost, isMicOn, toggleMic, leaveRoom, navigate]);

    // ── Refresh Confirmation ─────────────────────────────────────────────
    useEffect(() => {
        if (!admitted) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'You are in a meeting. Are you sure you want to leave?';
            return e.returnValue;
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [admitted]);

    // ── Actions ──────────────────────────────────────────────────────────

    const sendChat = () => {
        if (chatInput.trim() && socket) {
            socket.emit('chat-message', {
                roomId: meetingCode,
                message: chatInput.trim(),
                userName: user?.name || 'Guest',
            });
            setChatInput('');
        }
    };

    const handleLeave = () => {
        leaveRoom();
        navigate('/dashboard');
    };

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const toggleHand = useCallback(() => {
        if (!socket || !meetingCode) return;
        const newState = !handRaised;
        setHandRaised(newState);
        socket.emit('raise-hand', { roomId: meetingCode, raised: newState });
    }, [socket, meetingCode, handRaised]);

    // ── Loading / Error States ───────────────────────────────────────────

    if (loadingInfo) {
        return (
            <div className="meeting-room">
                <div className="meeting-loading">
                    <div className="spinner-lg" />
                    <p>Loading meeting…</p>
                </div>
            </div>
        );
    }

    if (infoError || !meeting) {
        return (
            <div className="meeting-room">
                <div className="meeting-error">
                    <h2>Meeting Not Found</h2>
                    <p>{infoError || 'This meeting does not exist or has ended.'}</p>
                    <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // ── Waiting Room (Lobby Gate) ────────────────────────────────────────

    if (!admitted && meeting.lobbyEnabled && !isHost) {
        return (
            <WaitingRoomView
                meetingTitle={meeting.title}
                lobbyStatus={lobbyStatus}
                deniedReason={deniedReason}
                onRequestJoin={handleRequestJoin}
                onCancel={cancelRequest}
                onRetry={resetLobby}
            />
        );
    }

    // ── Main Meeting Room ────────────────────────────────────────────────

    const peerCount = peers.length;
    const gridClass =
        peerCount === 0
            ? 'peers-0'
            : peerCount === 1
                ? 'peers-1'
                : peerCount === 2
                    ? 'peers-2'
                    : peerCount <= 4
                        ? 'peers-4'
                        : 'peers-many';

    const hasScreenShare = isScreenSharing || peers.some((p) => peerMediaStates[p.socketId]?.screen);

    return (
        <div className="meeting-room">
            {/* ── HEADER ── */}
            <div className="meeting-header">
                <div className="meeting-meta">
                    <span className="meeting-title">{meeting.title || 'Meeting Room'}</span>
                    <span className="meeting-code">{meetingCode}</span>
                    {isLocked && <span className="meeting-locked-badge">🔒 Locked</span>}
                </div>
                <div className="meeting-header-actions">
                    {isHost && pendingRequests.length > 0 && (
                        <button
                            className="lobby-indicator-btn"
                            onClick={() => setSidebarTab('lobby')}
                            aria-label="View pending requests"
                        >
                            <DoorOpen size={16} />
                            <span className="lobby-badge">{pendingRequests.length}</span>
                        </button>
                    )}
                    <button className="copy-link-btn" onClick={copyLink}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                </div>
            </div>

            {/* ── BODY ── */}
            <div className="meeting-body">
                {/* Video Grid */}
                <div className={`video-grid ${hasScreenShare ? 'has-screen-share' : gridClass}`}>
                    {/* Presenter (Screen Share) */}
                    {hasScreenShare && (
                        <div className="video-tile presenter">
                            {isScreenSharing ? (
                                <video ref={localVideoRef} autoPlay muted playsInline />
                            ) : (
                                peers.map((p) =>
                                    peerMediaStates[p.socketId]?.screen ? (
                                        <RemoteVideo
                                            key={`screen-${p.socketId}`}
                                            peer={p}
                                            mediaState={peerMediaStates[p.socketId]}
                                            isPresenter={true}
                                        />
                                    ) : null,
                                )
                            )}
                            {isScreenSharing && (
                                <>
                                    <div className="screen-share-badge">
                                        <Monitor size={12} /> You are sharing
                                    </div>
                                    <div className="participant-name">You ({user?.name})</div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Smaller tiles */}
                    <div className={hasScreenShare ? 'other-peers' : 'contents'}>
                        {/* Local Video */}
                        {!isScreenSharing && (
                            <div className={`video-tile ${isMicOn ? 'speaking-glow' : ''}`}>
                                {isCamOn ? (
                                    <video ref={localVideoRef} autoPlay muted playsInline />
                                ) : (
                                    <div className="avatar-fallback">
                                        {user?.name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                )}
                                <div className="participant-name">
                                    You ({user?.name})
                                    {!isMicOn && (
                                        <MicOff
                                            size={14}
                                            style={{ marginLeft: '6px', color: '#ef4444' }}
                                        />
                                    )}
                                    {isHost && <span className="role-tag">Host</span>}
                                </div>
                            </div>
                        )}

                        {/* Remote Peers */}
                        {peers.map((peer) => {
                            const state = peerMediaStates[peer.socketId] || {
                                camera: false,
                                mic: false,
                                screen: false,
                            };
                            if (state.screen) return null;
                            return (
                                <RemoteVideo
                                    key={peer.socketId}
                                    peer={peer}
                                    mediaState={state}
                                    isPresenter={false}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="sidebar">
                    <div className="sidebar-tabs">
                        <button
                            className={`sidebar-tab ${sidebarTab === 'participants' ? 'active' : ''}`}
                            onClick={() => setSidebarTab('participants')}
                        >
                            <Users size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
                            People ({peers.length + 1})
                        </button>
                        <button
                            className={`sidebar-tab ${sidebarTab === 'chat' ? 'active' : ''}`}
                            onClick={() => setSidebarTab('chat')}
                        >
                            <MessageSquare
                                size={14}
                                style={{ display: 'inline', marginRight: '0.3rem' }}
                            />
                            Chat
                        </button>
                        {isHost && (
                            <button
                                className={`sidebar-tab ${sidebarTab === 'lobby' ? 'active' : ''}`}
                                onClick={() => setSidebarTab('lobby')}
                            >
                                <DoorOpen
                                    size={14}
                                    style={{ display: 'inline', marginRight: '0.3rem' }}
                                />
                                Lobby
                                {pendingRequests.length > 0 && (
                                    <span className="lobby-badge-sm">{pendingRequests.length}</span>
                                )}
                            </button>
                        )}
                    </div>

                    <div
                        className="sidebar-content"
                        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                    >
                        {sidebarTab === 'participants' && (
                            <>
                                <div className="participant-row">
                                    <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
                                    <div className="pname">
                                        {user?.name} (You)
                                        {isHost && <span className="role-tag">Host</span>}
                                    </div>
                                </div>
                                {peers.map((p) => (
                                    <div key={p.socketId} className="participant-row">
                                        <div className="avatar">
                                            {p.userName?.[0]?.toUpperCase()}
                                        </div>
                                        <div className="pname">{p.userName}</div>
                                    </div>
                                ))}
                            </>
                        )}

                        {sidebarTab === 'chat' && (
                            <>
                                <div className="chat-messages" style={{ flex: 1 }}>
                                    {chatMessages.map((msg, i) => (
                                        <div key={i} className="chat-msg">
                                            <div className="chat-sender">{msg.userName}</div>
                                            <div className="chat-text">{msg.message}</div>
                                            <div className="chat-time">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    ))}
                                    {chatMessages.length === 0 && (
                                        <p
                                            className="text-sm opacity-50 text-center"
                                            style={{ marginTop: '2rem' }}
                                        >
                                            No messages yet
                                        </p>
                                    )}
                                </div>
                                <div className="chat-input-row">
                                    <input
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Type a message..."
                                        onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        style={{ padding: '0.5rem 0.8rem' }}
                                        onClick={sendChat}
                                    >
                                        →
                                    </button>
                                </div>
                            </>
                        )}

                        {sidebarTab === 'lobby' && isHost && (
                            <HostLobbyPanel
                                requests={pendingRequests}
                                onApprove={approveRequest}
                                onDeny={denyRequest}
                                onBulkApprove={bulkApprove}
                                onClose={() => setSidebarTab('participants')}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* ── TOAST (host only) ── */}
            {isHost && (
                <JoinRequestToast
                    request={latestRequest}
                    onApprove={approveRequest}
                    onDeny={(sid) => denyRequest(sid)}
                    onDismiss={dismissToast}
                />
            )}

            {/* ── CONTROLS BAR ── */}
            <div className="controls-bar">
                <span className="timer">{formatTimer(elapsed)}</span>

                <div className="controls-center">
                    <button
                        className={`btn btn-icon ${isMicOn ? 'active' : ''}`}
                        onClick={() => void toggleMic()}
                        title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                        aria-label={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                    >
                        {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>

                    <button
                        className={`btn btn-icon ${isCamOn ? 'active' : ''}`}
                        onClick={() => void toggleCam()}
                        title={isCamOn ? 'Turn Off Camera' : 'Turn On Camera'}
                        aria-label={isCamOn ? 'Turn Off Camera' : 'Turn On Camera'}
                    >
                        {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                    </button>

                    <button
                        className={`btn btn-icon ${isScreenSharing ? 'active' : ''}`}
                        onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                        title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                        aria-label={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                    >
                        <Monitor size={20} />
                    </button>

                    <button
                        className={`btn btn-icon ${handRaised ? 'hand-raised-active' : ''}`}
                        onClick={toggleHand}
                        title={handRaised ? 'Lower Hand' : 'Raise Hand'}
                        aria-label={handRaised ? 'Lower Hand' : 'Raise Hand'}
                    >
                        <Hand size={20} />
                    </button>

                    <button
                        className="btn btn-icon danger"
                        onClick={handleLeave}
                        title="Leave Meeting"
                        aria-label="Leave Meeting"
                    >
                        <PhoneOff size={20} />
                    </button>
                </div>

                <div className="controls-right">
                    {isHost && (
                        <HostControlsPanel
                            participants={peers.map((p) => ({
                                socketId: p.socketId,
                                userName: p.userName,
                                role: 'participant',
                            }))}
                            isLocked={isLocked}
                            onAction={hostAction}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

/** Separate component to attach remote streams to video elements */
function RemoteVideo({
    peer,
    mediaState,
    isPresenter,
}: {
    peer: { socketId: string; userName: string; stream?: MediaStream };
    mediaState: { camera: boolean; mic: boolean; screen: boolean };
    isPresenter: boolean;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hasVideo = mediaState.camera || mediaState.screen;

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
            videoRef.current.play().catch((err) => {
                console.error('[WebRTC] Remote video auto-play blocked:', err);
            });
        }
    }, [hasVideo, peer.stream, peer.stream?.getTracks().map((t) => t.id).join(',')]);

    return (
        <div className={`video-tile ${mediaState.mic && !isPresenter ? 'speaking-glow' : ''}`}>
            {hasVideo && peer.stream ? (
                <video ref={videoRef} autoPlay playsInline />
            ) : (
                <div className="avatar-fallback">
                    {peer.userName?.[0]?.toUpperCase() || '?'}
                </div>
            )}

            {isPresenter && (
                <div className="screen-share-badge">
                    <Monitor size={12} /> {peer.userName}&apos;s Screen
                </div>
            )}

            <div className="participant-name">
                {peer.userName}
                {!mediaState.mic && (
                    <MicOff size={14} style={{ marginLeft: '6px', color: '#ef4444' }} />
                )}
            </div>
        </div>
    );
}
