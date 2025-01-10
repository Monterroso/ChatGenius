'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { EffectiveStatus } from '@/types/db';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  updateStatus: (status: string) => Promise<void>;
  userStatuses: Map<string, EffectiveStatus>;
}

export const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  updateStatus: async () => {},
  userStatuses: new Map(),
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { data: session } = useSession();
  const [userStatuses, setUserStatuses] = useState<Map<string, EffectiveStatus>>(new Map());

  const updateStatus = useCallback(async (status: string) => {
    try {
      const response = await fetch('/api/users/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) throw new Error('Failed to update status');
      
      const newStatus = await response.json();
      setUserStatuses(prev => new Map(prev).set(newStatus.userId, newStatus));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }, []);

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

    const activityEvents = ['mousemove', 'keydown'];
    let inactivityTimeout: NodeJS.Timeout;
    let currentPresence = 'offline'; // Track current presence state

    const resetInactivityTimeout = () => {
      clearTimeout(inactivityTimeout);
      // Only emit 'online' if current presence isn't already 'online'
      if (currentPresence !== 'online') {
        console.log(`User ${session.user.name} is online from activity`);
        socketInstance.emit('userPresenceChanged', { presence: 'online' });
        currentPresence = 'online';
      }
      
      inactivityTimeout = setTimeout(() => {
        console.log(`User ${session.user.name} is away from activity`);
        socketInstance.emit('userPresenceChanged', { presence: 'away' });
        currentPresence = 'away';
      }, 10000); // 5 minutes
    };

    activityEvents.forEach(event => {     
      window.addEventListener(event, resetInactivityTimeout);
    });

    resetInactivityTimeout(); // Initialize the timeout

    return () => {
      socketInstance.disconnect();
      activityEvents.forEach(event => {
        window.removeEventListener(event, () => {
          console.log(`Activity detected: ${event}`);
          resetInactivityTimeout();
        });
      });
      clearTimeout(inactivityTimeout);
      console.log('Socket cleanup complete');
    };
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Fetch initial statuses when socket connects
    const fetchInitialStatuses = async () => {
      try {
        const response = await fetch('/api/users/status');
        if (response.ok) {
          const statuses = await response.json();
          setUserStatuses(new Map(statuses.map((status: EffectiveStatus) => 
            [status.userId, status]
          )));
        }
      } catch (error) {
        console.error('Error fetching initial statuses:', error);
      }
    };

    if (socket) {
      console.log('Socket connected, fetching initial statuses');
      fetchInitialStatuses();

      socket.on('statusChanged', (status: EffectiveStatus) => {
        setUserStatuses(prev => new Map(prev).set(status.userId, status));
      });
    }

    return () => {
      if (socket) {
        socket.off('statusChanged');
      }
    };
  }, [socket, session]);

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      updateStatus,
      userStatuses,
    }}>
      {children}
    </SocketContext.Provider>
  );
} 