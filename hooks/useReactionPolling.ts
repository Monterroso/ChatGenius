import { useState, useEffect, useCallback } from 'react';

interface ReactionUser {
  userId: string;
  name: string;
  username: string;
}

type GroupedReactions = Record<string, ReactionUser[]>;

interface UseReactionPollingProps {
  messageIds: string[];
  interval?: number;
  enabled?: boolean;
}

interface UseReactionPollingReturn {
  reactions: Record<string, GroupedReactions>;
  error: Error | null;
  isPolling: boolean;
}

export const useReactionPolling = ({
  messageIds,
  interval = 3000,
  enabled = true
}: UseReactionPollingProps): UseReactionPollingReturn => {
  const [reactions, setReactions] = useState<Record<string, GroupedReactions>>({});
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const fetchReactions = useCallback(async () => {
    if (!messageIds.length) return;
    
    setIsPolling(true);
    setError(null);

    try {
      // Fetch reactions for all visible messages in parallel
      const responses = await Promise.all(
        messageIds.map(messageId =>
          fetch(`/api/messages/${messageId}/reactions`)
            .then(res => res.json())
            .then(data => ({ messageId, reactions: data.reactions }))
        )
      );

      // Update reactions state
      const newReactions = responses.reduce((acc, { messageId, reactions }) => {
        acc[messageId] = reactions;
        return acc;
      }, {} as Record<string, GroupedReactions>);

      setReactions(prev => {
        // Only update if there are actual changes
        const hasChanges = messageIds.some(id => {
          return JSON.stringify(prev[id]) !== JSON.stringify(newReactions[id]);
        });

        return hasChanges ? newReactions : prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch reactions'));
    } finally {
      setIsPolling(false);
    }
  }, [messageIds]);

  useEffect(() => {
    if (!enabled || !messageIds.length) return;

    // Initial fetch
    fetchReactions();

    // Set up polling interval
    const intervalId = setInterval(fetchReactions, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, messageIds, interval, fetchReactions]);

  return {
    reactions,
    error,
    isPolling
  };
}; 