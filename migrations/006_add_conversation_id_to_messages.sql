-- Add conversation_id to messages table
ALTER TABLE messages
ADD COLUMN conversation_id UUID REFERENCES bot_conversations(id) ON DELETE CASCADE;

-- Create an index for better query performance
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);

-- Add a partial index for messages with conversation_id
-- This will help optimize queries specifically for bot conversations
CREATE INDEX idx_messages_with_conversation 
ON messages(conversation_id, created_at) 
WHERE conversation_id IS NOT NULL; 