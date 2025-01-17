-- Migration to add support for threaded replies in messages
-- Adding reply_to_message_id column with foreign key constraint and index

-- Add reply_to_message_id column
ALTER TABLE messages
ADD COLUMN reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Add an index for better performance when querying replies
CREATE INDEX idx_messages_reply_to_message_id ON messages(reply_to_message_id);

-- Add a check constraint to prevent self-replies
ALTER TABLE messages
ADD CONSTRAINT chk_no_self_replies 
CHECK (id != reply_to_message_id);

-- Update the messages table triggers to handle the new column
CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add comment for documentation
COMMENT ON COLUMN messages.reply_to_message_id IS 'References the parent message in a thread. NULL for top-level messages.'; 