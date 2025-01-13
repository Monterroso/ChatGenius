import { AutoStatus, UserStatus, EffectiveStatus, UserDevice } from '@/types/db';

const OFFLINE_THRESHOLD = 1000 * 60 * 5; // 5 minutes

export function calculateEffectiveStatus(status: UserStatus): EffectiveStatus {
  // Remove stale devices
  const activeDevices = status.devices.filter(device => {
    const lastActive = new Date(device.last_active).getTime();
    return Date.now() - lastActive < OFFLINE_THRESHOLD;
  });

  // Get the most recently active device
  const mostRecentDevice = activeDevices.length > 0 
    ? activeDevices.reduce((latest, current) => {
        const latestTime = new Date(latest.last_active).getTime();
        const currentTime = new Date(current.last_active).getTime();
        return currentTime > latestTime ? current : latest;
      })
    : null;

  // User is offline if no active devices
  if (activeDevices.length === 0) {
    return {
      userId: status.user_id,
      status: 'offline',
      isOnline: false,
      lastSeen: status.last_seen,
      deviceId: null
    };
  }

  // User appears offline if invisible
  if (status.invisible) {
    return {
      userId: status.user_id,
      status: 'offline',
      isOnline: true,
      lastSeen: status.last_seen,
      deviceId: mostRecentDevice?.id || null
    };
  }

  // Manual status takes precedence over auto status
  if (status.manual_status) {
    return {
      userId: status.user_id,
      status: status.manual_status,
      isOnline: true,
      lastSeen: status.last_seen,
      deviceId: mostRecentDevice?.id || null
    };
  }

  return {
    userId: status.user_id,
    status: status.auto_status,
    isOnline: status.auto_status !== 'offline',
    lastSeen: status.last_seen,
    deviceId: mostRecentDevice?.id || null
  };
} 