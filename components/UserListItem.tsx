import { StatusIndicator } from '@/components/StatusIndicator';
import type { SafeUser, EffectiveStatus, UserMood } from '@/types/db';
import { STATUS_COLORS } from '@/lib/constants';

interface UserListItemProps {
  user: SafeUser;
  moods: Map<string, UserMood>;
  statuses: Map<string, EffectiveStatus>;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * UserListItem Component
 * 
 * Displays a user in a list with their status, mood, and handles click events.
 * 
 * @component
 * @param {Object} props
 * @param {SafeUser} props.user - The user to display
 * @param {Map<string, UserMood>} props.moods - Map of user IDs to their moods
 * @param {Map<string, EffectiveStatus>} props.statuses - Map of user IDs to their effective statuses
 * @param {boolean} props.isSelected - Whether this user is currently selected
 * @param {Function} props.onClick - Callback function when the user item is clicked
 * 
 * @example
 * ```tsx
 * <UserListItem
 *   user={user}
 *   moods={moodsMap}
 *   statuses={statusesMap}
 *   isSelected={false}
 *   onClick={() => handleSelect(user)}
 * />
 * ```
 */
export const UserListItem = ({ 
  user, 
  moods, 
  statuses, 
  isSelected, 
  onClick 
}: UserListItemProps) => {
  const userStatus = statuses.get(user.id);
  const userMood = moods.get(user.id);

  const displayStatus = userStatus?.status || 'offline';
  const colorClass = STATUS_COLORS[displayStatus] || STATUS_COLORS.offline;
  const statusText = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);

  return (
    <li 
      className={`mb-2 p-2 rounded cursor-pointer flex items-center ${
        isSelected ? 'bg-gray-700' : 'hover:bg-gray-700'
      }`}
      onClick={onClick}
    >
      <StatusIndicator 
        colorClass={colorClass}
        statusText={statusText}
      />
      <div className="flex flex-col">
        <span className="text-sm text-white">
          {user.name || user.username}
        </span>
        {userMood?.mood && (
          <span className="text-xs text-gray-400">
            {userMood.mood}
          </span>
        )}
      </div>
    </li>
  );
}; 