/**
 * useThreadPolling Hook
 * 
 * A custom hook that polls for thread messages at regular intervals.
 * Features:
 * - Automatic polling for thread messages
 * - Error handling
 * - Configurable polling interval
 * - Automatic cleanup
 */

import { useState, useEffect } from 'react';
import type { DBMessage } from '@/types/db';

interface UseThreadPollingProps {
  messageId: string | null;
  enabled?: boolean;
  interval?: number;
}

export function useThreadPolling({
  messageId,
  enabled = true,
  interval = 3000
}: UseThreadPollingProps) {
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const fetchThreadMessages = async () => {
      if (!messageId || !enabled) return;

      try {
        setIsPolling(true);
        const response = await fetch(`/api/messages/${messageId}/thread`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch thread messages');
        }

        const data = await response.json();
        
        if (isMounted) {
          setMessages(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to fetch thread messages'));
        }
      } finally {
        if (isMounted) {
          setIsPolling(false);
        }
      }
    };

    const poll = () => {
      fetchThreadMessages().then(() => {
        if (isMounted && enabled) {
          timeoutId = setTimeout(poll, interval);
        }
      });
    };

    if (messageId && enabled) {
      poll();
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [messageId, enabled, interval]);

  return {
    messages,
    error,
    isPolling,
    setMessages
  };
} 