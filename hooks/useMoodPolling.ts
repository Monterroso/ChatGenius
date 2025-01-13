import { useState, useEffect } from 'react';
import type { UserMood } from '@/types/db';

interface UseMoodPollingResult {
  moods: Map<string, UserMood>;
  error: Error | null;
  isPolling: boolean;
}

/**
 * Custom hook for polling user moods
 * @param userIds Array of user IDs to poll moods for
 * @param interval Polling interval in milliseconds (default: 3000ms)
 * @returns Object containing moods Map, error state, and polling status
 */
export function useMoodPolling(
  userIds: string[],
  interval = parseInt(process.env.NEXT_PUBLIC_MOOD_POLLING_INTERVAL ?? "3000", 10)
): UseMoodPollingResult {
  const [moods, setMoods] = useState<Map<string, UserMood>>(new Map());
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!userIds.length) return;

    const fetchMoods = async () => {
      setIsPolling(true);
      try {
        // Fetch moods for all visible users in parallel
        const responses = await Promise.all(
          userIds.map(userId =>
            fetch(`/api/mood/${userId}`)
              .then(res => res.ok ? res.json() : null)
              .catch(() => null) // Handle individual request failures gracefully
          )
        );

        // Update moods map with successful responses
        const newMoods = new Map();
        responses.forEach((mood, index) => {
          if (mood) {
            newMoods.set(userIds[index], mood);
          }
        });

        setMoods(newMoods);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch moods'));
      } finally {
        setIsPolling(false);
      }
    };

    // Initial fetch
    fetchMoods();

    // Set up polling interval
    const pollInterval = setInterval(fetchMoods, interval);

    // Cleanup on unmount or when userIds change
    return () => clearInterval(pollInterval);
  }, [userIds, interval]);

  return { moods, error, isPolling };
} 