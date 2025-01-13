import { useState } from 'react';
import { EmojiPicker } from './EmojiPicker';

interface MessageReactionsProps {
  messageId: string;
  reactions: Record<string, Array<{
    userId: string;
    name: string;
    username: string;
  }>>;
  onReactionSelect: (emoji: string) => Promise<void>;
  onReactionRemove: (emoji: string) => Promise<void>;
  currentUserId: string;
}

export const MessageReactions = ({
  messageId,
  reactions = {},
  onReactionSelect,
  onReactionRemove,
  currentUserId
}: MessageReactionsProps) => {
  const [showPicker, setShowPicker] = useState(false);
  console.log("reactions", reactions);
  return (
    <div className="flex items-center gap-1 mt-1 relative">
      {Object.entries(reactions).map(([emoji, users]) => {
        console.log(users);
        const hasReacted = users.some(user => user.userId === currentUserId);
        
        return (
          <button
            key={emoji}
            onClick={() => hasReacted ? onReactionRemove(emoji) : onReactionSelect(emoji)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
              hasReacted 
                ? 'bg-primary/10 text-primary' 
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
            title={users.map(u => u.username).join(', ')}
          >
            <span>{emoji}</span>
            <span className="text-xs">{users.length}</span>
          </button>
        );
      })}
      
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-1 rounded-full hover:bg-gray-100"
        aria-label="Add reaction"
      >
        <span className="text-lg">+</span>
      </button>

      {showPicker && (
        <div className="absolute bottom-full right-0 mb-2 z-10">
          <EmojiPicker
            onSelect={(emoji) => {
              onReactionSelect(emoji);
              setShowPicker(false);
            }}
            onClose={() => setShowPicker(false)}
          />
        </div>
      )}
    </div>
  );
}; 