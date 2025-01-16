'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import type { SafeUser, DBMessage, DBGroup, DBGroupMember, Conversation, AutoStatus, EffectiveStatus, UserMood, MessageReaction, FileData, SearchResult } from '@/types/db';
import { useMessagePolling } from '@/hooks/useMessagePolling';
import { useMoodPolling } from '@/hooks/useMoodPolling';
import { useStatusPolling } from '@/hooks/useStatusPolling';
import { STATUS_COLORS } from '@/lib/constants';
import { createDirectConversation, createGroupConversation } from '@/lib/chat-helpers';
import { useTemporaryState } from '@/hooks/useTemporaryState';
import { MessageReactions } from '@/components/MessageReactions';
import { useReactionPolling } from '@/hooks/useReactionPolling';
import { Upload, File, Trash2 } from 'lucide-react';
import { useFilePolling } from '@/hooks/useFilePolling';
import { BotCreationDialog } from '@/components/BotCreationDialog';
import { GroupInviteButton } from '@/components/GroupInviteButton';
import { FileUpload } from '@/components/FileUpload';
import { StatusIndicator } from '@/components/StatusIndicator';
import { CurrentUserStatus } from '@/components/CurrentUserStatus';
import { FileList } from '@/components/FileList';
import { UserListItem } from '@/components/UserListItem';
import SearchBar from '@/components/SearchBar';
import SearchResultsPopup from '@/components/SearchResultsPopup';
import ChatMessages from '@/components/ChatMessages';

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

type GroupedReactions = Record<string, Array<{
  userId: string;
  name: string;
  username: string;
}>>;

export default function Chat() {
  // Auth & routing
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Core data
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [message, setMessage] = useState('');
  const [groups, setGroups] = useState<DBGroup[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [groupMembers, setGroupMembers] = useState<DBGroupMember[]>([]);
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [messageReactions, setMessageReactions] = useState<Record<string, GroupedReactions>>({});
  const [bots, setBots] = useState<Array<{ id: string; name: string; personality?: string }>>([]);
  const [currentUserMood, setCurrentUserMood] = useState('');
  const [files, setFiles] = useState<FileData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [groupInvites, setGroupInvites] = useState<Record<string, { name: string; isLoading: boolean }>>({});
  
  // UI References & States
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [usersWithMessages, setUsersWithMessages] = useState<Set<string>>(new Set());
  const [showNewMessagePopup, setShowNewMessagePopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewGroupPopup, setShowNewGroupPopup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [messageError, setMessageError] = useTemporaryState(2000);
  const [showBotCreationDialog, setShowBotCreationDialog] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  const fetchCurrentUserMood = async () => {
    if (!session?.user?.id) return;
    
    try {
      const response = await fetch(`/api/mood/${session.user.id}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentUserMood(data.mood || '');
      }
    } catch (error) {
      console.error('Error fetching mood:', error);
    }
  };

  const handleUpdateMood = async (newMood: string) => {
    try {
      await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: newMood })
      });
      setCurrentUserMood(newMood);
    } catch (error) {
      console.error('Error updating mood:', error);
    }
  };
  
  // Memoized Values
  const visibleUserIds = useMemo(() => {
    // Calculate which users are visible in current view
    const ids = new Set<string>();
    
    // Always include current user's ID
    if (session?.user?.id) {
      ids.add(session.user.id);
    }
    
    messages.forEach(msg => {
      // Only add non-bot sender IDs
      if (!bots.some(bot => bot.id === msg.sender_id)) {
        ids.add(msg.sender_id);
      }
    });
    if (selectedConversation?.type === 'group') {
      groupMembers.forEach(member => ids.add(member.user_id));
    }
    if (selectedConversation?.type === 'direct') {
      ids.add(selectedConversation.id);
    }
    return Array.from(ids);
  }, [messages, groupMembers, selectedConversation, bots, session?.user?.id]);
  
  // Polling Hooks for Real-time Data
  const {
    statuses,
    error: statusError,
    isPolling: isStatusPolling
  } = useStatusPolling(visibleUserIds);

  const {
    messages: polledMessages,
    setMessages: setPolledMessages,
    isPolling,
    error: pollingError
  } = useMessagePolling(selectedConversation);

  // Update messages when polling brings new ones
  useEffect(() => {
    setMessages(polledMessages);
  }, [polledMessages]);

  const { moods } = useMoodPolling(visibleUserIds);

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
      fetchBots();
      fetchCurrentUserMood();
    }
  }, [session]);

  const fetchUsers = async () => {
    const response = await fetch('/api/users');
    if (response.ok) {
      const data = await response.json();
      setUsers(data);
    }
  };

  const fetchMessages = async (conversationId: string, type: 'group' | 'direct' | 'bot') => {
    const url = type === 'group'
      ? `/api/messages?groupId=${conversationId}`
      : `/api/messages?userId=${conversationId}`;
    
    try {
      const response = await fetch(url, {
        headers: type === 'bot' ? {
          'x-bot-id': conversationId
        } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
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

  const fetchBots = async () => {
    try {
      const response = await fetch('/api/bots');
      if (response.ok) {
        const data = await response.json();
        setBots(data);
      }
    } catch (error) {
      console.error('Error fetching bots:', error);
    }
  };

  const [botConversations, setBotConversations] = useState<Record<string, string>>({});
  
  const handleSendMessage = async () => {
    if (!message.trim() || !selectedConversation) return;

    try {
      let response;
      
      if (selectedConversation.type === 'bot') {
        console.log('Sending bot message:', {
          botId: selectedConversation.id,
          currentConversationId: botConversations[selectedConversation.id],
          message
        });

        response = await fetch('/api/bots/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-bot-id': selectedConversation.id
          },
          body: JSON.stringify({ 
            message,
            conversationId: botConversations[selectedConversation.id]
          }),
        });

        console.log('Bot message response:', {
          status: response.status,
          ok: response.ok
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Bot response data:', data);
          
          // Store the conversation ID for this bot
          if (data.conversationId) {
            console.log('Updating conversation ID:', {
              botId: selectedConversation.id,
              newConversationId: data.conversationId,
              previousConversationId: botConversations[selectedConversation.id]
            });
            
            setBotConversations(prev => ({
              ...prev,
              [selectedConversation.id]: data.conversationId
            }));
          }
          // After sending message, fetch the updated conversation
          await fetchMessages(selectedConversation.id, 'bot');
          setMessage('');
        } else {
          const errorData = await response.json();
          console.error('Error response from sending bot message:', errorData);
          setMessageError();
        }
      } else {
        response = await fetch('/api/messages', {
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
          setMessageError();
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessageError();
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

  const fetchGroupName = async (inviteId: string) => {
    try {
      setGroupInvites(prev => ({
        ...prev,
        [inviteId]: { name: 'Loading...', isLoading: true }
      }));

      const response = await fetch(`/api/invites/${inviteId}`);
      if (response.ok) {
        const data = await response.json();
        setGroupInvites(prev => ({
          ...prev,
          [inviteId]: { name: data.groupName || 'Unknown Group', isLoading: false }
        }));
      }
    } catch (error) {
      console.error('Error fetching group name:', error);
      setGroupInvites(prev => ({
        ...prev,
        [inviteId]: { name: 'Unknown Group', isLoading: false }
      }));
    }
  };

  const handleJoinGroup = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/invites/${inviteId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        fetchGroups();
        alert(`Successfully joined ${groupInvites[inviteId]?.name || 'group'}!`);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to join group');
      }
    } catch (error) {
      console.error('Error joining group:', error);
      alert('Failed to join group');
    }
  };

  const transformMessageContent = (content: string) => {
    const inviteLinkPattern = new RegExp(`${window.location.origin}/invite/([a-zA-Z0-9-]+)`);
    
    return content.split(' ').map((word, index) => {
      const match = word.match(inviteLinkPattern);
      if (match) {
        const inviteId = match[1];
        // Fetch group name if we don't have it yet
        if (!groupInvites[inviteId]) {
          fetchGroupName(inviteId);
        }
        return (
          <GroupInviteButton 
            key={index} 
            inviteId={inviteId}
            groupName={groupInvites[inviteId]?.name || 'Loading...'}
            isLoading={groupInvites[inviteId]?.isLoading}
            onJoinGroup={handleJoinGroup}
          />
        );
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

  const handleReactionSelect = async (messageId: string, emoji: string) => {
    try {
      const response = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji })
      });

      if (response.ok) {
        const { reactions } = await response.json();
        setMessageReactions(prev => ({
          ...prev,
          [messageId]: reactions
        }));
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleReactionRemove = async (messageId: string, emoji: string) => {
    try {
      const response = await fetch('/api/reactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji })
      });

      if (response.ok) {
        const { reactions } = await response.json();
        setMessageReactions(prev => ({
          ...prev,
          [messageId]: reactions
        }));
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  // Get visible message IDs
  const visibleMessageIds = useMemo(() => 
    messages.map(msg => msg.id),
    [messages]
  );

  // Use the reaction polling hook
  const {
    reactions: polledReactions,
    error: reactionError,
    isPolling: isReactionPolling
  } = useReactionPolling({
    messageIds: visibleMessageIds,
    enabled: visibleMessageIds.length > 0
  });

  // Update the messageReactions state when polled reactions change
  useEffect(() => {
    if (Object.keys(polledReactions).length > 0) {
      setMessageReactions(polledReactions);
    }
  }, [polledReactions]);

  const [fileListRefresh, setFileListRefresh] = useState(0);

  // Add the file polling hook
  const {
    files: polledFiles,
    error: fileError,
    isPolling: isFilePolling
  } = useFilePolling({
    groupId: selectedConversation?.type === 'group' ? selectedConversation.id : undefined,
    receiverId: selectedConversation?.type === 'direct' ? selectedConversation.id : undefined,
    enabled: !!selectedConversation
  });

  // Update messages when file messages are received
  useEffect(() => {
    if (polledFiles.length > 0) {
      // Update the messages that contain files with the latest file data
      setMessages(prevMessages => 
        prevMessages.map(msg => {
          if (msg.content.startsWith('FILE:')) {
            const fileData = JSON.parse(msg.content.replace('FILE:', ''));
            const updatedFile = polledFiles.find(f => f.id === fileData.id);
            if (updatedFile) {
              return {
                ...msg,
                content: `FILE:${JSON.stringify(updatedFile)}`
              };
            }
          }
          return msg;
        })
      );
    }
  }, [polledFiles]);

  const handleBotCreated = (bot: { id: string; name: string; personality?: string }) => {
    setBots(prevBots => [...prevBots, bot]);
    handleConversationSelect({
      id: bot.id,
      type: 'bot',
      name: bot.name
    });
  };

  const handleFileDeleted = (fileId: string) => {
    setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
    setFileListRefresh(prev => prev + 1);
  };

  // Update files when polled files change
  useEffect(() => {
    if (polledFiles.length > 0) {
      setFiles(polledFiles as FileData[]);
    }
  }, [polledFiles]);

  const handleFileSelect = async (file: File) => {
    if (!selectedConversation) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    
    if (selectedConversation.type === 'group') {
      formData.append('groupId', selectedConversation.id);
    } else if (selectedConversation.type === 'direct') {
      formData.append('receiverId', selectedConversation.id);
    }

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const fileData = await response.json();
        
        // Create a message for the file
        const messageResponse = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: `FILE:${JSON.stringify(fileData)}`,
            ...(selectedConversation.type === 'group' 
              ? { groupId: selectedConversation.id } 
              : { receiverId: selectedConversation.id })
          }),
        });

        if (messageResponse.ok) {
          setFileListRefresh(prev => prev + 1);
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSearch = async (query: string, filters: {
    groupId?: string;
    fromUserId?: string;
    toUserId?: string;
  }) => {
    setIsSearching(true);
    setShowSearchResults(true);

    try {
      // Build search URL with parameters
      const searchParams = new URLSearchParams();
      if (query) searchParams.append('query', query);
      if (filters.groupId) searchParams.append('groupId', filters.groupId);
      if (filters.fromUserId) searchParams.append('fromUserId', filters.fromUserId);
      if (filters.toUserId) searchParams.append('toUserId', filters.toUserId);

      const response = await fetch(`/api/search?${searchParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      } else {
        console.error('Search failed:', await response.json());
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchResultClick = (message: SearchResult) => {
    // If it's a group message, select that group
    if (message.group_id) {
      const group = groups.find(g => g.id === message.group_id);
      if (group) {
        handleConversationSelect({
          id: group.id,
          type: 'group',
          name: group.name
        });
      }
    } 
    // If it's a direct message, select that conversation
    else if (message.receiver_id) {
      const otherUserId = message.sender_id === session?.user?.id 
        ? message.receiver_id 
        : message.sender_id;
      
      const user = users.find(u => u.id === otherUserId);
      if (user) {
        handleConversationSelect({
          id: user.id,
          type: 'direct',
          name: user.name || user.username || ''
        });
      }
    }
    setShowSearchResults(false);
  };

  // Modify the scroll behavior to only scroll on new messages
  useEffect(() => {
    // Only scroll if the last message is from the current user or if it's a new message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && (
      lastMessage.sender_id === session?.user?.id || 
      !messages.some(m => m.id === lastMessage.id)
    )) {
      scrollToBottom();
    }
  }, [messages, session?.user?.id]);

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
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-16 bg-gray-900 flex flex-col">
        <div className="flex-grow" />
        <button
          onClick={() => signOut()}
          className="mb-4 mx-1 px-2 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-xs text-center"
        >
          Logout
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Fixed position search bar */}
        <div className="h-16 bg-gray-900 flex items-center px-4">
          <SearchBar
            onSearch={handleSearch}
            groups={groups}
            users={users}
            bots={bots}
            currentUserId={session?.user?.id || ''}
          />
        </div>

        {/* Main content with fixed height */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel (Groups, Bots, etc.) */}
          <div className="w-80 bg-gray-800 text-white flex flex-col overflow-y-auto">
            <div className="p-4 flex flex-col h-full">
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                  <span>Bots</span>
                  <button
                    onClick={() => setShowBotCreationDialog(true)}
                    className="px-2 py-1 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm"
                    title="Add new bot"
                  >
                    +
                  </button>
                </h2>
                <ul>
                  {bots.map((bot) => (
                    <li 
                      key={bot.id} 
                      className={`mb-2 p-2 rounded cursor-pointer flex items-center ${
                        selectedConversation?.id === bot.id 
                          ? 'bg-gray-700' 
                          : 'hover:bg-gray-700'
                      }`}
                      onClick={() => handleConversationSelect({
                        id: bot.id,
                        type: 'bot',
                        name: bot.name
                      })}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>🤖 {bot.name}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

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
                          <UserListItem
                            key={user.id}
                            user={user}
                            moods={moods}
                            statuses={statuses}
                            isSelected={selectedConversation?.id === user.id}
                            onClick={() => handleConversationSelect(createDirectConversation(user))}
                          />
                        ))}
                    </ul>
                  </div>
                )}

                <div className="flex-1 overflow-hidden">
                  <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                    <span>Recent Contacts</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowNewMessagePopup(true)}
                        className="px-2 py-1 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm"
                        title="New message"
                      >
                        +
                      </button>
                    </div>
                  </h2>
                  <ul className="overflow-y-auto flex-1">
                    {users
                      .filter(user => usersWithMessages.has(user.id))
                      .map((user) => (
                        <UserListItem
                          key={user.id}
                          user={user}
                          moods={moods}
                          statuses={statuses}
                          isSelected={selectedConversation?.id === user.id}
                          onClick={() => handleConversationSelect(createDirectConversation(user))}
                        />
                      ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <CurrentUserStatus 
                  statuses={statuses} 
                  currentMood={currentUserMood}
                  onUpdateMood={handleUpdateMood}
                />
              </div>
            </div>
          </div>

          {/* Chat Area with fixed layout */}
          <div className="flex-1 flex flex-col bg-white">
            {/* Messages area with independent scroll */}
            <div className="flex-1 min-h-0">
              <ChatMessages
                messages={messages}
                currentUserId={session.user.id}
                currentUsername={session.user.username}
                users={users}
                bots={bots}
                reactions={polledReactions}
                onReactionSelect={handleReactionSelect}
                onReactionRemove={handleReactionRemove}
                transformMessageContent={transformMessageContent}
                shouldScrollToBottom={
                  messages.length > 0 && 
                  messages[messages.length - 1].sender_id === session.user.id
                }
              />
            </div>

            {/* Fixed input area */}
            <div className="flex-shrink-0 p-4 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={
                    selectedConversation 
                      ? `Message ${selectedConversation.name}...`
                      : "Select a conversation to start chatting"
                  }
                  className={`flex-1 px-3 py-2 border rounded-md transition-colors duration-300 ${
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
                {selectedConversation && (
                  <FileUpload 
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                    onFileSelect={handleFileSelect}
                  />
                )}
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
      </div>

      <BotCreationDialog
        isOpen={showBotCreationDialog}
        onClose={() => setShowBotCreationDialog(false)}
        onBotCreated={handleBotCreated}
      />

      {showSearchResults && (
        <SearchResultsPopup
          results={searchResults}
          isLoading={isSearching}
          onClose={() => setShowSearchResults(false)}
          onMessageClick={handleSearchResultClick}
        />
      )}
    </div>
  );
}

