import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Copy, Check, Users, MessageSquare } from 'lucide-react';

interface ChatMessage {
    message: string;
    userName: string;
    timestamp: string;
}

/**
 * MeetingRoomPage
 * ───────────────
 * Orchestrates the full video-call UI:
 * - Joins the WebRTC room via useWebRTC hook
 * - Renders a responsive video grid for local + remote streams
 * - Bottom control bar: mic, cam, screen share, end call
 * - Right sidebar: participants list + in-meeting chat
 */
export default function MeetingRoomPage() {
    const { meetingCode } = useParams<{ meetingCode: string }>();
    const { user } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();

    const {
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
    } = useWebRTC({ socket, roomId: meetingCode!, userName: user?.name || 'Guest' });

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [sidebarTab, setSidebarTab] = useState<'participants' | 'chat'>('participants');
    const [copied, setCopied] = useState(false);

    // Timer
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
        return () => clearInterval(timer);
    }, []);
    const formatTimer = (s: number) =>
        `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Join room after socket is ready
    useEffect(() => {
        console.log("socket", socket)
        if (socket) {
            joinRoom();
        }
    }, [socket]);

    // Chat messages from socket
    useEffect(() => {
        if (!socket) return;
        socket.on('chat-message', (msg: ChatMessage) => {
            setChatMessages((prev) => [...prev, msg]);
        });
        return () => { socket.off('chat-message'); };
    }, [socket]);

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

    // Responsive grid class based on peer count
    const peerCount = peers.length;
    const gridClass = peerCount === 0 ? 'peers-0'
        : peerCount === 1 ? 'peers-1'
            : peerCount === 2 ? 'peers-2'
                : peerCount <= 4 ? 'peers-4'
                    : 'peers-many';

    return (
        <div className="meeting-room">
            {/* ── HEADER ── */}
            <div className="meeting-header">
                <div className="meeting-meta">
                    <span className="meeting-title">Meeting Room</span>
                    <span className="meeting-code">{meetingCode}</span>
                </div>
                <button className="copy-link-btn" onClick={copyLink}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy Link'}
                </button>
            </div>

            {/* ── BODY ── */}
            <div className="meeting-body">
                {/* Video Grid */}
                <div className={`video-grid ${gridClass}`}>
                    {/* Local Video */}
                    <div className="video-tile">
                        {isCamOn ? (
                            <video ref={localVideoRef} autoPlay muted playsInline />
                        ) : (
                            <div className="avatar-fallback">
                                {user?.name?.[0]?.toUpperCase() || '?'}
                            </div>
                        )}
                        <div className="participant-name">You ({user?.name})</div>
                    </div>

                    {/* Remote Peers */}
                    {peers.map((peer) => (
                        <RemoteVideo key={peer.socketId} peer={peer} />
                    ))}
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
                            <MessageSquare size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
                            Chat
                        </button>
                    </div>

                    <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {sidebarTab === 'participants' && (
                            <>
                                <div className="participant-row">
                                    <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
                                    <div className="pname">{user?.name} (You)</div>
                                </div>
                                {peers.map((p) => (
                                    <div key={p.socketId} className="participant-row">
                                        <div className="avatar">{p.userName?.[0]?.toUpperCase()}</div>
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
                                            <div className="chat-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                                        </div>
                                    ))}
                                    {chatMessages.length === 0 && (
                                        <p className="text-sm opacity-50 text-center" style={{ marginTop: '2rem' }}>
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
                                    <button className="btn btn-primary" style={{ padding: '0.5rem 0.8rem' }} onClick={sendChat}>→</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── CONTROLS BAR ── */}
            <div className="controls-bar">
                <span className="timer">{formatTimer(elapsed)}</span>

                <button
                    className={`btn btn-icon ${isMicOn ? 'active' : ''}`}
                    onClick={() => void toggleMic()}
                    title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                >
                    {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                </button>

                <button
                    className={`btn btn-icon ${isCamOn ? 'active' : ''}`}
                    onClick={() => void toggleCam()}
                    title={isCamOn ? 'Turn Off Camera' : 'Turn On Camera'}
                >
                    {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                </button>

                <button
                    className={`btn btn-icon ${isScreenSharing ? 'active' : ''}`}
                    onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                    title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                >
                    <Monitor size={20} />
                </button>

                <button
                    className="btn btn-icon danger"
                    onClick={handleLeave}
                    title="Leave Meeting"
                >
                    <PhoneOff size={20} />
                </button>
            </div>
        </div>
    );
}

/** Separate component to attach remote streams to video elements */
function RemoteVideo({ peer }: { peer: { socketId: string; userName: string; stream?: MediaStream } }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream]);

    return (
        <div className="video-tile">
            {peer.stream ? (
                <video ref={videoRef} autoPlay playsInline />
            ) : (
                <div className="avatar-fallback">{peer.userName?.[0]?.toUpperCase() || '?'}</div>
            )}
            <div className="participant-name">{peer.userName}</div>
        </div>
    );
}
