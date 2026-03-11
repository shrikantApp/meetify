/**
 * getLocalIP
 * ----------
 * Attempts to detect the local network IPv4 address using the WebRTC ICE candidate trick.
 * This is useful for development when testing across devices on the same WiFi.
 */
export async function getLocalIP(): Promise<string | null> {
    return new Promise((resolve) => {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel(''); // Required for some browsers to start gathering candidates
        
        pc.onicecandidate = (event) => {
            if (!event.candidate) {
                // If gathering finishes without a match, we can't find it
                console.warn('[WebRTC] ICE gathering complete without local IP match');
                resolve(null);
                return;
            }

            const candidate = event.candidate.candidate;
            // Regex to find IPv4 address
            const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
            const match = ipRegex.exec(candidate);
            
            if (match) {
                const ip = match[1];
                // Ignore localhost and other non-LAN IPs if possible
                if (ip !== '127.0.0.1' && !ip.startsWith('0.')) {
                    pc.close();
                    resolve(ip);
                }
            }
        };

        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .catch(err => {
                console.error('[WebRTC] Failed to create offer for local IP detection:', err);
                resolve(null);
            });

        // Timeout fallback
        setTimeout(() => {
            pc.close();
            resolve(null);
        }, 5000);
    });
}
