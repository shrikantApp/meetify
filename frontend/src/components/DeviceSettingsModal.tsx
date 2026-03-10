import { useRef, useState, useEffect } from 'react';
import { Settings, Mic, Video, Speaker, Volume2, FlipHorizontal } from 'lucide-react';

interface DeviceSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    audioDevices: MediaDeviceInfo[];
    videoDevices: MediaDeviceInfo[];
    selectedAudioId: string;
    selectedVideoId: string;
    onAudioDeviceChange: (deviceId: string) => void;
    onVideoDeviceChange: (deviceId: string) => void;
    isMirrored: boolean;
    onMirrorToggle: (mirrored: boolean) => void;
}

export default function DeviceSettingsModal({
    isOpen,
    onClose,
    audioDevices,
    videoDevices,
    selectedAudioId,
    selectedVideoId,
    onAudioDeviceChange,
    onVideoDeviceChange,
    isMirrored,
    onMirrorToggle,
}: DeviceSettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'audio' | 'video' | 'general'>('audio');
    const [volume, setVolume] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Audio Meter Logic
    useEffect(() => {
        if (isOpen && activeTab === 'audio') {
            const startMeter = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: selectedAudioId ? { deviceId: { exact: selectedAudioId } } : true
                    });
                    streamRef.current = stream;

                    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const analyser = audioContext.createAnalyser();
                    const source = audioContext.createMediaStreamSource(stream);
                    source.connect(analyser);
                    analyser.fftSize = 256;

                    audioContextRef.current = audioContext;
                    analyserRef.current = analyser;

                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);

                    const updateMeter = () => {
                        if (!analyserRef.current) return;
                        analyserRef.current.getByteFrequencyData(dataArray);
                        let sum = 0;
                        for (let i = 0; i < bufferLength; i++) {
                            sum += dataArray[i];
                        }
                        const average = sum / bufferLength;
                        setVolume(average);
                        requestAnimationFrame(updateMeter);
                    };
                    updateMeter();
                } catch (err) {
                    console.error('Error starting audio meter:', err);
                }
            };
            startMeter();
        }

        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            audioContextRef.current?.close();
            analyserRef.current = null;
        };
    }, [isOpen, activeTab, selectedAudioId]);

    // Video Preview Logic
    useEffect(() => {
        if (isOpen && activeTab === 'video') {
            const startPreview = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error('Error starting video preview:', err);
                }
            };
            startPreview();
        }
    }, [isOpen, activeTab, selectedVideoId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-bg-card border border-white/10 w-full max-w-2xl rounded-[2rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[500px]">
                {/* Sidebar */}
                <div className="w-full md:w-64 bg-white/5 p-6 flex flex-col gap-2 border-r border-white/5">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Settings size={20} className="text-accent" />
                        Settings
                    </h2>

                    <button
                        onClick={() => setActiveTab('audio')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'audio' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}
                    >
                        <Mic size={18} /> Audio
                    </button>
                    <button
                        onClick={() => setActiveTab('video')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'video' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}
                    >
                        <Video size={18} /> Video
                    </button>
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'general' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}
                    >
                        <Speaker size={18} /> General
                    </button>

                    <div className="mt-auto">
                        <button
                            onClick={onClose}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all"
                        >
                            Done
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-8 overflow-y-auto">
                    {activeTab === 'audio' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-sm font-bold text-text-secondary mb-3 uppercase tracking-wider">Microphone</label>
                                <select
                                    value={selectedAudioId}
                                    onChange={(e) => onAudioDeviceChange(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                >
                                    {audioDevices.map(d => (
                                        <option key={d.deviceId} value={d.deviceId} className="bg-bg-card">{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div className={`p-3 rounded-xl ${volume > 10 ? 'bg-accent/20 text-accent animate-pulse' : 'bg-white/5 text-text-secondary'}`}>
                                    <Mic size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-accent transition-all duration-75"
                                            style={{ width: `${Math.min(100, volume * 3)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'video' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <label className="block text-sm font-bold text-text-secondary mb-3 uppercase tracking-wider">Camera</label>
                                <select
                                    value={selectedVideoId}
                                    onChange={(e) => onVideoDeviceChange(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                                >
                                    {videoDevices.map(d => (
                                        <option key={d.deviceId} value={d.deviceId} className="bg-bg-card">{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-lg relative group">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className={`w-full h-full object-cover ${isMirrored ? 'mirror' : ''}`}
                                />
                                <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-bold text-white tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-all">
                                    Camera Preview
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all" onClick={() => onMirrorToggle(!isMirrored)}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isMirrored ? 'bg-accent/20 text-accent' : 'bg-white/5 text-text-secondary'}`}>
                                        <FlipHorizontal size={18} />
                                    </div>
                                    <span className="text-sm font-semibold">Mirror my video</span>
                                </div>
                                <div className={`w-10 h-5 rounded-full transition-all relative ${isMirrored ? 'bg-accent' : 'bg-white/10'}`}>
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isMirrored ? 'right-1' : 'left-1'}`} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div className="p-8 flex flex-col items-center justify-center text-center gap-4 opacity-40">
                                <Volume2 size={48} className="text-text-secondary" />
                                <p className="text-sm font-medium">Speaker selection is currently managed by your system's default output.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
