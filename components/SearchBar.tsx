/**
 * SearchBar Component
 * 
 * A reusable search bar component that allows users to search messages with filters.
 * Features:
 * - Text input for search terms
 * - Group filter dropdown
 * - User/Bot filter dropdown for From
 * - User/Bot filter dropdown for To
 * - Search button
 * - Responsive design
 */

import { useState } from 'react';
import { Search } from 'lucide-react';
import type { DBGroup, SafeUser } from '@/types/db';

interface SearchBarProps {
  /**
   * Callback function triggered when search is initiated
   * @param query The search term
   * @param filters Additional search filters (group, fromUser, toUser)
   */
  onSearch: (query: string, filters: {
    groupId?: string;
    fromUserId?: string;
    toUserId?: string;
  }) => void;
  /** List of available groups for filtering */
  groups: DBGroup[];
  /** List of users for filtering */
  users: SafeUser[];
  /** List of bots for filtering */
  bots: Array<{ id: string; name: string }>;
  /** Current user's ID to exclude from user lists */
  currentUserId: string;
}

export default function SearchBar({ onSearch, groups, users, bots, currentUserId }: SearchBarProps) {
  // State for search inputs
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [fromUser, setFromUser] = useState<string>('');
  const [toUser, setToUser] = useState<string>('');

  // Filter out current user from user list
  const otherUsers = users.filter(user => user.id !== currentUserId);

  const handleSearch = () => {
    onSearch(searchTerm, {
      groupId: selectedGroup || undefined,
      fromUserId: fromUser || undefined,
      toUserId: toUser || undefined,
    });
  };

  return (
    <div className="w-full bg-transparent">
      <div className="flex items-center gap-4">
        {/* Search input */}
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 text-white placeholder-gray-400 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              aria-label="Search messages"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Group filter */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-40 px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Filter by group"
          >
            <option value="">All Groups</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          {/* From User/Bot filter */}
          <select
            value={fromUser}
            onChange={(e) => setFromUser(e.target.value)}
            className="w-40 px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Filter by sender"
          >
            <option value="">From Anyone</option>
            <optgroup label="Users">
              {otherUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  👤 {user.name || user.username}
                </option>
              ))}
            </optgroup>
            <optgroup label="Bots">
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  🤖 {bot.name}
                </option>
              ))}
            </optgroup>
          </select>

          {/* To User/Bot filter */}
          <select
            value={toUser}
            onChange={(e) => setToUser(e.target.value)}
            className="w-40 px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Filter by recipient"
          >
            <option value="">To Anyone</option>
            <optgroup label="Users">
              {otherUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  👤 {user.name || user.username}
                </option>
              ))}
            </optgroup>
            <optgroup label="Bots">
              {bots.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  🤖 {bot.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>
    </div>
  );
} 