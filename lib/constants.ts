export const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  away: 'bg-yellow-500',
  dnd: 'bg-red-500',
  invisible: 'bg-gray-300'
};

// Status thresholds in milliseconds
export const STATUS_THRESHOLDS = {
  AWAY: 1000 * 60 * 0.5,  // 30 seconds
  OFFLINE: 1000 * 60 * 5 // 5 minutes
} as const; 