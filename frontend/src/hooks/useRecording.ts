import { useState, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import axios from 'axios';

interface UseRecordingProps {
    socket: Socket | null;
    roomId: string;
    hostId: string;
    localStream: MediaStream | null;
    peers: any[]; // RemotePeer[]
}

export function useRecording({ socket, roomId, hostId, localStream, peers }: UseRecordingProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const durationRef = useRef(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);

    const startRecording = useCallback(async () => {
        try {
            // 1. Capture Screen
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: 30 },
                audio: true // System/Tab audio
            });
            screenStreamRef.current = screenStream;

            // 2. Prepare Audio Merging
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const destination = audioCtx.createMediaStreamDestination();

            // Source 1: System/Tab Audio from getDisplayMedia
            if (screenStream.getAudioTracks().length > 0) {
                const systemSource = audioCtx.createMediaStreamSource(new MediaStream([screenStream.getAudioTracks()[0]]));
                systemSource.connect(destination);
            }

            // Source 2: Local Microphone
            if (localStream && localStream.getAudioTracks().length > 0) {
                const localMicTrack = localStream.getAudioTracks().find(t => !t.label.includes('Silent'));
                if (localMicTrack) {
                    const localSource = audioCtx.createMediaStreamSource(new MediaStream([localMicTrack]));
                    localSource.connect(destination);
                }
            }

            // Source 3: Remote Participants
            peers.forEach(peer => {
                if (peer.stream && peer.stream.getAudioTracks().length > 0) {
                    const peerSource = audioCtx.createMediaStreamSource(peer.stream);
                    peerSource.connect(destination);
                }
            });

            // Combine Screen Video + All Merged Audio
            const combinedTracks = [
                ...screenStream.getVideoTracks(),
                ...destination.stream.getAudioTracks()
            ];
            const combinedStream = new MediaStream(combinedTracks);

            chunksRef.current = [];
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                ? 'video/webm;codecs=vp9,opus'
                : 'video/webm';

            const recorder = new MediaRecorder(combinedStream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                const formData = new FormData();
                formData.append('recordingFile', blob, `recording-${Date.now()}.webm`);
                formData.append('meetingId', roomId);
                formData.append('hostId', hostId);
                formData.append('duration', durationRef.current.toString());

                try {
                    await axios.post('/api/meeting-recording', formData);
                    console.log('[Recording] Uploaded successfully');
                } catch (err) {
                    console.error('[Recording] Upload failed', err);
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

            recorder.start(1000); // 1 second chunks for reliability
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

            socket?.emit('host-action', { roomId, action: 'recording-start' });

        } catch (err) {
            console.error('[Recording] Failed to start', err);
        }
    }, [socket, roomId, hostId]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
            if (timerRef.current) clearInterval(timerRef.current);
            socket?.emit('host-action', { roomId, action: 'recording-stop' });
        }
    }, [socket, roomId]);

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
    };
}
