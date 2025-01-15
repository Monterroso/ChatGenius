import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Thread {
  id: string;
  name: string;
  message_count?: number;
}

interface ThreadListProps {
  groupId: string;
  onThreadSelect: (threadId: string) => void;
}

export function ThreadList({ groupId, onThreadSelect }: ThreadListProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newThreadName, setNewThreadName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch threads
  const fetchThreads = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/threads`);
      if (!res.ok) throw new Error('Failed to fetch threads');
      const data = await res.json();
      setThreads(data);
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create thread
  const createThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newThreadName.trim() })
      });

      if (!res.ok) throw new Error('Failed to create thread');
      
      const thread = await res.json();
      setThreads(prev => [...prev, thread]);
      setNewThreadName('');
      onThreadSelect(thread.id);
    } catch (error) {
      console.error('Error creating thread:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Load threads on mount
  useEffect(() => {
    fetchThreads();
  }, [groupId]);

  if (isLoading) {
    return <div className={cn("pl-4 py-2 text-sm text-muted-foreground")}>Loading threads...</div>;
  }

  return (
    <div className={cn("pl-4")}>
      <div className={cn("flex items-center justify-between py-2")}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center text-sm font-medium",
            "text-muted-foreground hover:text-primary"
          )}
        >
          <span className={cn("mr-1")}>{isExpanded ? '▼' : '▶'}</span>
          Threads ({threads.length})
        </button>
        <button
          onClick={() => setNewThreadName('')}
          className={cn("p-1 text-muted-foreground hover:text-primary")}
        >
          +
        </button>
      </div>

      {isExpanded && (
        <div className={cn("space-y-1")}>
          {/* Thread creation form */}
          <form onSubmit={createThread} className={cn("px-2 mb-2")}>
            <input
              type="text"
              value={newThreadName}
              onChange={(e) => setNewThreadName(e.target.value)}
              placeholder="New thread name"
              className={cn(
                "w-full px-2 py-1 text-sm border rounded",
                "focus:outline-none focus:ring-2 focus:ring-primary"
              )}
            />
          </form>

          {/* Thread list */}
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => onThreadSelect(thread.id)}
              className={cn(
                "w-full text-left px-4 py-1.5 text-sm rounded-md",
                "hover:bg-accent",
                "flex items-center justify-between"
              )}
            >
              <span>{thread.name}</span>
              {typeof thread.message_count === 'number' && thread.message_count > 0 && (
                <span className={cn("text-xs text-muted-foreground")}>
                  {thread.message_count}
                </span>
              )}
            </button>
          ))}
          
          {threads.length === 0 && (
            <div className={cn("px-4 py-2 text-sm text-muted-foreground")}>
              No threads yet
            </div>
          )}
        </div>
      )}
    </div>
  );
} 