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
    Video, VideoOff, MicOff, Check, Info,
    Users, MessageSquare, X
} from 'lucide-react';
import MeetingControls from '../components/MeetingControls';
import VideoTile from '../components/VideoTile';
import DeviceSettingsModal from '../components/DeviceSettingsModal';
import ParticipantControlModal from '../components/ParticipantControlModal';
import { useRecording } from '../hooks/useRecording';

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
    const [isRemoteRecording, setIsRemoteRecording] = useState(false);

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

    const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = useState<'participants' | 'chat' | 'lobby' | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);
    const [selectedParticipant, setSelectedParticipant] = useState<{
        socketId: string;
        userName: string;
        isMicOn: boolean;
        isCamOn: boolean;
        isPinned: boolean;
    } | null>(null);
    const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);

    const {
        localStream, peers, peerMediaStates, isMicOn, isCamOn, isScreenSharing,
        audioDevices, videoDevices, selectedAudioId, selectedVideoId, isMirrored, setIsMirrored,
        joinRoom, leaveRoom, toggleMic, toggleCam, startScreenShare, stopScreenShare,
    } = useWebRTC({ socket, roomId: meetingCode || '', userName: user?.name || 'Guest' });

    const {
        isRecording, isPaused, recordingDuration, startRecording, stopRecording, pauseRecording, resumeRecording,
        error: recordingError, clearError: clearRecordingError
    } = useRecording({
        socket,
        meetingCode: meetingCode || '',
        meetingId: meeting?.id || '',
        meetingTitle: meeting?.title || 'Meeting Room',
        hostId: user?.id || '',
        localStream,
        peers,
        isMicOn,
        isCamOn,
        isScreenSharing,
    });

    const handleToggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // Clock effect
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

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

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isLocked, setIsLocked] = useState(false);
    const [handRaised, setHandRaised] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);

    // Active speaker logic: priority to screen sharer, then current talker (mic on), then local if talking
    useEffect(() => {
        const screenSharer = peers.find((p: any) => peerMediaStates[p.socketId]?.screen);
        if (screenSharer) {
            setActiveSpeakerId(screenSharer.socketId);
        } else {
            // Priority: Peer with mic on > Local with mic on > First Peer > Local
            const peerSpeaker = peers.find((p: any) => peerMediaStates[p.socketId]?.mic);
            if (peerSpeaker) {
                setActiveSpeakerId(peerSpeaker.socketId);
            } else if (isMicOn) {
                setActiveSpeakerId('local');
            } else if (peers.length > 0) {
                setActiveSpeakerId(peers[0].socketId);
            } else {
                setActiveSpeakerId('local');
            }
        }
    }, [peers, peerMediaStates, isMicOn, isCamOn, isScreenSharing]);

    // Join room + configure (host sends lobby config)
    useEffect(() => {
        if (!socket || !meeting) return;

        if (isHost) {
            // Host configures room settings before joining
            configureRoom(meeting.lobbyEnabled);
        }

        joinRoom({
            camera: isCamOn,
            mic: isMicOn
        });
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
                    // Handled by hook's force-mute listener
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

        const recordingHandler = (data: { isRecording: boolean }) => {
            setIsRemoteRecording(data.isRecording);
        };
        socket.on('recording-state-changed', recordingHandler);

        return () => {
            socket.off('host-action-applied', handler);
            socket.off('recording-state-changed');
        };
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

    const [copied, setCopied] = useState(false);
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

    const handleParticipantAction = useCallback((action: string, sid: string) => {
        if (sid === 'local') return;

        if (action === 'pin') {
            setPinnedPeerId(sid);
            setIsParticipantModalOpen(false);
        } else if (action === 'unpin') {
            setPinnedPeerId(null);
            setIsParticipantModalOpen(false);
        } else if (isHost && socket) {
            // Map actions to the specific contract: mute, stop-video, remove
            let targetAction = action;
            if (action === 'disable-camera') targetAction = 'stop-video';
            if (action === 'remove-participant') targetAction = 'remove';

            socket.emit('participant-action', {
                roomId: meetingCode,
                targetUserId: sid,
                action: targetAction,
            });

            if (targetAction === 'remove') {
                setIsParticipantModalOpen(false);
                setSelectedParticipant(null);
            }
        }
    }, [isHost, socket, meetingCode]);

    const openParticipantModal = useCallback((p: any) => {
        if (!isHost) return;
        setSelectedParticipant({
            socketId: p.socketId,
            userName: p.userName,
            isMicOn: p.isMicOn,
            isCamOn: p.isCamOn,
            isPinned: p.socketId === pinnedPeerId,
        });
        setIsParticipantModalOpen(true);
    }, [isHost, pinnedPeerId]);

    // ── KEYBOARD SHORTCUTS ───────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                void toggleMic();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                void toggleCam();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleMic, toggleCam]);

    const onToggleSidebar = () => {
        setShowSidebar(!showSidebar);
        setSidebarTab(showSidebar ? null : 'participants')
    }

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



    return (
        <div className="flex flex-col h-screen bg-[#0d0f18] text-text-primary overflow-hidden font-inter">
            {/* ── TOP BAR (Google Meet 2025 Style) ── */}
            <header className="flex items-center justify-between px-8 py-4 z-20">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20">
                            <Video size={20} />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold tracking-tight text-white line-clamp-1 max-w-[200px] md:max-w-none">
                                {meeting.title || 'Meeting Room'}
                            </h1>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-accent font-bold">
                                    {meetingCode}
                                </span>
                                <div className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-[10px] text-text-secondary font-medium">
                                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RECORDING ERROR ALERT ── */}
                {recordingError && (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between gap-4 p-4 bg-accent-danger/90 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <Info size={18} />
                                </div>
                                <p className="text-sm font-bold">{recordingError}</p>
                            </div>
                            <button
                                onClick={clearRecordingError}
                                className="p-2 hover:bg-white/10 rounded-lg transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    {(isRecording || isRemoteRecording) && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full animate-pulse mr-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                Recording {isRecording && `${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, '0')}`}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/5 rounded-2xl">
                        <Users size={16} className="text-text-secondary" />
                        <span className="text-sm font-bold text-white/90">{peers.length + 1}</span>
                    </div>
                    <button
                        onClick={copyLink}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold transition-all group"
                    >
                        {copied ? <Check size={14} className="text-accent-success" /> : <Info size={14} className="group-hover:text-accent" />}
                        <span>{copied ? 'Link Copied' : 'Details'}</span>
                    </button>
                    {isHost && (
                        <div className="ml-2">
                            <HostControlsPanel
                                participants={peers.map((p) => ({
                                    socketId: p.socketId,
                                    userName: p.userName,
                                    role: 'participant' as const,
                                }))}
                                isLocked={isLocked}
                                onAction={hostAction}
                            />
                        </div>
                    )}
                </div>
            </header>

            {/* ── MAIN BODY ── */}
            <main className="flex flex-1 relative overflow-hidden px-8 pb-32">
                <div className={`flex-1 flex flex-col relative transition-all duration-500 ease-in-out ${showSidebar ? 'mr-[380px]' : ''}`}>
                    {/* Video Grid */}
                    <div className={`flex-1 min-h-0 flex flex-wrap items-center justify-center gap-6 p-4 ${showSidebar ? 'mr-0' : ''}`}>
                        {/* Local Video - Active Speaker Priority */}
                        <div className={`transition-all duration-700 ease-in-out ${peers.length === 0 ? 'w-full max-w-4xl aspect-video' :
                                peers.length === 1 ? 'w-[calc(50%-12px)] aspect-video' :
                                    peers.length === 2 ? 'w-[calc(33.33%-16px)] aspect-video' :
                                        'w-[calc(25%-18px)] min-w-[300px] aspect-video'
                            }`}>
                            <VideoTile
                                stream={localStream || undefined}
                                userName={user?.name || 'You'}
                                isLocal={true}
                                isMicOn={isMicOn}
                                isCamOn={isCamOn}
                                isScreenShare={isScreenSharing}
                                isMirrored={isMirrored}
                                isActiveSpeaker={activeSpeakerId === 'local'}
                                onContextMenu={() => openParticipantModal({ socketId: 'local', userName: user?.name || 'You', isMicOn, isCamOn })}
                            />
                        </div>

                        {/* Remote Videos */}
                        {peers
                            .sort((a, b) => {
                                if (a.socketId === pinnedPeerId) return -1;
                                if (b.socketId === pinnedPeerId) return 1;
                                return 0;
                            })
                            .map((p) => (
                                <div key={p.socketId} className={`transition-all duration-700 ease-in-out ${peers.length === 1 ? 'w-[calc(50%-12px)] aspect-video' :
                                        peers.length === 2 ? 'w-[calc(33.33%-16px)] aspect-video' :
                                            'w-[calc(25%-18px)] min-w-[300px] aspect-video'
                                    }`}>
                                    <VideoTile
                                        stream={p.stream}
                                        userName={p.userName}
                                        isMicOn={peerMediaStates[p.socketId]?.mic ?? false}
                                        isCamOn={peerMediaStates[p.socketId]?.camera ?? false}
                                        isScreenShare={peerMediaStates[p.socketId]?.screen ?? false}
                                        isActiveSpeaker={activeSpeakerId === p.socketId}
                                        isPinned={pinnedPeerId === p.socketId}
                                        onClick={() => openParticipantModal({
                                            socketId: p.socketId,
                                            userName: p.userName,
                                            isMicOn: peerMediaStates[p.socketId]?.mic ?? false,
                                            isCamOn: peerMediaStates[p.socketId]?.camera ?? false
                                        })}
                                    />
                                </div>
                            ))}
                    </div>
                </div>

                {/* Sidebar Overlay/Panel */}
                <div className={`absolute top-0 right-0 h-full w-[350px] bg-bg-card/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] z-40 transition-all duration-500 ease-in-out shadow-2xl ${showSidebar ? 'translate-x-0' : 'translate-x-[400px]'}`}>
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                                <button
                                    onClick={() => setSidebarTab('participants')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sidebarTab === 'participants' ? 'bg-accent text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                                >
                                    People
                                </button>
                                <button
                                    onClick={() => setSidebarTab('chat')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sidebarTab === 'chat' ? 'bg-accent text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                                >
                                    Chat
                                </button>
                                {isHost && (
                                    <button
                                        onClick={() => setSidebarTab('lobby')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sidebarTab === 'lobby' ? 'bg-accent text-white shadow-lg' : 'text-white/40 hover:text-white/70'}`}
                                    >
                                        Lobby
                                    </button>
                                )}
                            </div>
                            <button onClick={() => setShowSidebar(false)} className="p-2 text-white/30 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            {sidebarTab === 'participants' && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-accent/40 flex items-center justify-center font-bold">{user?.name?.[0]?.toUpperCase()}</div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{user?.name} (You)</span>
                                                <span className="text-[10px] text-accent font-bold tracking-wider uppercase"> {isHost ? 'Host' : 'Participant'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="my-4 px-2 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Other Participants ({peers.length})</div>
                                    {peers.map((p) => (
                                        <div key={p.socketId} className="flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5 group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-white/40 group-hover:bg-accent/20 group-hover:text-accent transition-all">
                                                    {p.userName?.[0]?.toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold">{p.userName}</span>
                                                    <span className="text-[10px] text-white/30">Online</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {!peerMediaStates[p.socketId]?.mic && <MicOff size={14} className="text-accent-danger" />}
                                                {!peerMediaStates[p.socketId]?.camera && <VideoOff size={14} className="text-accent-danger" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {sidebarTab === 'chat' && (
                                <div className="flex flex-col h-full">
                                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} className={`flex flex-col gap-1 ${msg.userName === user?.name ? 'items-end' : 'items-start'}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-white/30">{msg.userName}</span>
                                                    <span className="text-[8px] text-white/20">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <div className={`px-4 py-2 rounded-2xl text-sm ${msg.userName === user?.name ? 'bg-accent text-white rounded-tr-none shadow-lg shadow-accent/20' : 'bg-white/5 text-white/90 rounded-tl-none border border-white/5'}`}>
                                                    {msg.message}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex gap-2 bg-white/5 p-2 rounded-2xl border border-white/5 focus-within:border-accent/50 transition-all">
                                        <input
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="Send message"
                                            className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-white placeholder:text-white/20"
                                            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                                        />
                                        <button onClick={sendChat} className="p-2 bg-accent text-white rounded-xl shadow-lg shadow-accent/40 active:scale-95 transition-all">
                                            <MessageSquare size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {sidebarTab === 'lobby' && isHost && (
                                <div className="">
                                    <HostLobbyPanel
                                        requests={pendingRequests}
                                        onApprove={approveRequest}
                                        onDeny={denyRequest}
                                        onBulkApprove={bulkApprove}
                                        onClose={() => setSidebarTab('participants')}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Floating Controls */}
            <MeetingControls
                isMicOn={isMicOn}
                isCamOn={isCamOn}
                isScreenSharing={isScreenSharing}
                handRaised={handRaised}
                showSidebar={sidebarTab !== null}
                isHost={isHost}
                isRecording={isRecording}
                onToggleMic={toggleMic}
                onToggleCam={toggleCam}
                onToggleScreenShare={isScreenSharing ? stopScreenShare : startScreenShare}
                onToggleHand={toggleHand}
                onToggleSidebar={onToggleSidebar}
                onOpenSettings={() => setShowSettings(true)}
                onToggleRecording={handleToggleRecording}
                isPaused={isPaused}
                onPauseRecording={pauseRecording}
                onResumeRecording={resumeRecording}
                onLeave={handleLeave}
            />

            {/* Consolidated Settings Modal (Audio, Video, Appearance, General) */}
            <DeviceSettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                audioDevices={audioDevices}
                videoDevices={videoDevices}
                selectedAudioId={selectedAudioId}
                selectedVideoId={selectedVideoId}
                onAudioDeviceChange={toggleMic}
                onVideoDeviceChange={toggleCam}
                isMirrored={isMirrored}
                onMirrorToggle={setIsMirrored}
            />

            {/* ── TOAST (host only) ── */}
            {isHost && latestRequest && (
                <div className="fixed top-20 right-6 z-50">
                    <JoinRequestToast
                        request={latestRequest}
                        onApprove={approveRequest}
                        onDeny={(sid) => denyRequest(sid)}
                        onDismiss={dismissToast}
                    />
                </div>
            )}

            {/* Participant Control Modal */}
            <ParticipantControlModal
                isOpen={isParticipantModalOpen}
                onClose={() => setIsParticipantModalOpen(false)}
                participant={selectedParticipant}
                onAction={handleParticipantAction}
            />
        </div>
    );
}
