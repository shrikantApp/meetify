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
    const [manualPinId, setManualPinId] = useState<string | null>(null);
    const [selectedParticipant, setSelectedParticipant] = useState<{
        socketId: string;
        userName: string;
        isMicOn: boolean;
        isCamOn: boolean;
        isPinned: boolean;
    } | null>(null);
    const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);

    const {
        localStream, localCameraStream, peers, peerMediaStates, isMicOn, isCamOn, isScreenSharing,
        audioDevices, videoDevices, selectedAudioId, selectedVideoId, isMirrored, setIsMirrored,
        joinRoom, leaveRoom, toggleMic, toggleCam, startScreenShare, stopScreenShare,
    } = useWebRTC({ socket, roomId: meetingCode || '', userName: user?.name || 'Guest' });

    // ── LAYOUT & PINNING LOGIC ──
    type TileType = 'camera' | 'screen';
    interface Tile {
        id: string; // unique tile id
        socketId: string; // underlying socket id
        type: TileType;
        userName: string;
        stream?: MediaStream;
    }

    const tiles = (() => {
        const result: Tile[] = [];
        // Local Camera
        result.push({
            id: 'local',
            socketId: 'local',
            type: 'camera',
            userName: user?.name || 'You',
            stream: localStream || undefined
        });
        // Local Screen
        if (isScreenSharing) {
            result.push({
                id: 'local-screen',
                socketId: 'local',
                type: 'screen',
                userName: (user?.name || 'You') + "'s Screen",
                stream: localCameraStream || undefined // In startScreenShare, we set this to the screen stream state
            });
        }
        // Remote Peers
        peers.forEach(p => {
            const state = peerMediaStates[p.socketId];
            
            // Camera (Always exists as a participant entry)
            result.push({
                id: p.socketId,
                socketId: p.socketId,
                type: 'camera',
                userName: p.userName,
                stream: p.stream
            });

            // Screen (Only if signaled AND we have a stream)
            if (state?.screen && p.screenStream) {
                result.push({
                    id: p.socketId + '-screen',
                    socketId: p.socketId,
                    type: 'screen',
                    userName: p.userName + "'s Screen",
                    stream: p.screenStream
                });
            }
        });
        return result;
    })();

    const screenTile = tiles.find(t => t.type === 'screen');
    const spotlightTileId = manualPinId || screenTile?.id || null;
    const isSpotlightMode = spotlightTileId !== null;

    useEffect(() => {
        if (manualPinId && !tiles.find(t => t.id === manualPinId)) {
            setManualPinId(null);
        }
    }, [tiles, manualPinId]);

    const handlePin = (tileId: string) => {
        setManualPinId(prev => (prev === tileId ? null : tileId));
    };

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
        layoutMode: (isSpotlightMode ? 'spotlight' : 'grid') as 'spotlight' | 'grid',
        spotlightId: spotlightTileId,
        localCameraStream,
        activeSpeakerId
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

    // Auto-show sidebar when participants > 4
    useEffect(() => {
        if (peers.length >= 4 && !showSidebar) {
            setShowSidebar(true);
            setSidebarTab('participants');
        }
    }, [peers.length]);

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
            setManualPinId(sid);
            setIsParticipantModalOpen(false);
        } else if (action === 'unpin') {
            setManualPinId(null);
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
            isPinned: p.socketId === manualPinId,
        });
        setIsParticipantModalOpen(true);
    }, [isHost, manualPinId]);

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
        <div className="flex flex-col h-screen bg-bg-primary text-text-primary overflow-hidden font-inter relative">
            {/* Mesh Gradient Background Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-success/5 blur-[120px] rounded-full pointer-events-none" />

            {/* ── TOP BAR (Premium Glass Style) ── */}
            <header className="flex items-center justify-between px-8 py-5 z-20 relative">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/30 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                            <Video size={22} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-extrabold tracking-tight text-white line-clamp-1 max-w-[200px] md:max-w-none">
                                {meeting.title || 'Meeting Room'}
                            </h1>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-[0.25em] text-accent font-black">
                                    {meetingCode}
                                </span>
                                <div className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-[10px] text-text-secondary font-bold">
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
                        <div className="flex items-center gap-2.5 px-4 py-2 bg-accent-danger/10 text-accent-danger border border-accent-danger/20 rounded-full animate-pulse mr-2 shadow-[0_0_15px_rgba(255,82,82,0.1)]">
                            <div className="w-2 h-2 rounded-full bg-accent-danger shadow-[0_0_10px_rgba(255,82,82,0.6)]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em]">
                                Recording {isRecording && `${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, '0')}`}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 px-4 py-2 glass-panel !bg-white/5 border-white/5 rounded-2xl">

                        <Users size={16} className="text-text-secondary" />
                        <span className="text-sm font-bold text-white/90">{peers.length + 1}</span>
                    </div>
                    <button
                        onClick={copyLink}
                        className="flex items-center gap-2 px-4 py-2 glass-panel !bg-white/5 hover:!bg-white/[0.08] border-white/10 rounded-2xl text-xs font-bold transition-all group"
                    >
                        {copied ? <Check size={14} className="text-accent-success" /> : <Info size={14} className="group-hover:text-accent transition-colors" />}
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
            <main className="flex flex-1 relative overflow-hidden px-6 pb-28">
                <div className={`flex-1 flex flex-col relative transition-all duration-500 ease-in-out ${showSidebar ? 'mr-[380px]' : ''}`}>
                    {/* Video Grid / Spotlight Container */}
                    <div className="flex-1 min-h-0 relative flex p-4 gap-6">
                        
                        {!isSpotlightMode ? (
                            /* GRID MODE: Standard responsive grid with all tiles */
                            <div className="flex-1 flex flex-wrap items-center justify-center gap-6 overflow-hidden content-center">
                                {tiles.map((tile) => (
                                    <div key={tile.id} className={`transition-all duration-700 ease-in-out flex items-center justify-center shrink min-h-0 ${
                                        tiles.length === 1 ? 'w-full h-full max-w-3xl' :
                                        tiles.length === 2 ? 'w-[calc(50%-12px)] h-full max-h-[85%]' :
                                        tiles.length <= 4 ? 'w-[calc(50%-12px)] h-[calc(50%-12px)]' :
                                        'w-[calc(33.33%-16px)] h-[calc(33.33%-16px)]'
                                    }`}>
                                        <div className="w-full h-full max-h-full aspect-video flex items-center justify-center overflow-hidden rounded-2xl">
                                            <VideoTile
                                                stream={tile.stream}
                                                userName={tile.userName}
                                                isLocal={tile.socketId === 'local'}
                                                isMicOn={tile.socketId === 'local' ? isMicOn : (peerMediaStates[tile.socketId]?.mic ?? false)}
                                                isCamOn={tile.socketId === 'local' ? (tile.type === 'camera' ? isCamOn : true) : (tile.type === 'camera' ? (peerMediaStates[tile.socketId]?.camera ?? false) : true)}
                                                isScreenShare={tile.type === 'screen'}
                                                isMirrored={tile.socketId === 'local' && tile.type === 'camera' && isMirrored}
                                                isActiveSpeaker={activeSpeakerId === tile.socketId}
                                                isPinned={manualPinId === tile.id}
                                                onPin={() => handlePin(tile.id)}
                                                onContextMenu={() => openParticipantModal({ 
                                                    socketId: tile.socketId, 
                                                    userName: tile.userName, 
                                                    isMicOn: tile.socketId === 'local' ? isMicOn : (peerMediaStates[tile.socketId]?.mic ?? false), 
                                                    isCamOn: tile.socketId === 'local' ? isCamOn : (peerMediaStates[tile.socketId]?.camera ?? false) 
                                                })}
                                                onClick={() => tile.socketId !== 'local' && openParticipantModal({
                                                    socketId: tile.socketId,
                                                    userName: tile.userName,
                                                    isMicOn: peerMediaStates[tile.socketId]?.mic ?? false,
                                                    isCamOn: peerMediaStates[tile.socketId]?.camera ?? false
                                                })}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* SPOTLIGHT MODE: 1 Large + Strip on right */
                            <div className="flex-1 flex gap-6 min-h-0">
                                {/* Main Spotlight Area */}
                                <div className="flex-[4] relative group">
                                    <div className="w-full h-full aspect-video md:aspect-auto max-h-full">
                                        {(() => {
                                            const tile = tiles.find(t => t.id === spotlightTileId);
                                            if (!tile) return null;
                                            
                                            // Check for PiP partner (camera of the same socketId if we are spotlighting screen)
                                            const pipTile = tile.type === 'screen' ? tiles.find(t => t.socketId === tile.socketId && t.type === 'camera') : null;

                                            return (
                                                <>
                                                    <VideoTile
                                                        stream={tile.stream}
                                                        userName={tile.userName}
                                                        isLocal={tile.socketId === 'local'}
                                                        isMicOn={tile.socketId === 'local' ? isMicOn : (peerMediaStates[tile.socketId]?.mic ?? false)}
                                                        isCamOn={tile.socketId === 'local' ? (tile.type === 'camera' ? isCamOn : true) : (tile.type === 'camera' ? (peerMediaStates[tile.socketId]?.camera ?? false) : true)}
                                                        isScreenShare={tile.type === 'screen'}
                                                        isMirrored={tile.socketId === 'local' && tile.type === 'camera' && isMirrored}
                                                        isActiveSpeaker={activeSpeakerId === tile.socketId}
                                                        isPinned={manualPinId === tile.id}
                                                        isSpotlight={true}
                                                        onPin={() => handlePin(tile.id)}
                                                        onContextMenu={() => openParticipantModal({ 
                                                            socketId: tile.socketId, 
                                                            userName: tile.userName, 
                                                            isMicOn: tile.socketId === 'local' ? isMicOn : (peerMediaStates[tile.socketId]?.mic ?? false), 
                                                            isCamOn: tile.socketId === 'local' ? isCamOn : (peerMediaStates[tile.socketId]?.camera ?? false) 
                                                        })}
                                                        onClick={() => tile.socketId !== 'local' && openParticipantModal({
                                                            socketId: tile.socketId,
                                                            userName: tile.userName,
                                                            isMicOn: peerMediaStates[tile.socketId]?.mic ?? false,
                                                            isCamOn: peerMediaStates[tile.socketId]?.camera ?? false
                                                        })}
                                                    />
                                                    
                                                    {/* PiP Overlay */}
                                                    {pipTile && (pipTile.socketId === 'local' ? (isCamOn && tile.stream) : peerMediaStates[pipTile.socketId]?.camera) && (
                                                        <div className="absolute bottom-6 right-6 w-48 aspect-video rounded-2xl overflow-hidden border-2 border-accent/40 shadow-2xl z-40 transition-all hover:scale-105 group-hover:translate-x-0 group-hover:translate-y-0">
                                                            <VideoTile
                                                                stream={pipTile.stream}
                                                                userName={pipTile.userName}
                                                                isLocal={pipTile.socketId === 'local'}
                                                                isMicOn={pipTile.socketId === 'local' ? isMicOn : (peerMediaStates[pipTile.socketId]?.mic ?? false)}
                                                                isCamOn={true}
                                                                isMirrored={pipTile.socketId === 'local' && isMirrored}
                                                                className="!rounded-none !border-0"
                                                            />
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Participant Strip Area */}
                                <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 min-w-[240px]">
                                    {tiles
                                        .filter(t => t.id !== spotlightTileId)
                                        .map(tile => (
                                            <div key={tile.id} className="w-full aspect-video shrink-0">
                                                <VideoTile
                                                    stream={tile.stream}
                                                    userName={tile.userName}
                                                    isLocal={tile.socketId === 'local'}
                                                    isMicOn={tile.socketId === 'local' ? isMicOn : (peerMediaStates[tile.socketId]?.mic ?? false)}
                                                    isCamOn={tile.socketId === 'local' ? (tile.type === 'camera' ? isCamOn : true) : (tile.type === 'camera' ? (peerMediaStates[tile.socketId]?.camera ?? false) : true)}
                                                    isScreenShare={tile.type === 'screen'}
                                                    isMirrored={tile.socketId === 'local' && tile.type === 'camera' && isMirrored}
                                                    isActiveSpeaker={activeSpeakerId === tile.socketId}
                                                    isPinned={manualPinId === tile.id}
                                                    onPin={() => handlePin(tile.id)}
                                                    onContextMenu={() => openParticipantModal({ 
                                                        socketId: tile.socketId, 
                                                        userName: tile.userName, 
                                                        isMicOn: tile.socketId === 'local' ? isMicOn : (peerMediaStates[tile.socketId]?.mic ?? false), 
                                                        isCamOn: tile.socketId === 'local' ? isCamOn : (peerMediaStates[tile.socketId]?.camera ?? false) 
                                                    })}
                                                    onClick={() => tile.socketId !== 'local' && openParticipantModal({
                                                        socketId: tile.socketId,
                                                        userName: tile.userName,
                                                        isMicOn: peerMediaStates[tile.socketId]?.mic ?? false,
                                                        isCamOn: peerMediaStates[tile.socketId]?.camera ?? false
                                                    })}
                                                />
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Overlay/Panel */}
                <div className={`absolute top-0 right-0 h-full w-[380px] glass-panel !rounded-l-[2.5rem] !rounded-r-none z-40 transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) shadow-2xl ${showSidebar ? 'translate-x-0 opacity-100' : 'translate-x-[420px] opacity-0'}`}>
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between p-8 border-b border-white/5">
                            <div className="flex gap-1 glass-panel !bg-white/5 p-1 rounded-2xl">
                                <button
                                    onClick={() => setSidebarTab('participants')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${sidebarTab === 'participants' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white/70'}`}
                                >
                                    People
                                </button>
                                <button
                                    onClick={() => setSidebarTab('chat')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${sidebarTab === 'chat' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white/70'}`}
                                >
                                    Chat
                                </button>
                                {isHost && (
                                    <button
                                        onClick={() => setSidebarTab('lobby')}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${sidebarTab === 'lobby' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white/70'}`}
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
                                        <div key={p.socketId} className="flex items-center justify-between p-4 glass-panel !bg-white/[0.02] hover:!bg-white/[0.08] rounded-2xl transition-all border-white/5 active:scale-[0.98] group cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center font-bold text-white/40 group-hover:bg-accent/20 group-hover:text-accent transition-all shadow-inner">
                                                    {p.userName?.[0]?.toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-white/90">{p.userName}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-accent-success animate-pulse" />
                                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Online</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2.5">
                                                {!peerMediaStates[p.socketId]?.mic && <div className="p-1.5 bg-accent-danger/10 rounded-lg text-accent-danger border border-accent-danger/20"><MicOff size={12} /></div>}
                                                {!peerMediaStates[p.socketId]?.camera && <div className="p-1.5 bg-accent-danger/10 rounded-lg text-accent-danger border border-accent-danger/20"><VideoOff size={12} /></div>}
                                            </div>
                                        </div>
                                    ))}

                                </div>
                            )}

                            {sidebarTab === 'chat' && (
                                <div className="flex flex-col h-full">
                                    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} className={`flex flex-col gap-1.5 ${msg.userName === user?.name ? 'items-end' : 'items-start'} max-w-[90%]`}>
                                                <div className="flex items-center gap-2 px-1">
                                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">{msg.userName}</span>
                                                    <span className="text-[9px] text-white/20 font-medium">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-lg ${msg.userName === user?.name ? 'bg-accent text-white rounded-tr-none shadow-accent/20' : 'glass-panel !bg-white/5 text-white/90 rounded-tl-none border-white/10'}`}>
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
