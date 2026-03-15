import { useEffect, useRef } from 'react';

interface LocalVideoProps {
    stream: MediaStream;
    className?: string;
    isMirrored?: boolean;
    isScreenShare?: boolean;
}

/**
 * LocalVideo Component
 * -------------------
 * Renders the local user's camera stream with a mirror effect.
 * Always muted to prevent feedback loops.
 */
export default function LocalVideo({ stream, className = "", isMirrored = true, isScreenShare }: LocalVideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`localVideo ${isMirrored ? 'mirrored' : ''} ${className}`}
        />
    );
}
