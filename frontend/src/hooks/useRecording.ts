import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import axios from 'axios';

interface UseRecordingProps {
    socket: Socket | null;
    meetingCode: string;
    meetingId: string;
    meetingTitle: string;
    hostId: string;
    localStream: MediaStream | null;
    peers: any[]; // RemotePeer[]
    isMicOn: boolean;
    isCamOn: boolean;
    isScreenSharing: boolean;
    layoutMode: 'grid' | 'spotlight';
    spotlightId: string | null;
    localCameraStream?: MediaStream | null; // For local PiP
    activeSpeakerId?: string | null;
}

export function useRecording({
    socket, meetingCode, meetingId, meetingTitle, hostId,
    localStream, peers, isMicOn, isCamOn, isScreenSharing,
    layoutMode, spotlightId, localCameraStream, activeSpeakerId
}: UseRecordingProps) {
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

    const drawTile = (
        ctx: CanvasRenderingContext2D,
        tile: HTMLElement,
        rx: number,
        ry: number,
        rw: number,
        rh: number
    ) => {
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
        const isScreenShare = tile.getAttribute('data-isscreenshare') === 'true';
        const userName = tile.getAttribute('data-username') || 'Participant';
        const isLocalTile = tile.getAttribute('data-islocal') === 'true';
        const isMirrored = tile.getAttribute('data-ismirrored') === 'true';

        if (video && video.readyState >= 2 && (isCamOn || isScreenShare)) {
            // Draw video
            const videoRatio = video.videoWidth / video.videoHeight;
            const cellRatio = rw / rh;

            let drawWidth = rw;
            let drawHeight = rh;
            let drawX = rx;
            let drawY = ry;

            if (videoRatio && cellRatio) {
                if (isScreenShare) {
                    // Contain-fit: letterbox the screen share
                    if (videoRatio > cellRatio) {
                        drawHeight = rw / videoRatio;
                        drawY = ry + (rh - drawHeight) / 2;
                        drawWidth = rw;
                        drawX = rx;
                    } else {
                        drawWidth = rh * videoRatio;
                        drawX = rx + (rw - drawWidth) / 2;
                        drawHeight = rh;
                        drawY = ry;
                    }
                } else {
                    // Object-cover: crop to fill
                    if (videoRatio > cellRatio) {
                        drawWidth = rh * videoRatio;
                        drawX = rx - (drawWidth - rw) / 2;
                    } else {
                        drawHeight = rw / videoRatio;
                        drawY = ry - (drawHeight - rh) / 2;
                    }
                }
            }

            try {
                ctx.save();
                if (isMirrored && !isScreenShare) {
                    ctx.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
                    ctx.scale(-1, 1);
                    ctx.translate(-(drawX + drawWidth / 2), -(drawY + drawHeight / 2));
                }
                ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
                ctx.restore();
            } catch (e) { /* ignore */ }
        } else {
            // Placeholder
            const grad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
            grad.addColorStop(0, '#13162b');
            grad.addColorStop(1, '#1a1e35');
            ctx.fillStyle = grad;
            ctx.fillRect(rx, ry, rw, rh);

            const cx = rx + rw / 2;
            const cy = ry + rh / 2;

            ctx.beginPath();
            ctx.arc(cx, cy - 10, 48, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(108, 99, 255, 0.2)';
            ctx.fill();

            ctx.fillStyle = '#6c63ff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(userName[0]?.toUpperCase() || 'U', cx, cy - 10);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.roundRect(cx - 50, cy + 60, 100, 24, 12);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.font = 'bold 10px Arial';
            ctx.fillText('CAMERA IS OFF', cx, cy + 61);
        }

        ctx.restore();

        // Draw Name Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const label = `${userName} ${isLocalTile ? '(You)' : ''}`;
        const labelWidth = ctx.measureText(label).width;
        ctx.roundRect(rx + 16, ry + rh - 44, labelWidth + 24, 28, 10);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(label, rx + 28, ry + rh - 30);
    };

    const drawGrid = useCallback(() => {
        if (!hiddenCanvasRef.current || !isRecording || isPaused) return;

        const canvas = hiddenCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background
        ctx.fillStyle = '#0d0f18';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gridY = 80;
        const gridHeight = canvas.height - 80 - 120;
        const gridWidth = canvas.width - 64;
        const gridStartX = 32;

        const tiles = getParticipantTiles();
        const count = tiles.length;

        if (layoutMode === 'grid' || count === 0) {
            const count = tiles.length;
            if (count > 0) {
                let cols = 1;
                let rows = 1;
                if (count > 1 && count <= 4) { cols = 2; rows = Math.ceil(count / 2); }
                else if (count > 4 && count <= 9) { cols = 3; rows = Math.ceil(count / 3); }
                else if (count > 9) { cols = 4; rows = Math.ceil(count / 4); }

                const cellWidth = gridWidth / cols;
                const cellHeight = gridHeight / rows;

                tiles.forEach((tile, index) => {
                    const col = index % cols;
                    const row = Math.floor(index / cols);
                    const rx = gridStartX + (col * cellWidth) + 10;
                    const ry = gridY + (row * cellHeight) + 10;
                    const rw = cellWidth - 20;
                    const rh = cellHeight - 20;
                    drawTile(ctx, tile, rx, ry, rw, rh);
                });
            }
        } else {
            // SPOTLIGHT MODE
            const stripWidth = 240;
            const spotlightWidth = gridWidth - stripWidth - 20;
            const spotlightHeight = gridHeight;

            const spotlightTile = tiles.find(t => t.getAttribute('data-isspotlight') === 'true') || tiles[0];
            const otherTiles = tiles.filter(t => t !== spotlightTile);

            // 1. Draw Spotlight
            drawTile(ctx, spotlightTile, gridStartX, gridY, spotlightWidth, spotlightHeight);

            // 2. Draw strip
            if (otherTiles.length > 0) {
                const stripX = gridStartX + spotlightWidth + 20;
                // Draw up to 5 visible others in the strip
                const stripTilesCount = Math.min(otherTiles.length, 5);
                const stripTileHeight = (gridHeight - (stripTilesCount - 1) * 10) / stripTilesCount;

                otherTiles.slice(0, stripTilesCount).forEach((tile, index) => {
                    const ry = gridY + index * (stripTileHeight + 10);
                    drawTile(ctx, tile, stripX, ry, stripWidth, stripTileHeight);
                });
            }

            // 3. PiP Overlay: If spotlight is a screen share, check if sharer has a camera tile
            const isSpotlightScreen = spotlightTile.getAttribute('data-isscreenshare') === 'true';
            if (isSpotlightScreen) {
                let userName = spotlightTile.getAttribute('data-username') || '';
                // Strip "'s Screen" for name matching to find the camera tile
                const matchName = userName.replace("'s Screen", "").trim();

                const cameraTile = tiles.find(t => 
                    (t.getAttribute('data-username') === matchName || t.getAttribute('data-username') === userName) && 
                    t.getAttribute('data-isscreenshare') !== 'true' &&
                    t.getAttribute('data-iscamon') === 'true'
                );

                if (cameraTile) {
                    const pipWidth = 200;
                    const pipHeight = (pipWidth * 9) / 16;
                    const pipX = gridStartX + spotlightWidth - pipWidth - 20;
                    const pipY = gridY + spotlightHeight - pipHeight - 20;
                    
                    ctx.save();
                    // Draw PiP border/shadow
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 20;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 10;
                    
                    ctx.fillStyle = '#0d0f18';
                    ctx.beginPath();
                    ctx.roundRect(pipX, pipY, pipWidth, pipHeight, 16);
                    ctx.fill();
                    
                    ctx.save();
                    ctx.clip();
                    
                    const video = cameraTile.querySelector('video');
                    if (video && video.readyState >= 2) {
                        // Fit cover
                        const videoRatio = video.videoWidth / video.videoHeight;
                        const pipRatio = pipWidth / pipHeight;
                        let dw = pipWidth, dh = pipHeight, dx = pipX, dy = pipY;
                        
                        if (videoRatio > pipRatio) {
                            dw = pipHeight * videoRatio;
                            dx = pipX - (dw - pipWidth) / 2;
                        } else {
                            dh = pipWidth / videoRatio;
                            dy = pipY - (dh - pipHeight) / 2;
                        }

                        const isMirrored = cameraTile.getAttribute('data-ismirrored') === 'true';
                        if (isMirrored) {
                            ctx.translate(dx + dw / 2, dy + dh / 2);
                            ctx.scale(-1, 1);
                            ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
                        }
                        ctx.drawImage(video, dx, dy, dw, dh);
                    }
                    ctx.restore();
                    
                    ctx.strokeStyle = 'rgba(108, 99, 255, 0.4)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // HEADER — matches MeetingRoomPage.tsx header layout
        // ═══════════════════════════════════════════════════════════════
        const hdrY = 16;

        // Logo icon (accent rounded square with camera icon)
        ctx.fillStyle = '#6c63ff';
        ctx.beginPath();
        ctx.roundRect(32, hdrY, 40, 40, 12);
        ctx.fill();
        // Camera icon inside logo
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'transparent';
        ctx.beginPath();
        ctx.roundRect(40, hdrY + 12, 16, 14, 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(56, hdrY + 14);
        ctx.lineTo(64, hdrY + 10);
        ctx.lineTo(64, hdrY + 30);
        ctx.lineTo(56, hdrY + 26);
        ctx.closePath();
        ctx.stroke();

        // Meeting title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Inter, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(meetingTitle || 'Meeting Room', 84, hdrY + 2);

        // Meeting code • time subtitle
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        ctx.fillStyle = '#6c63ff';
        ctx.font = 'bold 10px Inter, Arial, sans-serif';
        ctx.fillText(meetingCode ? meetingCode.toUpperCase() : '', 84, hdrY + 24);
        // Dot separator
        const codeWidth = ctx.measureText(meetingCode ? meetingCode.toUpperCase() : '').width;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(84 + codeWidth + 8, hdrY + 29, 2, 0, Math.PI * 2);
        ctx.fill();
        // Time
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '500 10px Inter, Arial, sans-serif';
        ctx.fillText(timeStr, 84 + codeWidth + 16, hdrY + 24);

        // Right side header items
        const rightX = canvas.width - 32;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Recording indicator (red dot + "Recording")
        const recBadgeW = 100;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.beginPath();
        ctx.roundRect(rightX - recBadgeW - 80, hdrY + 6, recBadgeW, 28, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Red dot
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(rightX - recBadgeW - 80 + 16, hdrY + 20, 4, 0, Math.PI * 2);
        ctx.fill();
        // "REC" text
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px Inter, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('RECORDING', rightX - recBadgeW - 80 + 26, hdrY + 23);

        // Participant count badge
        const countText = `${count}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.roundRect(rightX - 68, hdrY + 4, 60, 32, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.stroke();
        // User icon (simple silhouette)
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        const uIconX = rightX - 50;
        const uIconY = hdrY + 20;
        ctx.beginPath();
        ctx.arc(uIconX, uIconY - 4, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(uIconX, uIconY + 8, 9, Math.PI + 0.4, -0.4);
        ctx.stroke();
        // Count number
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 13px Inter, Arial, sans-serif';
        ctx.fillText(countText, rightX - 24, hdrY + 20);

        // ═══════════════════════════════════════════════════════════════
        // FLOATING BOTTOM CONTROL BAR — matches MeetingControls.tsx
        // ═══════════════════════════════════════════════════════════════
        const btnR = 20; // button radius
        const btnGap = 14;
        const btnDiam = btnR * 2;

        // Calculate total width: [Mic][Cam] | [Screen][Hand][Settings][Record] | [Users][Leave]
        const g1Count = 2; // Mic, Cam
        const g2Count = 4; // Screen, Hand, Settings, Record
        const g3Count = 2; // Users, Leave
        const dividerW = 20; // space for each divider
        const g1W = g1Count * btnDiam + (g1Count - 1) * btnGap;
        const g2W = g2Count * btnDiam + (g2Count - 1) * btnGap;
        const g3W = g3Count * btnDiam + (g3Count - 1) * btnGap;
        const pillPadding = 22;
        const pillWidth = g1W + dividerW + g2W + dividerW + g3W + pillPadding * 2;
        const pillHeight = 64;
        const pillX = canvas.width / 2 - pillWidth / 2;
        const pillY = canvas.height - pillHeight - 24; // bottom-6
        const btnCenterY = pillY + pillHeight / 2;

        // Pill background (bg-card/60 with border)
        ctx.fillStyle = 'rgba(26, 30, 53, 0.7)';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 32);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Helper: draw a circular button
        const drawBtn = (cx: number, cy: number, bg: string, border?: string) => {
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.arc(cx, cy, btnR, 0, Math.PI * 2);
            ctx.fill();
            if (border) {
                ctx.strokeStyle = border;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        };

        let bx = pillX + pillPadding + btnR; // center x of first button

        // ── Group 1: Mic, Cam ──
        // Mic button
        drawBtn(bx, btnCenterY, isMicOn ? 'rgba(255,255,255,0.05)' : '#dc2626', isMicOn ? 'rgba(255,255,255,0.05)' : undefined);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        if (isMicOn) {
            // Mic icon
            ctx.beginPath();
            ctx.roundRect(bx - 4, btnCenterY - 9, 8, 14, 4);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(bx, btnCenterY + 1, 8, 0, Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx, btnCenterY + 9);
            ctx.lineTo(bx, btnCenterY + 12);
            ctx.stroke();
        } else {
            // MicOff icon
            ctx.beginPath();
            ctx.roundRect(bx - 4, btnCenterY - 9, 8, 14, 4);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(bx, btnCenterY + 1, 8, 0, Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx - 8, btnCenterY - 10);
            ctx.lineTo(bx + 8, btnCenterY + 10);
            ctx.stroke();
        }

        bx += btnDiam + btnGap;

        // Cam button
        drawBtn(bx, btnCenterY, isCamOn ? 'rgba(255,255,255,0.05)' : '#dc2626', isCamOn ? 'rgba(255,255,255,0.05)' : undefined);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        if (isCamOn) {
            // Video icon
            ctx.beginPath();
            ctx.roundRect(bx - 10, btnCenterY - 6, 14, 12, 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx + 4, btnCenterY - 3);
            ctx.lineTo(bx + 11, btnCenterY - 7);
            ctx.lineTo(bx + 11, btnCenterY + 7);
            ctx.lineTo(bx + 4, btnCenterY + 3);
            ctx.stroke();
        } else {
            // VideoOff icon
            ctx.beginPath();
            ctx.roundRect(bx - 10, btnCenterY - 6, 14, 12, 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx + 4, btnCenterY - 3);
            ctx.lineTo(bx + 11, btnCenterY - 7);
            ctx.lineTo(bx + 11, btnCenterY + 7);
            ctx.lineTo(bx + 4, btnCenterY + 3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx - 10, btnCenterY - 8);
            ctx.lineTo(bx + 10, btnCenterY + 8);
            ctx.stroke();
        }

        bx += btnDiam + btnGap;

        // ── Divider 1 ──
        const dvX1 = bx - btnGap / 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dvX1, pillY + 16);
        ctx.lineTo(dvX1, pillY + pillHeight - 16);
        ctx.stroke();
        bx += dividerW - btnGap; // adjust for divider space

        // ── Group 2: Screen Share, Hand, Settings, Record ──
        // Screen share
        drawBtn(bx, btnCenterY, isScreenSharing ? '#6c63ff' : 'rgba(255,255,255,0.05)', isScreenSharing ? undefined : 'rgba(255,255,255,0.05)');
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        // Monitor icon
        ctx.beginPath();
        ctx.roundRect(bx - 10, btnCenterY - 8, 20, 14, 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, btnCenterY + 6);
        ctx.lineTo(bx, btnCenterY + 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx - 5, btnCenterY + 10);
        ctx.lineTo(bx + 5, btnCenterY + 10);
        ctx.stroke();

        bx += btnDiam + btnGap;

        // Hand raise
        drawBtn(bx, btnCenterY, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)');
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        // Hand icon (simplified)
        ctx.beginPath();
        ctx.moveTo(bx - 1, btnCenterY + 10);
        ctx.lineTo(bx - 1, btnCenterY - 2);
        ctx.lineTo(bx - 1, btnCenterY - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + 5, btnCenterY - 9);
        ctx.lineTo(bx + 5, btnCenterY + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx - 7, btnCenterY - 6);
        ctx.lineTo(bx - 7, btnCenterY + 2);
        ctx.stroke();

        bx += btnDiam + btnGap;

        // Settings
        drawBtn(bx, btnCenterY, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)');
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        // Gear icon (circle + small ticks around)
        ctx.beginPath();
        ctx.arc(bx, btnCenterY, 5, 0, Math.PI * 2);
        ctx.stroke();
        for (let a = 0; a < 8; a++) {
            const angle = (a / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(bx + Math.cos(angle) * 7, btnCenterY + Math.sin(angle) * 7);
            ctx.lineTo(bx + Math.cos(angle) * 10, btnCenterY + Math.sin(angle) * 10);
            ctx.stroke();
        }

        bx += btnDiam + btnGap;

        // Record button (red circle with inner filled circle)
        drawBtn(bx, btnCenterY, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)');
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, btnCenterY, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(bx, btnCenterY, 4, 0, Math.PI * 2);
        ctx.fill();

        bx += btnDiam + btnGap;

        // ── Divider 2 ──
        const dvX2 = bx - btnGap / 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dvX2, pillY + 16);
        ctx.lineTo(dvX2, pillY + pillHeight - 16);
        ctx.stroke();
        bx += dividerW - btnGap;

        // ── Group 3: Users, Leave ──
        // Users
        drawBtn(bx, btnCenterY, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)');
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        // Users icon (two person silhouettes)
        ctx.beginPath();
        ctx.arc(bx - 3, btnCenterY - 4, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx - 3, btnCenterY + 6, 7, Math.PI + 0.5, -0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx + 6, btnCenterY - 3, 3, 0, Math.PI * 2);
        ctx.stroke();

        bx += btnDiam + btnGap;

        // Leave call (red)
        drawBtn(bx, btnCenterY, '#dc2626');
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        // PhoneOff icon (phone with slash)
        ctx.beginPath();
        ctx.moveTo(bx - 8, btnCenterY - 2);
        ctx.quadraticCurveTo(bx - 6, btnCenterY - 8, bx, btnCenterY - 6);
        ctx.quadraticCurveTo(bx + 6, btnCenterY - 8, bx + 8, btnCenterY - 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx - 7, btnCenterY - 6);
        ctx.lineTo(bx + 7, btnCenterY + 6);
        ctx.stroke();

    }, [isRecording, isPaused, isMicOn, isCamOn, isScreenSharing, meetingTitle, meetingCode, peers, layoutMode, spotlightId, localCameraStream, activeSpeakerId]);

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
