import { AutoStatus, UserStatus, EffectiveStatus, UserDevice } from '@/types/db';

const OFFLINE_THRESHOLD = 1000 * 60 * 5; // 5 minutes

export function calculateEffectiveStatus(status: UserStatus): EffectiveStatus {
  // Remove stale devices
  const activeDevices = status.devices.filter(device => {
    const lastActive = new Date(device.lastActive).getTime();
    return Date.now() - lastActive < OFFLINE_THRESHOLD;
  });

  // User is offline if no active devices
  if (activeDevices.length === 0) {
    return {
      userId: status.userId,
      status: 'offline',
      isOnline: false,
      lastSeen: status.lastSeen
    };
  }

  // User appears offline if invisible
  if (status.invisible) {
    return {
      userId: status.userId,
      status: 'offline',
      isOnline: true,
      lastSeen: status.lastSeen
    };
  }

  // Manual status takes precedence over auto status
  if (status.manualStatus) {
    return {
      userId: status.userId,
      status: status.manualStatus,
      isOnline: true,
      lastSeen: status.lastSeen
    };
  }

  return {
    userId: status.userId,
    status: status.autoStatus,
    isOnline: status.autoStatus !== 'offline',
    lastSeen: status.lastSeen
  };
} 