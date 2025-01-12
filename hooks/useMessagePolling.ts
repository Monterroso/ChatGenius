import { useState, useEffect, useCallback } from 'react';
import type { DBMessage, Conversation } from '@/types/db';

export function useMessagePolling(
  selectedConversation: Conversation | null,
  initialMessages: DBMessage[] = []
) {
  const [messages, setMessages] = useState<DBMessage[]>(initialMessages);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const pollingInterval = 3000; // 3 seconds

  // Move fetchMessages outside the effect and memoize it
  const fetchMessages = useCallback(async () => {
    if (!selectedConversation) return;

    try {
      const queryParam = selectedConversation.type === 'group' ? 'groupId' : 'userId';
      const url = `/api/messages?${queryParam}=${selectedConversation.id}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const data = await response.json();
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
      console.error('Error polling messages:', err);
    }
  }, [selectedConversation]);

  useEffect(() => {
    let pollTimer: NodeJS.Timeout;

    if (selectedConversation) {
      setIsPolling(true);
      // Initial fetch
      fetchMessages();
      // Start polling
      pollTimer = setInterval(fetchMessages, pollingInterval);
    }

    // Cleanup
    return () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        setIsPolling(false);
      }
    };
  }, [selectedConversation, fetchMessages]);

  return {
    messages,
    setMessages,
    isPolling,
    error,
    refresh: fetchMessages // Expose refresh function for manual updates
  };
} 