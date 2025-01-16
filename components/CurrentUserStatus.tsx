import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { StatusIndicator } from '@/components/StatusIndicator';
import type { EffectiveStatus } from '@/types/db';
import { STATUS_COLORS } from '@/lib/constants';

interface CurrentUserStatusProps {
  statuses: Map<string, EffectiveStatus>;
  currentMood: string;
  onUpdateMood: (newMood: string) => void;
}

/**
 * CurrentUserStatus Component
 * 
 * Displays the current user's status and mood, allowing them to update their mood.
 * 
 * @component
 * @param {Object} props
 * @param {Map<string, EffectiveStatus>} props.statuses - Map of user IDs to their effective statuses
 * @param {string} props.currentMood - The user's current mood
 * @param {Function} props.onUpdateMood - Callback function to update the user's mood
 * 
 * @example
 * ```tsx
 * <CurrentUserStatus 
 *   statuses={statusesMap} 
 *   currentMood={mood}
 *   onUpdateMood={handleMoodUpdate}
 * />
 * ```
 */
export const CurrentUserStatus = ({ 
  statuses, 
  currentMood, 
  onUpdateMood 
}: CurrentUserStatusProps) => {
  const { data: session } = useSession();
  const [inputMood, setInputMood] = useState('');
  const userStatus = session?.user?.id ? statuses.get(session.user.id) : undefined;

  const handleUpdateMood = () => {
    if (inputMood.trim()) {
      onUpdateMood(inputMood);
      setInputMood('');
    }
  };

  const displayStatus = userStatus?.status || 'offline';
  const colorClass = STATUS_COLORS[displayStatus] || STATUS_COLORS.offline;
  const statusText = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full p-2 rounded-md hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-2">
          <StatusIndicator 
            colorClass={colorClass}
            statusText={statusText}
          />
          <div className="flex flex-col">
            <span className="text-sm text-white">
              {session?.user?.username || 'User'}
            </span>
            {currentMood && (
              <span className="text-xs text-gray-400">
                {currentMood}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={inputMood}
          onChange={(e) => setInputMood(e.target.value)}
          placeholder="Set mood..."
          className="w-full px-2 py-1 text-sm bg-gray-700 rounded"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleUpdateMood();
            }
          }}
        />
        <button
          onClick={handleUpdateMood}
          className="px-2 py-1 text-xs bg-primary rounded hover:bg-primary/90"
        >
          Set
        </button>
      </div>
    </div>
  );
}; 