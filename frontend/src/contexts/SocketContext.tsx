import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
    socket: Socket | null;
    connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export function SocketProvider({ children }: { children: ReactNode }) {
    const { token } = useAuth();
    // Store socket in STATE (not ref) so consumers react to it being set
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!token) {
            // If no token, disconnect any existing socket
            setSocket(null);
            setConnected(false);
            return;
        }

        // Connect once per token
        const newSocket = io(`${SOCKET_URL}/signaling`, {
            auth: { token },
            transports: ['websocket'],
        });

        newSocket.on('connect', () => setConnected(true));
        newSocket.on('disconnect', () => setConnected(false));

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
            setSocket(null);
            setConnected(false);
        };
    }, [token]); // Re-run only when token changes (login/logout)

    return (
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}
