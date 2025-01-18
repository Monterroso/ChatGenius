-- Migration to enhance messages table with essential fields for improved RAG
-- This migration adds only the fields that cannot be derived at embedding time

-- Add thread tracking columns to messages
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS parent_thread_id UUID REFERENCES messages(id),
    ADD COLUMN IF NOT EXISTS thread_depth INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS conversation_context JSONB DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN messages.parent_thread_id IS 'ID of the parent message in a conversation thread';
COMMENT ON COLUMN messages.thread_depth IS 'Depth level in the conversation thread (0 for top-level messages)';
COMMENT ON COLUMN messages.conversation_context IS 'Stores contextual information about the conversation state when this message was sent';

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_messages_parent_thread ON messages(parent_thread_id) WHERE parent_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_thread_depth ON messages(thread_depth);

-- Update message_embeddings table to track usage statistics
ALTER TABLE message_embeddings
    ADD COLUMN IF NOT EXISTS last_retrieved_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS retrieval_count INTEGER DEFAULT 0;

-- Add index for tracking frequently retrieved embeddings
CREATE INDEX IF NOT EXISTS idx_embeddings_retrieval_count ON message_embeddings(retrieval_count DESC);

-- Add trigger to update last_retrieved_at and increment retrieval_count
CREATE OR REPLACE FUNCTION update_embedding_retrieval_stats()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_retrieved_at = CURRENT_TIMESTAMP;
    NEW.retrieval_count = OLD.retrieval_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_embedding_retrieval
    BEFORE UPDATE OF last_retrieved_at ON message_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_embedding_retrieval_stats(); 