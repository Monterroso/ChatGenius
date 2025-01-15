'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import type { SafeUser, DBMessage, DBGroup, DBGroupMember, Conversation, AutoStatus, EffectiveStatus, UserMood, MessageReaction } from '@/types/db';
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

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

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

const CurrentUserStatus = ({ statuses }: { statuses: Map<string, EffectiveStatus> }) => {
  const { data: session } = useSession();
  const [currentMood, setCurrentMood] = useState('');
  const [displayedMood, setDisplayedMood] = useState('');
  const status = session?.user?.id ? statuses.get(session.user.id) : null;

  // Debug logging
  useEffect(() => {
    if (session?.user?.id) {
      console.log('Current user ID:', session.user.id);
      console.log('All statuses:', Array.from(statuses.entries()));
      console.log('Current user status:', status);
    }
  }, [session?.user?.id, statuses, status]);

  useEffect(() => {
    const fetchMood = async () => {
      if (!session?.user?.id) return;
      
      try {
        const response = await fetch(`/api/mood/${session.user.id}`);
        if (response.ok) {
          const data = await response.json();
          setDisplayedMood(data.mood || '');
        }
      } catch (error) {
        console.error('Error fetching mood:', error);
      }
    };

    fetchMood();
  }, [session?.user?.id]);

  const colors: Record<string, string> = STATUS_COLORS;

  const displayStatus = status?.status || 'offline';
  const colorClass = colors[displayStatus] || colors.offline;

  const updateMood = async () => {
    try {
      await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: currentMood })
      });
      setDisplayedMood(currentMood);
      setCurrentMood('');
    } catch (error) {
      console.error('Error updating mood:', error);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full p-2 rounded-md hover:bg-gray-800 transition-colors">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${colorClass}`} />
          <div className="flex flex-col">
            <span className="text-sm text-white">
              {session?.user?.username || 'User'}
            </span>
            {displayedMood && (
              <span className="text-xs text-gray-400">
                {displayedMood}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={currentMood}
          onChange={(e) => setCurrentMood(e.target.value)}
          placeholder="Set mood..."
          className="w-full px-2 py-1 text-sm bg-gray-700 rounded"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateMood();
            }
          }}
        />
        <button
          onClick={updateMood}
          className="px-2 py-1 text-xs bg-primary rounded hover:bg-primary/90"
        >
          Set
        </button>
      </div>
    </div>
  );
};

const StatusIndicator = ({ status }: { status?: EffectiveStatus }) => {
  const displayStatus = status?.status || 'offline';
  const colorClass = STATUS_COLORS[displayStatus] || STATUS_COLORS.offline;
  return (
    <div 
      className={`w-3 h-3 rounded-full ${colorClass} mr-2`}
      title={displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
    />
  );
};

const UserListItem = ({ 
  user, 
  isSelected, 
  onClick,
  moods,
  statuses 
}: { 
  user: SafeUser; 
  isSelected: boolean; 
  onClick: () => void;
  moods: Map<string, UserMood>;
  statuses: Map<string, EffectiveStatus>;
}) => (
  <li 
    className={`mb-2 p-2 rounded cursor-pointer ${
      isSelected ? 'bg-gray-700' : 'hover:bg-gray-700'
    }`}
    onClick={onClick}
  >
    <div className="flex items-center">
      <StatusIndicator status={statuses.get(user.id)} />
      <div className="flex flex-col">
        <span>{user.name} (@{user.username})</span>
        {moods.get(user.id) && (
          <span className="text-xs text-gray-400">
            {moods.get(user.id)?.mood}
          </span>
        )}
      </div>
    </div>
  </li>
);

type GroupedReactions = Record<string, Array<{
  userId: string;
  name: string;
  username: string;
}>>;

interface FileUploadProps {
  groupId?: string;
  receiverId?: string;
  onUploadComplete: () => void;
}

interface FileListProps {
  groupId?: string;
  receiverId?: string;
  currentUserId: string;
  onFileDeleted: () => void;
  refreshTrigger?: number;
}

const FileList = ({ groupId, receiverId, currentUserId, onFileDeleted, refreshTrigger }: FileListProps) => {
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        let url = '/api/files';
        if (groupId) {
          url = `/api/groups/${groupId}/files`;
        } else if (receiverId) {
          url = `/api/messages/${receiverId}/files`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setFiles(data);
        }
      } catch (error) {
        console.error('Error fetching files:', error);
      }
    };

    fetchFiles();
  }, [groupId, receiverId, refreshTrigger]);

  const handleDelete = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setFiles(files.filter(f => f.id !== fileId));
        onFileDeleted();
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div key={file.id} className="flex items-center justify-between p-2 bg-gray-100 rounded">
          <div className="flex items-center gap-2">
            <File className="w-4 h-4" />
            <div className="flex flex-col">
              <a 
                href={file.downloadUrl}
                className="text-sm text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {file.filename}
              </a>
              <span className="text-xs text-gray-500">
                {formatFileSize(file.filesize)} • Uploaded by {file.uploader_username}
              </span>
            </div>
          </div>
          {currentUserId === file.uploader_id && (
            <button
              onClick={() => handleDelete(file.id)}
              className="p-1 hover:bg-gray-200 rounded"
              title="Delete file"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

const FileUpload = ({ groupId, receiverId, onUploadComplete }: FileUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    if (groupId) {
      formData.append('groupId', groupId);
    }
    if (receiverId) {
      formData.append('receiverId', receiverId);
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
            ...(groupId ? { groupId } : { receiverId })
          }),
        });

        if (messageResponse.ok) {
          onUploadComplete();
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

  return (
    <div className="relative">
      <input
        type="file"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
        accept="image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        disabled={isUploading}
      />
      <label
        htmlFor="file-upload"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer ${
          isUploading 
            ? 'bg-gray-300 text-gray-700' 
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        } transition-colors`}
        title="Upload file"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">
          {isUploading ? 'Uploading...' : 'Upload'}
        </span>
      </label>
      {isUploading && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-200 rounded">
          <div 
            className="h-full bg-primary rounded transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
};

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
  
  // UI References & States
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [usersWithMessages, setUsersWithMessages] = useState<Set<string>>(new Set());
  const [showNewMessagePopup, setShowNewMessagePopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewGroupPopup, setShowNewGroupPopup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [messageError, setMessageError] = useTemporaryState(2000);
  const [showBotCreationDialog, setShowBotCreationDialog] = useState(false);
  
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
            <CurrentUserStatus statuses={statuses} />
          </div>
        </div>
      </div>
      <div className="w-3/4 flex flex-col">
        <div className="flex-grow p-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((msg) => {
              const isCurrentUser = msg.sender_id === session?.user?.id;
              const isFileMessage = msg.content.startsWith('FILE:');
              const isBot = bots.some(bot => bot.id === msg.sender_id);
              const senderName = isCurrentUser 
                ? session.user.username 
                : isBot
                  ? bots.find(bot => bot.id === msg.sender_id)?.name || 'Bot'
                  : users.find(user => user.id === msg.sender_id)?.username || 'Unknown User';
              
              if (isFileMessage) {
                const fileData = JSON.parse(msg.content.replace('FILE:', ''));
                return (
                  <div 
                    key={msg.id}
                    className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] rounded-lg p-3 ${
                      isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-gray-100'
                    }`}>
                      <div className="text-sm font-semibold mb-1">
                        {senderName}
                      </div>
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4" />
                        <div className="flex flex-col">
                          <a 
                            href="#"
                            className="text-sm hover:underline"
                            onClick={(e) => {
                              e.preventDefault();
                              window.open(`/api/files/${fileData.id}/download`, '_blank');
                            }}
                          >
                            {fileData.filename}
                            <span className="text-xs ml-2 opacity-70">
                              ({formatFileSize(fileData.filesize)})
                            </span>
                          </a>
                          <span className="text-xs opacity-70">
                            {new Date(fileData.uploaded_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <MessageReactions
                        messageId={msg.id}
                        reactions={polledReactions[msg.id] || {}}
                        onReactionSelect={(emoji) => handleReactionSelect(msg.id, emoji)}
                        onReactionRemove={(emoji) => handleReactionRemove(msg.id, emoji)}
                        currentUserId={session.user.id}
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={msg.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] rounded-lg p-3 ${
                    isCurrentUser ? 'bg-primary text-primary-foreground' : isBot ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <div className="text-sm font-semibold mb-1">
                      {isBot ? `🤖 ${senderName}` : senderName}
                    </div>
                    <div className="break-words">
                      {transformMessageContent(msg.content)}
                    </div>
                    <div className="text-xs mt-1 opacity-70">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </div>
                    <div className={`mt-2 text-gray-600 ${
                      isCurrentUser ? 'bg-primary' : isBot ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <MessageReactions
                        messageId={msg.id}
                        reactions={polledReactions[msg.id] || {}}
                        onReactionSelect={(emoji) => handleReactionSelect(msg.id, emoji)}
                        onReactionRemove={(emoji) => handleReactionRemove(msg.id, emoji)}
                        currentUserId={session.user.id}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="p-4 border-t">
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
                groupId={selectedConversation.type === 'group' ? selectedConversation.id : undefined}
                receiverId={selectedConversation.type === 'direct' ? selectedConversation.id : undefined}
                onUploadComplete={() => {
                  setFileListRefresh(prev => prev + 1);
                }}
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

      <BotCreationDialog
        isOpen={showBotCreationDialog}
        onClose={() => setShowBotCreationDialog(false)}
        onBotCreated={handleBotCreated}
      />
    </div>
  );
}

