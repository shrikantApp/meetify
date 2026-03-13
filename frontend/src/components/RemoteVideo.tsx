import { useEffect, useRef } from 'react';

interface RemoteVideoProps {
    stream: MediaStream;
    className?: string;
    isScreenShare?: boolean;
}

/**
 * RemoteVideo Component
 * --------------------
 * Renders remote participant streams or screen shares.
 * Screen shares and remote peers are NEVER mirrored.
 */
export default function RemoteVideo({ stream, className = "", isScreenShare }: RemoteVideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            console.log(`[WebRTC] RemoteVideo updating srcObject for ${isScreenShare ? 'ScreenShare' : 'Camera'}`);
            videoRef.current.srcObject = stream;
        }
    }, [stream, isScreenShare]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            className={`remoteVideo ${isScreenShare ? 'screenShare' : ''} ${className}`}
        />
    );
}
