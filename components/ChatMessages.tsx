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
 * - Threaded replies
 */

import { useRef, useEffect, useState } from 'react';
import { File, Bot, Reply, MessageSquare } from 'lucide-react';
import type { DBMessage, FileData } from '@/types/db';
import { MessageReactions } from './MessageReactions';
import { BotMessage } from './BotMessage';
import { Button } from './ui/button';
import { Sheet, SheetContent } from './ui/sheet';
import ThreadMessages from './ThreadMessages';
import { cn } from '@/lib/utils';

interface ChatMessagesProps {
  messages: DBMessage[];
  currentUserId: string;
  currentUsername: string;
  users: Array<{ id: string; username: string }>;
  bots: Array<{ id: string; name: string }>;
  reactions: Record<string, any>;
  onReactionSelect: (messageId: string, emoji: string) => Promise<void>;
  onReactionRemove: (messageId: string, emoji: string) => Promise<void>;
  onReply: (messageId: string, content: string) => Promise<void>;
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
  onReply,
  transformMessageContent,
  shouldScrollToBottom = false
}: ChatMessagesProps) {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<DBMessage[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
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

  // Load thread messages when a thread is selected
  useEffect(() => {
    if (!selectedThread) {
      setThreadMessages([]);
      return;
    }

    const fetchThread = async () => {
      setIsLoadingThread(true);
      try {
        const response = await fetch(`/api/messages/${selectedThread}/thread`);
        if (!response.ok) throw new Error('Failed to fetch thread');
        const data = await response.json();
        setThreadMessages(data);
      } catch (error) {
        console.error('Error fetching thread:', error);
        // TODO: Show error toast
      } finally {
        setIsLoadingThread(false);
      }
    };

    fetchThread();
  }, [selectedThread]);

  // Filter out reply messages from the main chat
  const mainMessages = messages.filter(msg => !msg.reply_to_message_id);

  return (
    <>
      <div 
        ref={scrollContainerRef}
        className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
      >
        <div className="min-h-full p-4">
          <div className="space-y-4">
            {mainMessages.map((msg) => {
              const isCurrentUser = msg.sender_id === currentUserId;
              const isFileMessage = msg.content.startsWith('FILE:');
              const isBot = bots.some(bot => bot.id === msg.sender_id);
              const isAutomatedResponse = msg.is_automated_response;
              const hasReplies = messages.some(m => m.reply_to_message_id === msg.id);
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
                    <div className={cn(
                      "max-w-[70%] rounded-lg p-3",
                      isCurrentUser ? "bg-primary text-primary-foreground" : "bg-gray-100"
                    )}>
                      <div className="text-sm font-semibold mb-1 flex items-center justify-between">
                        <span>{senderName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => setSelectedThread(msg.id)}
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          <span className="text-xs">Reply</span>
                        </Button>
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
                      {hasReplies && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() => setSelectedThread(msg.id)}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          <span className="text-xs">View Thread</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              }

              // Handle bot messages
              if (isBot) {
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="max-w-[70%]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">{senderName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => setSelectedThread(msg.id)}
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          <span className="text-xs">Reply</span>
                        </Button>
                      </div>
                      <BotMessage
                        content={msg.content}
                        timestamp={new Date(msg.created_at)}
                        sourceDocuments={msg.source_documents ?? undefined}
                        onFeedback={async () => {}} // TODO: Implement feedback
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
                      {hasReplies && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() => setSelectedThread(msg.id)}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          <span className="text-xs">View Thread</span>
                        </Button>
                      )}
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
                  <div className={cn(
                    "max-w-[70%] rounded-lg p-3",
                    isCurrentUser 
                      ? "bg-primary text-primary-foreground" 
                      : isAutomatedResponse
                        ? "bg-purple-100"
                        : "bg-gray-100"
                  )}>
                    <div className="text-sm font-semibold mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {senderName}
                        {isAutomatedResponse && (
                          <span className="text-xs bg-purple-200 px-2 py-0.5 rounded-full">
                            Auto-Response
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => setSelectedThread(msg.id)}
                      >
                        <Reply className="h-3 w-3 mr-1" />
                        <span className="text-xs">Reply</span>
                      </Button>
                    </div>
                    <div className="break-words">
                      {transformMessageContent(msg.content)}
                    </div>
                    <div className="text-xs mt-1 opacity-70">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </div>
                    <div className={cn(
                      "mt-2",
                      isCurrentUser 
                        ? "bg-primary" 
                        : isAutomatedResponse
                          ? "bg-purple-100"
                          : "bg-gray-100"
                    )}>
                      <MessageReactions
                        messageId={msg.id}
                        reactions={reactions[msg.id] || {}}
                        onReactionSelect={(emoji) => onReactionSelect(msg.id, emoji)}
                        onReactionRemove={(emoji) => onReactionRemove(msg.id, emoji)}
                        currentUserId={currentUserId}
                      />
                    </div>
                    {hasReplies && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => setSelectedThread(msg.id)}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        <span className="text-xs">View Thread</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Thread Panel */}
      <Sheet open={!!selectedThread} onOpenChange={() => setSelectedThread(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0">
          {selectedThread && (
            <ThreadMessages
              messages={threadMessages}
              currentUserId={currentUserId}
              currentUsername={currentUsername}
              users={users}
              bots={bots}
              reactions={reactions}
              onReactionSelect={onReactionSelect}
              onReactionRemove={onReactionRemove}
              onReply={onReply}
              onClose={() => setSelectedThread(null)}
              transformMessageContent={transformMessageContent}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
} 