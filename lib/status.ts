import { UserStatus, EffectiveStatus, UserDevice } from '@/types/db';
import { STATUS_THRESHOLDS } from '@/lib/constants';

export function calculateEffectiveStatus(status: UserStatus): EffectiveStatus {
  const now = Date.now();
  const lastSeen = new Date(status.last_seen).getTime();
  const isRecentlyActive = now - lastSeen < STATUS_THRESHOLDS.OFFLINE;

  // Remove stale devices
  const activeDevices = status.devices.filter(device => {
    const lastActive = new Date(device.last_active).getTime();
    return now - lastActive < STATUS_THRESHOLDS.OFFLINE;
  });

  // Get the most recently active device
  const mostRecentDevice = activeDevices.length > 0 
    ? activeDevices.reduce((latest, current) => {
        const latestTime = new Date(latest.last_active).getTime();
        const currentTime = new Date(current.last_active).getTime();
        return currentTime > latestTime ? current : latest;
      })
    : null;

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

  // Manual status takes precedence if user is recently active
  if (status.manual_status && isRecentlyActive) {
    return {
      userId: status.user_id,
      status: status.manual_status,
      isOnline: true,
      lastSeen: status.last_seen,
      deviceId: mostRecentDevice?.id || null
    };
  }

  // Calculate status based on last_seen
  const wasSeenVeryRecently = now - lastSeen < STATUS_THRESHOLDS.AWAY;
  if (isRecentlyActive) {
    if (wasSeenVeryRecently) {
      return {
        userId: status.user_id,
        status: 'online',
        isOnline: true,
        lastSeen: status.last_seen,
        deviceId: mostRecentDevice?.id || null
      };
    } else {
      return {
        userId: status.user_id,
        status: 'away',
        isOnline: true,
        lastSeen: status.last_seen,
        deviceId: mostRecentDevice?.id || null
      };
    }
  }

  // Default to offline if not recently active
  return {
    userId: status.user_id,
    status: 'offline',
    isOnline: false,
    lastSeen: status.last_seen,
    deviceId: null
  };
} 