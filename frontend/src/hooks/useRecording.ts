import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import axios from 'axios';

interface UseRecordingProps {
    socket: Socket | null;
    meetingCode: string;
    meetingId: string;
    hostId: string;
    localStream: MediaStream | null;
    peers: any[]; // RemotePeer[]
}

export function useRecording({ socket, meetingCode, meetingId, hostId, localStream, peers }: UseRecordingProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const clearError = () => setError(null);
    const durationRef = useRef(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);
    const drawTimerRef = useRef<any>(null);

    // Audio context refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const sourceNodesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());

    // Canvas ref
    const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Track active video elements in the DOM via a data attribute or class
    const getParticipantTiles = () => {
        return Array.from(document.querySelectorAll('.participant-video')) as HTMLElement[];
    };

    // Initialize hidden canvas
    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        canvas.style.position = 'fixed'; // Do not use display: none or opacity: 0
        canvas.style.left = '-9999px';
        canvas.style.top = '-9999px';
        canvas.style.pointerEvents = 'none';
        document.body.appendChild(canvas);
        hiddenCanvasRef.current = canvas;

        // Force initial paint so captureStream initializes properly
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#0d0f18';
            ctx.fillRect(0, 0, 1280, 720);
        }

        return () => {
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        };
    }, []);

    const drawGrid = useCallback(() => {
        if (!hiddenCanvasRef.current || !isRecording || isPaused) return;

        const canvas = hiddenCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background color (bg-primary)
        ctx.fillStyle = '#0d0f18';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // --- Grid Area ---
        const gridY = 80;
        const gridHeight = canvas.height - 80 - 120; // Leave space for header and floating controls
        const gridWidth = canvas.width - 64; // px-8 (32px) on both sides
        const gridStartX = 32;

        const tiles = getParticipantTiles();
        const count = tiles.length;

        // Draw the background for video grid area (we just draw tiles)
        if (count > 0) {
            let cols = 1;
            let rows = 1;

            if (count > 1 && count <= 4) {
                cols = 2;
                rows = Math.ceil(count / 2);
            } else if (count > 4 && count <= 9) {
                cols = 3;
                rows = Math.ceil(count / 3);
            } else if (count > 9) {
                cols = 4;
                rows = Math.ceil(count / 4);
            }

            const cellWidth = gridWidth / cols;
            const cellHeight = gridHeight / rows;

            tiles.forEach((tile, index) => {
                const col = index % cols;
                const row = Math.floor(index / cols);
                const x = gridStartX + (col * cellWidth);
                const y = gridY + (row * cellHeight);

                // Add padding/gap
                const padding = 10;
                const rx = x + padding;
                const ry = y + padding;
                const rw = cellWidth - padding * 2;
                const rh = cellHeight - padding * 2;

                // Border matching UI (bg-card border-white/5 or active speaker accent border)
                ctx.fillStyle = '#1a1e35'; // bg-card
                ctx.beginPath();
                ctx.roundRect(rx, ry, rw, rh, 16);
                ctx.fill();

                ctx.strokeStyle = '#6c63ff'; // accent color thin border representation
                ctx.lineWidth = 1;
                ctx.stroke();
                
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(rx, ry, rw, rh, 16);
                ctx.clip();
                
                // Draw Inner Box
                const video = tile.querySelector('video');
                const isCamOn = tile.getAttribute('data-iscamon') === 'true';
                const userName = tile.getAttribute('data-username') || 'Participant';
                const isLocalTile = tile.getAttribute('data-islocal') === 'true';
                const isMirrored = tile.getAttribute('data-ismirrored') === 'true';

                if (video && video.readyState >= 2 && isCamOn) {
                    // Draw video
                    const videoRatio = video.videoWidth / video.videoHeight;
                    const cellRatio = rw / rh;
                    
                    let drawWidth = rw;
                    let drawHeight = rh;
                    let drawX = rx;
                    let drawY = ry;

                    if (videoRatio && cellRatio) {
                        if (videoRatio > cellRatio) {
                            drawWidth = rh * videoRatio;
                            drawX = rx - (drawWidth - rw) / 2;
                        } else {
                            drawHeight = rw / videoRatio;
                            drawY = ry - (drawHeight - rh) / 2;
                        }
                    }

                    try {
                         ctx.save();
                         // Apply flip transform if mirrored (like local webcam)
                         if (isMirrored) {
                             ctx.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
                             ctx.scale(-1, 1);
                             ctx.translate(-(drawX + drawWidth / 2), -(drawY + drawHeight / 2));
                         }
                         ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
                         ctx.restore();
                    } catch(e) { /* ignore */ }
                } else {
                    // Draw Placeholder Avatar
                    // Background is already bg-card. Let's add slight gradient mock
                    const grad = ctx.createLinearGradient(rx, ry, rx+rw, ry+rh);
                    grad.addColorStop(0, '#13162b'); // bg-secondary
                    grad.addColorStop(1, '#1a1e35'); // bg-card
                    ctx.fillStyle = grad;
                    ctx.fillRect(rx, ry, rw, rh);
                    
                    const cx = rx + rw / 2;
                    const cy = ry + rh / 2; // Center Vertically

                    ctx.beginPath();
                    ctx.arc(cx, cy - 10, 48, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(108, 99, 255, 0.2)'; // accent/20
                    ctx.fill();
                    
                    ctx.fillStyle = '#6c63ff'; // accent
                    ctx.font = 'bold 36px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(userName[0]?.toUpperCase() || 'U', cx, cy - 10);
                    
                    // CAMERA IS OFF badge
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                    ctx.beginPath();
                    ctx.roundRect(cx - 50, cy + 60, 100, 24, 12);
                    ctx.fill();
                    
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // text-white/60
                    ctx.font = 'bold 10px Arial';
                    ctx.fillText('CAMERA IS OFF', cx, cy + 61); 
                }
                
                ctx.restore();

                // Draw Name Overlay Bottom Left
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // black/40
                ctx.beginPath();
                
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                const label = `${userName} ${isLocalTile ? '(You)' : ''}`;
                ctx.roundRect(rx + 16, ry + rh - 44, ctx.measureText(label).width + 24, 28, 10);
                ctx.fill();
                
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.stroke();

                ctx.fillStyle = 'white';
                ctx.font = 'bold 12px Arial';
                ctx.fillText(label, rx + 28, ry + rh - 30);
            });
        }

        // --- Header Mockup ---
        // Top left
        ctx.fillStyle = '#6c63ff'; // accent
        ctx.beginPath();
        ctx.roundRect(32, 16, 40, 40, 12);
        ctx.fill();
        ctx.fillStyle = 'white';
        // Icon fake: camera lens
        ctx.beginPath();
        ctx.roundRect(42, 28, 14, 12, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(56, 30);
        ctx.lineTo(62, 26);
        ctx.lineTo(62, 42);
        ctx.lineTo(56, 38);
        ctx.fill();

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('STANDERED', 84, 18);

        // Subtitle
        ctx.fillStyle = '#6c63ff'; // accent text
        ctx.font = 'bold 10px Arial, sans-serif';
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(`${meetingCode ? meetingCode.toUpperCase() : 'MEETING'} • ${timeStr}`, 84, 42);

        // Top right buttons
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(canvas.width - 290, 20, 50, 32, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(`👥 ${count + 1}`, canvas.width - 265, 36);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(canvas.width - 228, 20, 80, 32, 16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText('ⓘ Details', canvas.width - 188, 36);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(canvas.width - 136, 20, 104, 32, 16);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText('⚙ Host Controls', canvas.width - 84, 36);


        // --- Floating Bottom Bar Mockup ---
        const pillWidth = 540;
        const pillHeight = 72;
        const pillX = canvas.width / 2 - pillWidth / 2;
        const pillY = canvas.height - pillHeight - 24; // bottom-6

        // bg-card/40 backdrop-blur mock (just dark card)
        ctx.fillStyle = '#1a1e35'; 
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 36);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; // border-white/10
        ctx.lineWidth = 1;
        ctx.stroke();

        let currentOffsetX = pillX + 24;

        // Group 1: Mic/Cam
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath(); ctx.arc(currentOffsetX + 20, pillY + 36, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.fillText('🎤', currentOffsetX + 20, pillY + 36);
        currentOffsetX += 48;

        ctx.fillStyle = '#e05250'; // accent-danger logic
        ctx.beginPath(); ctx.arc(currentOffsetX + 20, pillY + 36, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.fillText('📷', currentOffsetX + 20, pillY + 36);
        currentOffsetX += 56;

        // Divider
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath(); ctx.moveTo(currentOffsetX, pillY + 16); ctx.lineTo(currentOffsetX, pillY + pillHeight - 16); ctx.stroke();
        currentOffsetX += 16;

        // Group 2: Present, Hand, Settings, Record
        const numFeature = 4;
        for (let i = 0; i < numFeature; i++) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath(); ctx.arc(currentOffsetX + 20, pillY + 36, 20, 0, Math.PI * 2); ctx.fill();
            if (i===0) { ctx.fillStyle = 'white'; ctx.fillText('💻', currentOffsetX + 20, pillY + 36); }
            if (i===1) { ctx.fillStyle = 'white'; ctx.fillText('✋', currentOffsetX + 20, pillY + 36); }
            if (i===2) { ctx.fillStyle = 'white'; ctx.fillText('⚙', currentOffsetX + 20, pillY + 36); }
            if (i===3) { 
                ctx.fillStyle = 'transparent'; 
                ctx.strokeStyle = 'white'; 
                ctx.beginPath(); ctx.arc(currentOffsetX + 20, pillY + 36, 12, 0, Math.PI * 2); ctx.stroke(); 
            }
            currentOffsetX += 48;
        }

        currentOffsetX += 8;
        // Divider
        ctx.beginPath(); ctx.moveTo(currentOffsetX, pillY + 16); ctx.lineTo(currentOffsetX, pillY + pillHeight - 16); ctx.stroke();
        currentOffsetX += 16;

        // Group 3: Users, End Call
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath(); ctx.arc(currentOffsetX + 20, pillY + 36, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.fillText('👥', currentOffsetX + 20, pillY + 36);
        currentOffsetX += 48;

        ctx.fillStyle = '#e05250'; // danger
        ctx.beginPath(); ctx.arc(currentOffsetX + 20, pillY + 36, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.fillText('📞', currentOffsetX + 20, pillY + 36);

    }, [isRecording, isPaused]);

    // Start drawing loop when recording starts
    useEffect(() => {
        if (isRecording && !isPaused) {
            drawTimerRef.current = setInterval(drawGrid, 33); // ~30fps
        } else if (drawTimerRef.current) {
            clearInterval(drawTimerRef.current);
        }
        return () => {
            if (drawTimerRef.current) clearInterval(drawTimerRef.current);
        };
    }, [isRecording, isPaused, drawGrid]);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            if (!hiddenCanvasRef.current) throw new Error("Canvas not initialized");

            // 1. Setup AudioContext and mixing
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            await audioCtx.resume();
            audioCtxRef.current = audioCtx;

            const destination = audioCtx.createMediaStreamDestination();
            audioDestinationRef.current = destination;
            sourceNodesRef.current.clear();

            const connectStream = (stream: MediaStream, id: string) => {
                if (stream.getAudioTracks().length > 0) {
                    try {
                        // Create source directly from stream to avoid track parsing issues
                        const source = audioCtx.createMediaStreamSource(stream);
                        source.connect(destination);
                        sourceNodesRef.current.set(id, source);
                    } catch (e) {
                         console.warn("Failed to connect audio source", id, e);
                    }
                }
            };

            // Connect local mic
            if (localStream) connectStream(localStream, 'local');

            // Connect remote peers
            peers.forEach(peer => {
                if (peer.stream) connectStream(peer.stream, peer.socketId);
            });

            // Force an initial draw before capturing so it's not a black frame
            if (hiddenCanvasRef.current) {
                const ctx = hiddenCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#0d0f18';
                    ctx.fillRect(0, 0, hiddenCanvasRef.current.width, hiddenCanvasRef.current.height);
                }
            }

            // 2. Capture Canvas Stream
            const canvasStream = hiddenCanvasRef.current.captureStream(30);

            // 3. Combine Streams
            const mixedAudioTracks = destination.stream.getAudioTracks();
            if (mixedAudioTracks.length > 0) {
                canvasStream.addTrack(mixedAudioTracks[0]);
            }

            // 4. Start MediaRecorder
            chunksRef.current = [];
            let mimeType = 'video/webm;codecs=vp8,opus';
            let extension = '.webm';

            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                mimeType = 'video/webm;codecs=vp9,opus';
            } else if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
            }

            const recorder = new MediaRecorder(canvasStream, {
                mimeType,
                videoBitsPerSecond: 2500000 // 2.5 Mbps
            });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                const formData = new FormData();
                formData.append('recordingFile', blob, `recording-${Date.now()}${extension}`);
                formData.append('meetingId', meetingId);
                formData.append('hostId', hostId);
                formData.append('duration', durationRef.current.toString());

                setIsRecording(false); 

                try {
                    await axios.post('/api/meeting-recording', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity
                    });
                    console.log('[Recording] Uploaded successfully');
                } catch (err: any) {
                    console.error('[Recording] Upload failed', err);
                    setError(err.response?.data?.message || 'Failed to upload recording to server.');
                }

                // Cleanup Audio Phase
                if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                    sourceNodesRef.current.forEach(node => node.disconnect());
                    sourceNodesRef.current.clear();
                    void audioCtxRef.current.close();
                }
            };

            recorder.start(1000); // 1s chunks
            setIsRecording(true);
            setIsPaused(false);
            setRecordingDuration(0);
            durationRef.current = 0;

            timerRef.current = setInterval(() => {
                setRecordingDuration((prev) => {
                    const next = prev + 1;
                    durationRef.current = next;
                    return next;
                });
            }, 1000);

            socket?.emit('host-action', { roomId: meetingCode, action: 'recording-start' });

        } catch (err: any) {
            console.error('[Recording] Failed to start', err);
            setError(err.message || 'An unexpected error occurred while starting the recording.');
            setIsRecording(false);
        }
    }, [socket, meetingCode, meetingId, hostId, localStream, peers]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            if (timerRef.current) clearInterval(timerRef.current);
            socket?.emit('host-action', { roomId: meetingCode, action: 'recording-stop' });
        }
    }, [socket, meetingCode]);

    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setIsPaused(true);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, []);

    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setIsPaused(false);
            timerRef.current = setInterval(() => {
                setRecordingDuration((prev) => {
                    const next = prev + 1;
                    durationRef.current = next;
                    return next;
                });
            }, 1000);
        }
    }, []);

    // Effect to dynamically add/remove audio tracks as peers join/leave or local/remote tracks change during recording
    useEffect(() => {
        if (!isRecording || isPaused || !audioCtxRef.current || !audioDestinationRef.current) return;

        const ctx = audioCtxRef.current;
        const dest = audioDestinationRef.current;
        const currentSources = sourceNodesRef.current;

        // 1. Handle Local Stream track updates
        if (localStream) {
            const localAudioTrack = localStream.getAudioTracks()[0];
            const existingLocalNode = currentSources.get('local');
            
            // Check if we need to update/reconnect local audio
            // @ts-ignore - reaching into the node to check its stream's track ID if possible, 
            // but safer to just check if the track ID we have in the source matches the current one.
            const needsUpdate = !existingLocalNode || 
                               (localAudioTrack && !localStream.getAudioTracks().some(t => t.id === (existingLocalNode as any).mediaStream?.getAudioTracks()[0]?.id));

            if (needsUpdate && localAudioTrack && localAudioTrack.enabled) {
                if (existingLocalNode) {
                    existingLocalNode.disconnect();
                    currentSources.delete('local');
                }
                try {
                    const source = ctx.createMediaStreamSource(new MediaStream([localAudioTrack]));
                    source.connect(dest);
                    currentSources.set('local', source);
                    // Store the track ID for future comparison
                    (source as any).trackId = localAudioTrack.id;
                } catch (e) {
                    console.warn("[Recording] Failed to connect local audio source", e);
                }
            } else if (!localAudioTrack && existingLocalNode) {
                existingLocalNode.disconnect();
                currentSources.delete('local');
            }
        }

        // 2. Handle Remote Peer track updates
        const activeIds = new Set(peers.map(p => p.socketId));
        activeIds.add('local');

        peers.forEach(peer => {
            if (peer.stream) {
                const peerAudioTrack = peer.stream.getAudioTracks()[0];
                const existingSource = currentSources.get(peer.socketId);
                
                const needsUpdate = !existingSource || 
                                   (peerAudioTrack && (existingSource as any).trackId !== peerAudioTrack.id);

                if (needsUpdate && peerAudioTrack) {
                    if (existingSource) {
                        existingSource.disconnect();
                        currentSources.delete(peer.socketId);
                    }
                    try {
                        const source = ctx.createMediaStreamSource(new MediaStream([peerAudioTrack]));
                        source.connect(dest);
                        currentSources.set(peer.socketId, source);
                        (source as any).trackId = peerAudioTrack.id;
                    } catch (e) {
                        console.warn("[Recording] Failed to connect remote audio source", peer.socketId, e);
                    }
                }
            }
        });

        // 3. Cleanup lost peers
        currentSources.forEach((source, id) => {
            if (!activeIds.has(id)) {
                source.disconnect();
                currentSources.delete(id);
            }
        });

    }, [peers, localStream, isRecording, isPaused]);

    return {
        isRecording,
        isPaused,
        recordingDuration,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        error,
        clearError,
    };
}
