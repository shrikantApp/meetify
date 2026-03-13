import { useState, useRef, useCallback } from 'react';
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
    const screenStreamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            // 1. Capture Screen
            // Note: On some browsers and OS, audio: true might fail if no audio source is selected
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { 
                    displaySurface: 'browser', // Hint for best experience
                    frameRate: { ideal: 30, max: 60 } 
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            }).catch(e => {
                if (e.name === 'NotAllowedError') {
                    throw new Error('Permission to share screen was denied. Please allow screen sharing to record.');
                }
                throw e;
            });

            screenStreamRef.current = screenStream;

            // 2. Prepare Audio Merging
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            await audioCtx.resume();
            const destination = audioCtx.createMediaStreamDestination();

            // Source 1: System/Tab Audio from getDisplayMedia
            const systemAudioTracks = screenStream.getAudioTracks();
            if (systemAudioTracks.length > 0) {
                const systemSource = audioCtx.createMediaStreamSource(new MediaStream([systemAudioTracks[0]]));
                systemSource.connect(destination);
            }

            // Source 2: Local Microphone
            if (localStream && localStream.active) {
                const micTracks = localStream.getAudioTracks();
                if (micTracks.length > 0) {
                    const localSource = audioCtx.createMediaStreamSource(new MediaStream([micTracks[0]]));
                    localSource.connect(destination);
                }
            }

            // Source 3: Remote Participants
            peers.forEach(peer => {
                if (peer.stream && peer.stream.active) {
                    const peerAudioTracks = peer.stream.getAudioTracks();
                    if (peerAudioTracks.length > 0) {
                        const peerSource = audioCtx.createMediaStreamSource(new MediaStream([peerAudioTracks[0]]));
                        peerSource.connect(destination);
                    }
                }
            });

            // Combine Screen Video + All Merged Audio
            const combinedTracks = [
                ...screenStream.getVideoTracks(),
                ...destination.stream.getAudioTracks()
            ];
            const combinedStream = new MediaStream(combinedTracks);

            chunksRef.current = [];
            let mimeType = 'video/webm;codecs=vp8,opus';
            let extension = '.webm';

            if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,opus')) {
                mimeType = 'video/mp4;codecs=h264,opus';
                extension = '.mp4';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                mimeType = 'video/webm;codecs=vp8,opus';
                extension = '.webm';
            }

            const recorder = new MediaRecorder(combinedStream, { 
                mimeType,
                videoBitsPerSecond: 2500000 // 2.5 Mbps for decent quality
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

                setIsRecording(false); // UI state update earlier

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

                // Cleanup
                screenStreamRef.current?.getTracks().forEach(t => t.stop());
                screenStreamRef.current = null;
                if (audioCtx.state !== 'closed') {
                    void audioCtx.close();
                }
            };

            // Stop recording if the user stops sharing the screen via browser UI
            screenStream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };

            recorder.start(1000); 
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
    }, [socket, meetingCode, meetingId, hostId]);

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
            // Optional: emit sync event if needed
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
