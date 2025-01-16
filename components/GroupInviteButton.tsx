/**
 * GroupInviteButton Component
 * 
 * A presentational button component for joining a group via an invite link.
 * The parent component handles fetching the group name and joining logic.
 *
 * @component
 * @example
 * ```tsx
 * <GroupInviteButton 
 *   inviteId="abc123"
 *   groupName="My Group"
 *   isLoading={false}
 *   onJoinGroup={() => handleJoinGroup('abc123')}
 * />
 * ```
 */

interface GroupInviteButtonProps {
  /** The unique identifier for the group invite */
  inviteId: string;
  /** The name of the group to join */
  groupName: string;
  /** Whether the group name is currently loading */
  isLoading?: boolean;
  /** Callback function that is called when the join button is clicked */
  onJoinGroup: (inviteId: string) => void;
}

export const GroupInviteButton = ({ 
  inviteId, 
  groupName,
  isLoading = false,
  onJoinGroup 
}: GroupInviteButtonProps) => {
  return (
    <button
      onClick={() => onJoinGroup(inviteId)}
      className="inline-flex items-center px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
      disabled={isLoading}
    >
      Join {isLoading ? 'Loading...' : groupName}
    </button>
  );
}; 