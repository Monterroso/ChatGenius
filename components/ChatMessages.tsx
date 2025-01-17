/**
 * ChatMessages Component
 * 
 * A scrollable container for displaying chat messages.
 * Features:
 * - Independent scroll area
 * - Message grouping
 * - File attachments
 * - Reactions
 * - Timestamps
 * - Bot messages
 */

import { useRef, useEffect } from 'react';
import { File, Bot } from 'lucide-react';
import type { DBMessage, FileData } from '@/types/db';
import { MessageReactions } from './MessageReactions';
import { BotMessage } from './BotMessage';

interface ChatMessagesProps {
  messages: DBMessage[];
  currentUserId: string;
  currentUsername: string;
  users: Array<{ id: string; username: string }>;
  bots: Array<{ id: string; name: string }>;
  reactions: Record<string, any>;
  onReactionSelect: (messageId: string, emoji: string) => Promise<void>;
  onReactionRemove: (messageId: string, emoji: string) => Promise<void>;
  transformMessageContent: (content: string) => React.ReactNode;
  shouldScrollToBottom?: boolean;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function ChatMessages({
  messages,
  currentUserId,
  currentUsername,
  users,
  bots,
  reactions,
  onReactionSelect,
  onReactionRemove,
  transformMessageContent,
  shouldScrollToBottom = false
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (shouldScrollToBottom) {
      scrollToBottom();
    }
  }, [shouldScrollToBottom, messages]);

  return (
    <div 
      ref={scrollContainerRef}
      className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
    >
      <div className="min-h-full p-4">
        <div className="space-y-4">
          {messages.map((msg) => {
            const isCurrentUser = msg.sender_id === currentUserId;
            const isFileMessage = msg.content.startsWith('FILE:');
            const isBot = bots.some(bot => bot.id === msg.sender_id);
            const isAutomatedResponse = msg.is_automated_response;
            const senderName = isCurrentUser 
              ? currentUsername
              : isBot
                ? bots.find(bot => bot.id === msg.sender_id)?.name || 'Bot'
                : users.find(user => user.id === msg.sender_id)?.username || 'Unknown User';
            
            if (isFileMessage) {
              const fileData = JSON.parse(msg.content.replace('FILE:', '')) as FileData;
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
                      reactions={reactions[msg.id] || {}}
                      onReactionSelect={(emoji) => onReactionSelect(msg.id, emoji)}
                      onReactionRemove={(emoji) => onReactionRemove(msg.id, emoji)}
                      currentUserId={currentUserId}
                    />
                  </div>
                </div>
              );
            }

            // Handle bot messages
            if (isBot) {
              console.log('Bot Message:', {
                id: msg.id,
                content: msg.content,
                created_at: msg.created_at,
                source_documents: msg.source_documents,
                sender_id: msg.sender_id
              });
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[70%]">
                    <BotMessage
                      content={msg.content}
                      timestamp={new Date(msg.created_at)}
                      sourceDocuments={msg.source_documents ?? undefined}
                      onFeedback={async (rating: number, feedbackText?: string) => {
                        // TODO: Implement feedback handling
                        console.log('Bot message feedback:', { messageId: msg.id, rating, feedbackText });
                      }}
                    />
                    <div className="mt-2">
                      <MessageReactions
                        messageId={msg.id}
                        reactions={reactions[msg.id] || {}}
                        onReactionSelect={(emoji) => onReactionSelect(msg.id, emoji)}
                        onReactionRemove={(emoji) => onReactionRemove(msg.id, emoji)}
                        currentUserId={currentUserId}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            // Regular messages
            return (
              <div 
                key={msg.id}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] rounded-lg p-3 ${
                  isCurrentUser 
                    ? 'bg-primary text-primary-foreground' 
                    : isAutomatedResponse
                      ? 'bg-purple-100'
                      : 'bg-gray-100'
                }`}>
                  <div className="text-sm font-semibold mb-1 flex items-center gap-2">
                    {senderName}
                    {isAutomatedResponse && (
                      <span className="text-xs bg-purple-200 px-2 py-0.5 rounded-full">
                        Auto-Response
                      </span>
                    )}
                  </div>
                  <div className="break-words">
                    {transformMessageContent(msg.content)}
                  </div>
                  <div className="text-xs mt-1 opacity-70">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </div>
                  <div className={`mt-2 text-gray-600 ${
                    isCurrentUser 
                      ? 'bg-primary' 
                      : isAutomatedResponse
                        ? 'bg-purple-100'
                        : 'bg-gray-100'
                  }`}>
                    <MessageReactions
                      messageId={msg.id}
                      reactions={reactions[msg.id] || {}}
                      onReactionSelect={(emoji) => onReactionSelect(msg.id, emoji)}
                      onReactionRemove={(emoji) => onReactionRemove(msg.id, emoji)}
                      currentUserId={currentUserId}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
} 