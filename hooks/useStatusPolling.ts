import { useState, useEffect } from 'react';
import type { EffectiveStatus } from '@/types/db';

interface UseStatusPollingResult {
  statuses: Map<string, EffectiveStatus>;
  error: Error | null;
  isPolling: boolean;
}

/**
 * Custom hook for polling user statuses
 * @param userIds Array of user IDs to poll statuses for
 * @param interval Polling interval in milliseconds (default: 3000ms)
 * @returns Object containing statuses Map, error state, and polling status
 */
export function useStatusPolling(
  userIds: string[],
  interval = parseInt(process.env.NEXT_PUBLIC_STATUS_POLLING_INTERVAL ?? "3000", 10)
): UseStatusPollingResult {
  const [statuses, setStatuses] = useState<Map<string, EffectiveStatus>>(new Map());
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!userIds.length) return;

    const fetchStatuses = async () => {
      setIsPolling(true);
      try {
        // Fetch statuses for all visible users in parallel
        const responses = await Promise.all(
          userIds.map(userId =>
            fetch(`/api/status/${userId}`)
              .then(res => res.ok ? res.json() : null)
              .catch(() => null) // Handle individual request failures gracefully
          )
        );

        // Update statuses map with successful responses
        const newStatuses = new Map();
        responses.forEach((status, index) => {
          if (status) {
            newStatuses.set(userIds[index], status);
          }
        });

        setStatuses(newStatuses);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch statuses'));
      } finally {
        setIsPolling(false);
      }
    };

    // Initial fetch
    fetchStatuses();

    // Set up polling interval
    const pollInterval = setInterval(fetchStatuses, interval);

    // Cleanup on unmount or when userIds change
    return () => clearInterval(pollInterval);
  }, [userIds, interval]);

  return { statuses, error, isPolling };
} 