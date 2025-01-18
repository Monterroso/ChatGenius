-- Migration to enhance messages table with additional metadata for RAG
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS sender_type VARCHAR(10) CHECK (sender_type IN ('user', 'bot')),
    ADD COLUMN IF NOT EXISTS receiver_type VARCHAR(10) CHECK (receiver_type IN ('user', 'bot')),
    ADD COLUMN IF NOT EXISTS is_automated_response BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS original_message_id UUID REFERENCES messages(id),
    ADD COLUMN IF NOT EXISTS context_metadata JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) CHECK (message_type IN ('text', 'command', 'system', 'auto_response')),
    ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(20) DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'completed', 'failed'));

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_is_automated ON messages(is_automated_response) WHERE is_automated_response = TRUE;
CREATE INDEX IF NOT EXISTS idx_messages_embedding_status ON messages(embedding_status);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);

-- Update existing messages to set default values
UPDATE messages
SET sender_type = 'user',
    receiver_type = 'user',
    message_type = 'text',
    embedding_status = 'pending'
WHERE sender_type IS NULL;

COMMENT ON COLUMN messages.sender_type IS 'Type of the sender (user/bot)';
COMMENT ON COLUMN messages.receiver_type IS 'Type of the receiver (user/bot)';
COMMENT ON COLUMN messages.is_automated_response IS 'Whether this message was automatically generated';
COMMENT ON COLUMN messages.original_message_id IS 'Reference to the original message this auto-response is replying to';
COMMENT ON COLUMN messages.context_metadata IS 'Additional context and metadata about the message in JSON format';
COMMENT ON COLUMN messages.message_type IS 'Type of message (text/command/system/auto_response)';
COMMENT ON COLUMN messages.embedding_status IS 'Status of embedding generation for this message'; 