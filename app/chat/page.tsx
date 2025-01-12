'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useMemo } from 'react';
import type { SafeUser, DBMessage, DBGroup, DBGroupMember, Conversation, AutoStatus, EffectiveStatus } from '@/types/db';
import { useSocket } from '@/contexts/SocketContext';
import { useMessagePolling } from '@/hooks/useMessagePolling';

interface GroupInviteButtonProps {
  inviteId: string;
  onGroupJoined?: () => void;
}

const GroupInviteButton = ({ inviteId, onGroupJoined }: GroupInviteButtonProps) => {
  const [groupName, setGroupName] = useState('Loading...');
  
  useEffect(() => {
    const fetchGroupName = async () => {
      try {
        const groupInfoResponse = await fetch(`/api/invites/${inviteId}`);
        if (groupInfoResponse.ok) {
          const data = await groupInfoResponse.json();
          setGroupName(data.groupName || 'Unknown Group');
        }
      } catch (error) {
        console.error('Error fetching group name:', error);
        setGroupName('Unknown Group');
      }
    };
    fetchGroupName();
  }, [inviteId]);

  const handleJoinGroup = async () => {
    try {
      const response = await fetch(`/api/invites/${inviteId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        onGroupJoined?.();
        alert(`Successfully joined ${groupName}!`);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to join group');
      }
    } catch (error) {
      console.error('Error joining group:', error);
      alert('Failed to join group');
    }
  };

  return (
    <button
      onClick={handleJoinGroup}
      className="inline-flex items-center px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
    >
      Join {groupName}
    </button>
  );
};

const CurrentUserStatus = () => {
  const { data: session } = useSession();
  const { userStatuses } = useSocket();
  const [status, setStatus] = useState<EffectiveStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!session?.user?.id) return;
      
      try {
        const response = await fetch(`/api/users/${session.user.id}/status`);
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch (error) {
        console.error('Error fetching user status:', error);
      }
    };

    fetchStatus();
  }, [session?.user?.id]);

  // Update status when websocket updates come in
  useEffect(() => {
    if (!session?.user?.id) return;
    const socketStatus = userStatuses.get(session.user.id);
    if (socketStatus) {
      setStatus(socketStatus);
    }
  }, [userStatuses, session?.user?.id]);

  const colors: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    away: 'bg-yellow-500',
    dnd: 'bg-red-500',
    invisible: 'bg-gray-300'
  };

  const displayStatus = status?.status || 'offline';
  const colorClass = colors[displayStatus] || colors.offline;

  return (
    <button 
      className="w-14 mx-1 p-2 rounded-md hover:bg-gray-800 transition-colors text-center"
      title={`Status: ${displayStatus}`}
    >
      <div className="flex flex-col items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${colorClass}`} />
        <span className="text-xs text-white truncate w-full">
          {session?.user?.username || 'User'}
        </span>
      </div>
    </button>
  );
};

export default function Chat() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [message, setMessage] = useState('');
  const [groups, setGroups] = useState<DBGroup[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [groupMembers, setGroupMembers] = useState<DBGroupMember[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [usersWithMessages, setUsersWithMessages] = useState<Set<string>>(new Set());
  const [showNewMessagePopup, setShowNewMessagePopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewGroupPopup, setShowNewGroupPopup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [messageError, setMessageError] = useState(false);
  const { socket, userStatuses } = useSocket();
  const {
    messages,
    setMessages,
    isPolling,
    error: pollingError
  } = useMessagePolling(selectedConversation);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchUsers();
      fetchGroups();
      fetchUsersWithMessages();
    }
  }, [session]);

  const fetchUsers = async () => {
    const response = await fetch('/api/users');
    if (response.ok) {
      const data = await response.json();
      setUsers(data);
    }
  };

  const fetchMessages = async (conversationId: string, type: 'group' | 'direct') => {
    const queryParam = type === 'group' ? 'groupId' : 'userId';
    const url = `/api/messages?${queryParam}=${conversationId}`;
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching initial messages:', error);
    }
  };

  const fetchGroups = async () => {
    const response = await fetch('/api/groups/member');
    if (response.ok) {
      const data = await response.json();
      setGroups(data);
    }
  };

  const fetchGroupMembers = async (groupId: string) => {
    const response = await fetch(`/api/groups/${groupId}/members`);
    if (response.ok) {
      const data = await response.json();
      setGroupMembers(data);
    }
  };

  const fetchUsersWithMessages = async () => {
    const response = await fetch('/api/messages/contacts');
    if (response.ok) {
      const data = await response.json();
      setUsersWithMessages(new Set(data.map((userId: string) => userId)));
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation) return;

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: message,
          ...(selectedConversation.type === 'group' 
            ? { groupId: selectedConversation.id }
            : { receiverId: selectedConversation.id })
        }),
      });

      if (response.ok) {
        setMessage('');
        fetchMessages(selectedConversation.id, selectedConversation.type);
      } else {
        setMessageError(true);
        setTimeout(() => setMessageError(false), 2000); // Reset after 2 seconds
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessageError(true);
      setTimeout(() => setMessageError(false), 2000); // Reset after 2 seconds
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    const queryParam = conversation.type === 'group' ? 'groupId' : 'userId';
    const url = `/api/messages?${queryParam}=${conversation.id}`;
    
    if (conversation.type === 'direct') {
      setUsersWithMessages(prev => new Set([...prev, conversation.id]));
    }
    
    fetchMessages(conversation.id, conversation.type);
    if (conversation.type === 'group') {
      fetchGroupMembers(conversation.id);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewMessage = (userId: string, userName: string) => {
    setUsersWithMessages(prev => new Set([...prev, userId]));
    
    handleConversationSelect({
      id: userId,
      type: 'direct',
      name: userName
    });
    setShowNewMessagePopup(false);
    setSearchQuery('');
  };

  const handleCreateInvite = async (groupId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    try {
      const response = await fetch(`/api/groups/${groupId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const { inviteId } = await response.json();
        const link = `${window.location.origin}/invite/${inviteId}`;
        await navigator.clipboard.writeText(link);
        alert('Invite link copied to clipboard!');
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to create invite link');
      }
    } catch (error) {
      console.error('Error creating invite:', error);
      alert('Failed to create invite link');
    }
  };

  const transformMessageContent = (content: string) => {
    const inviteLinkPattern = new RegExp(`${window.location.origin}/invite/([a-zA-Z0-9-]+)`);
    
    return content.split(' ').map((word, index) => {
      const match = word.match(inviteLinkPattern);
      if (match) {
        const inviteId = match[1];
        return <GroupInviteButton 
          key={index} 
          inviteId={inviteId} 
          onGroupJoined={fetchGroups} 
        />;
      }
      return <span key={index}>{word} </span>;
    });
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: newGroupName.trim()
        }),
      });

      if (response.ok) {
        const newGroup = await response.json();
        setGroups(prevGroups => [...prevGroups, newGroup]);
        setNewGroupName('');
        setShowNewGroupPopup(false);
        
        handleConversationSelect({
          id: newGroup.id,
          type: 'group',
          name: newGroup.name
        });
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to create group');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group');
    }
  };

  const StatusIndicator = ({ userId }: { userId: string }) => {
    const status = userStatuses.get(userId);

    const colors: Record<string, string> = {
      online: 'bg-green-500',
      offline: 'bg-gray-500',
      away: 'bg-yellow-500',
      dnd: 'bg-red-500',
      invisible: 'bg-gray-300'
    };

    const displayStatus = status?.status || 'offline';
    const colorClass = colors[displayStatus] || colors.offline;

    return (
      <div 
        className={`w-3 h-3 rounded-full ${colorClass} mr-2`}
        title={displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
      />
    );
  };

  const renderUser = (user: SafeUser) => (
    <li 
      key={user.id}
      className={`mb-2 p-2 rounded cursor-pointer ${
        selectedConversation?.id === user.id 
          ? 'bg-gray-700' 
          : 'hover:bg-gray-700'
      }`}
      onClick={() => handleConversationSelect({
        id: user.id,
        type: 'direct',
        name: user.name || ''
      })}
    >
      <div className="flex items-center">
        <StatusIndicator userId={user.id} />
        @{user.username}
      </div>
    </li>
  );

  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = (status: EffectiveStatus) => {
      userStatuses.set(status.userId, status);
      // Force a re-render since Map mutations don't trigger updates
      setUsers([...users]);
    };

    socket.on('statusChanged', handleStatusChange);

    return () => {
      socket.off('statusChanged', handleStatusChange);
    };
  }, [socket, userStatuses, users]);

  if (status === 'loading') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-400 border-t-primary rounded-full animate-spin" />
          <p className="text-gray-400 text-lg">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen">
      <div className="w-16 bg-gray-900 flex flex-col">
        <div className="flex-grow" />
        <button
          onClick={() => signOut()}
          className="mb-4 mx-1 px-2 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs text-center"
        >
          Logout
        </button>
      </div>

      {showNewMessagePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">New Message</h2>
            <input
              type="text"
              placeholder="Search users..."
              className="w-full px-3 py-2 border rounded-md mb-4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="max-h-60 overflow-y-auto">
              {users
                .filter(user => 
                  user.id !== session?.user?.id &&
                  (user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                   user.username?.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                .slice(0, 10)
                .map(user => (
                  <div
                    key={user.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer rounded"
                    onClick={() => handleNewMessage(user.id, user.name || user.username || '')}
                  >
                    {user.name} (@{user.username})
                  </div>
                ))
              }
            </div>
            <button
              onClick={() => setShowNewMessagePopup(false)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showNewGroupPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Create New Group</h2>
            <input
              type="text"
              placeholder="Group name..."
              className="w-full px-3 py-2 border rounded-md mb-4 text-gray-900"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateGroup();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewGroupPopup(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-1/4 bg-gray-800 text-white flex flex-col">
        <div className="p-4 flex flex-col h-full">
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
              <span>Groups</span>
              <button
                onClick={() => setShowNewGroupPopup(true)}
                className="px-2 py-1 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm"
                title="Create new group"
              >
                +
              </button>
            </h2>
            <ul>
              {groups.map((group) => (
                <li 
                  key={group.id} 
                  className={`mb-2 p-2 rounded cursor-pointer flex items-center justify-between ${
                    selectedConversation?.id === group.id 
                      ? 'bg-gray-700' 
                      : 'hover:bg-gray-700'
                  }`}
                >
                  <div
                    onClick={() => handleConversationSelect({
                      id: group.id,
                      type: 'group',
                      name: group.name
                    })}
                    className="flex-grow"
                  >
                    # {group.name}
                  </div>
                  <button
                    onClick={(e) => handleCreateInvite(group.id, e)}
                    className="ml-2 px-2 py-1 text-xs bg-primary rounded hover:bg-primary/90 transition-colors"
                    title="Create invite link"
                  >
                    Share
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedConversation?.type === 'group' && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Group Members</h2>
                <ul className="overflow-y-auto max-h-40">
                  {users
                    .filter(user => groupMembers.some(member => member.user_id === user.id))
                    .map((user) => (
                      <li 
                        key={user.id}
                        className={`mb-2 p-2 rounded cursor-pointer ${
                          selectedConversation?.id === user.id 
                            ? 'bg-gray-700' 
                            : 'hover:bg-gray-700'
                        }`}
                        onClick={() => handleConversationSelect({
                          id: user.id,
                          type: 'direct',
                          name: user.name || ''
                        })}
                      >
                        <div className="flex items-center">
                          <StatusIndicator userId={user.id} />
                          {user.name} (@{user.username})
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                <span>Recent Contacts</span>
                <button
                  onClick={() => setShowNewMessagePopup(true)}
                  className="px-2 py-1 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm"
                  title="New message"
                >
                  +
                </button>
              </h2>
              <ul className="overflow-y-auto flex-1">
                {users
                  .filter(user => usersWithMessages.has(user.id))
                  .map((user) => (
                    <li 
                      key={user.id}
                      className={`mb-2 p-2 rounded cursor-pointer ${
                        selectedConversation?.id === user.id 
                          ? 'bg-gray-700' 
                          : 'hover:bg-gray-700'
                      }`}
                      onClick={() => handleConversationSelect({
                        id: user.id,
                        type: 'direct',
                        name: user.name || ''
                      })}
                    >
                      <div className="flex items-center">
                        <StatusIndicator userId={user.id} />
                        {user.name} (@{user.username})
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700">
            <CurrentUserStatus />
          </div>
        </div>
      </div>
      <div className="w-3/4 flex flex-col">
        <div className="flex-grow p-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((msg) => {
              const isCurrentUser = msg.sender_id === session?.user?.id;
              
              return (
                <div 
                  key={msg.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] rounded-lg p-3 ${
                    isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-gray-100'
                  }`}>
                    <div className="text-sm font-semibold mb-1">
                      {msg.sender_id === session?.user?.id 
                        ? session.user.username 
                        : users.find(user => user.id === msg.sender_id)?.username || 'Unknown User'}
                    </div>
                    <div className="break-words">
                      {transformMessageContent(msg.content)}
                    </div>
                    <div className="text-xs mt-1 opacity-70">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={
                selectedConversation 
                  ? `Message ${selectedConversation.name}...`
                  : "Select a conversation to start chatting"
              }
              className={`w-full px-3 py-2 border rounded-md transition-colors duration-300 ${
                messageError 
                  ? 'border-red-500' 
                  : 'border-gray-300'
              }`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={!selectedConversation}
            />
            <button 
              onClick={handleSendMessage}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedConversation 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!selectedConversation}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

