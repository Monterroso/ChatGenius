import { useState, useEffect } from 'react';
import { ThreadList } from './ThreadList';
import { cn } from '@/lib/utils';

interface Group {
  id: string;
  name: string;
}

export function GroupList() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'group' | 'thread'>('group');
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const handleThreadSelect = (threadId: string) => {
    setSelectedId(threadId);
    setSelectedType('thread');
  };

  // Fetch groups on mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/groups/member');
        if (!res.ok) throw new Error('Failed to fetch groups');
        const data = await res.json();
        setGroups(data);
      } catch (error) {
        console.error('Error fetching groups:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  if (isLoading) {
    return <div className={cn("p-4 text-muted-foreground")}>Loading groups...</div>;
  }

  return (
    <div className={cn("space-y-2")}>
      {groups.map((group) => (
        <div key={group.id} className={cn("space-y-1")}>
          <button
            onClick={() => {
              setSelectedId(group.id);
              setSelectedType('group');
            }}
            className={cn(
              "w-full text-left px-4 py-2 rounded-md hover:bg-accent",
              selectedId === group.id && selectedType === 'group' && "bg-accent"
            )}
          >
            {group.name}
          </button>
          <ThreadList 
            groupId={group.id} 
            onThreadSelect={handleThreadSelect}
          />
        </div>
      ))}
    </div>
  );
} 