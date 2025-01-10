'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.id) {
      console.log('No session or user ID, skipping socket connection');
      return;
    }

    const socketUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost') + ':' + (process.env.SOCKET_PORT || '3001');
    console.log('\n=== Initializing Socket ===');
    console.log('Socket URL:', socketUrl);
    console.log('User ID:', session.user.id);

    const socketInstance = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: {
        userId: session.user.id
      }
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('userPresenceChanged', (data) => {
      console.log('User presence update:', data.userId, '->', data.presence);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      console.log('Socket cleanup complete');
    };
  }, [session]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
} 