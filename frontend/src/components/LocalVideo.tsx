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
            console.log(`[LocalVideo] Updating srcObject. Tracks:`, stream.getTracks().map(t => t.kind));
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    // Only mirror if it's NOT a screen share AND mirrored is preferred
    const shouldMirror = !isScreenShare && isMirrored;

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`localVideo ${shouldMirror ? 'mirrored' : ''} ${className}`}
        />
    );
}
