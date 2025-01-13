'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { EffectiveStatus } from '@/types/db';

const AUTO_STATUS = {
  ONLINE: 'online',
  AWAY: 'away',
  OFFLINE: 'offline',
} as const;

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
      const response = await fetch('/api/status', {
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
        userId: session.user.id,
        session: session
      }
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setIsConnected(true);
      fetchInitialStatuses();
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('statusChanged', (status: EffectiveStatus) => {
      console.log('User status update:', status.userId, '->', status.status);

      setUserStatuses(prev => new Map(prev).set(status.userId, status));
    });

    setSocket(socketInstance);

    const activityEvents = ['mousemove', 'keydown'];
    let inactivityTimeout: NodeJS.Timeout;
    type AutoStatus = typeof AUTO_STATUS[keyof typeof AUTO_STATUS];
    let currentStatus: AutoStatus = AUTO_STATUS.OFFLINE;

    const resetInactivityTimeout = () => {
      clearTimeout(inactivityTimeout);
      if (currentStatus !== AUTO_STATUS.ONLINE) {
        console.log(`User ${session.user.name} is online from activity`);
        console.log('Socket ID:', socketInstance.id);
        socketInstance.emit('statusChanged', { 
          userId: session.user.id,
          deviceId: socketInstance.id,
          autoStatus: AUTO_STATUS.ONLINE 
        });
        currentStatus = AUTO_STATUS.ONLINE;
      }
      
      inactivityTimeout = setTimeout(() => {
        console.log(`User ${session.user.name} is away from activity`);
        console.log('Socket ID:', socketInstance.id);
        socketInstance.emit('statusChanged', {
          userId: session.user.id,
          deviceId: socketInstance.id,
          autoStatus: AUTO_STATUS.AWAY
        });
        currentStatus = AUTO_STATUS.AWAY;
      }, 600000);
    };

    activityEvents.forEach(event => {     
      window.addEventListener(event, resetInactivityTimeout);
    });

    resetInactivityTimeout();

    const fetchInitialStatuses = async () => {
      try {
        const response = await fetch('/api/status');
        if (response.ok) {
          const statuses = await response.json();
          console.log('Initial statuses:', statuses);
          setUserStatuses(new Map(Object.entries(statuses).map(([userId, status]: [string, any]) => 
            [userId, { ...status, userId }]
          )));
        }
      } catch (error) {
        console.error('Error fetching initial statuses:', error);
      }
    };

    return () => {
      socketInstance.disconnect();
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimeout);
      });
      clearTimeout(inactivityTimeout);
      console.log('Socket cleanup complete');
    };
  }, [session]);

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