/**
 * ThreadMessages Component
 * 
 * Displays a threaded conversation with indentation based on reply depth.
 * Features:
 * - Hierarchical message display
 * - Reply functionality
 * - Visual indentation for reply depth
 * - Preserves all message features (reactions, files, etc.)
 * - Smooth scrolling
 */

import { useRef, useEffect, useState, ChangeEvent, KeyboardEvent } from 'react';
import { File, Bot, Reply, X } from 'lucide-react';
import type { DBMessage, FileData } from '@/types/db';
import { MessageReactions } from './MessageReactions';
import { BotMessage } from './BotMessage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ThreadMessagesProps {
  messages: DBMessage[];
  currentUserId: string;
  currentUsername: string;
  users: Array<{ id: string; username: string }>;
  bots: Array<{ id: string; name: string }>;
  reactions: Record<string, any>;
  onReactionSelect: (messageId: string, emoji: string) => Promise<void>;
  onReactionRemove: (messageId: string, emoji: string) => Promise<void>;
  onReply: (messageId: string, content: string) => Promise<void>;
  onClose: () => void;
  transformMessageContent: (content: string) => React.ReactNode;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function ThreadMessages({
  messages,
  currentUserId,
  currentUsername,
  users,
  bots,
  reactions,
  onReactionSelect,
  onReactionRemove,
  onReply,
  onClose,
  transformMessageContent
}: ThreadMessagesProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [threadMessage, setThreadMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get the parent message (first message in the thread)
  const parentMessage = messages[0];

  const handleReply = async (messageId: string) => {
    if (!replyContent.trim()) return;
    await onReply(messageId, replyContent);
    setReplyContent('');
    setReplyingTo(null);
    // Scroll to bottom after reply is added
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleThreadReply = async () => {
    if (!threadMessage.trim() || !parentMessage) return;
    await onReply(parentMessage.id, threadMessage);
    setThreadMessage('');
    // Scroll to bottom after reply is added
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">Thread</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
      >
        <div className="p-4 space-y-4">
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
            
            const depth = msg.depth || 1;
            const marginLeft = depth > 1 ? `${(depth - 1) * 2}rem` : '0';

            return (
              <div key={msg.id} style={{ marginLeft }} className="space-y-2">
                <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={cn(
                    "max-w-[85%] rounded-lg p-3",
                    isCurrentUser 
                      ? "bg-primary text-primary-foreground"
                      : isAutomatedResponse
                        ? "bg-purple-100"
                        : "bg-gray-100",
                    depth > 1 && "border-l-2 border-gray-300"
                  )}>
                    {/* Message Header */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-semibold flex items-center gap-2">
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
                        onClick={() => setReplyingTo(msg.id)}
                      >
                        <Reply className="h-3 w-3 mr-1" />
                        <span className="text-xs">Reply</span>
                      </Button>
                    </div>

                    {/* Message Content */}
                    {isFileMessage ? (
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4" />
                        <div className="flex flex-col">
                          {(() => {
                            const fileData = JSON.parse(msg.content.replace('FILE:', '')) as FileData;
                            return (
                              <>
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
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : isBot ? (
                      <BotMessage
                        content={msg.content}
                        timestamp={new Date(msg.created_at)}
                        sourceDocuments={msg.source_documents ?? undefined}
                        onFeedback={async () => {}} // TODO: Implement feedback
                      />
                    ) : (
                      <div className="break-words">
                        {transformMessageContent(msg.content)}
                      </div>
                    )}

                    {/* Message Footer */}
                    <div className="text-xs mt-1 opacity-70">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </div>
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

                {/* Reply Input */}
                {replyingTo === msg.id && (
                  <div className="flex gap-2" style={{ marginLeft: `${depth * 2}rem` }}>
                    <Textarea
                      value={replyContent}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyContent(e.target.value)}
                      placeholder="Type your reply..."
                      className="min-h-[60px]"
                    />
                    <div className="flex flex-col gap-2">
                      <Button 
                        onClick={() => handleReply(msg.id)}
                        disabled={!replyContent.trim()}
                      >
                        Reply
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Thread Reply Input */}
      <div className="flex-shrink-0 p-4 border-t">
        <div className="flex items-center gap-2">
          <Textarea
            value={threadMessage}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setThreadMessage(e.target.value)}
            placeholder="Reply to thread..."
            className="flex-1 min-h-[60px]"
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleThreadReply();
              }
            }}
          />
          <Button
            onClick={handleThreadReply}
            disabled={!threadMessage.trim()}
          >
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
} 