-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create message_embeddings table
CREATE TABLE message_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    embedding vector(1536), -- Using 1536 dimensions which is standard for many embedding models
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Add indexes for better query performance
    CONSTRAINT fk_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Note: Existing messages will not be automatically vectorized during this migration.
-- This is because vector generation requires calling an external API (like OpenAI's embedding API)
-- and should be handled by a separate migration script in TypeScript/JavaScript that can:
-- 1. Batch process messages to avoid rate limits
-- 2. Handle API errors gracefully
-- 3. Track progress and allow for resuming if interrupted
-- 4. Manage costs of API calls

-- Create an index for vector similarity search
CREATE INDEX message_embeddings_embedding_idx ON message_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Add is_bot_generated column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_bot_generated BOOLEAN DEFAULT FALSE;

-- Function to ensure only one embedding per message
CREATE OR REPLACE FUNCTION ensure_single_embedding()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM message_embeddings WHERE message_id = NEW.message_id) > 0 THEN
        RAISE EXCEPTION 'Message already has an embedding';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce one embedding per message
CREATE TRIGGER single_embedding_per_message
BEFORE INSERT ON message_embeddings
FOR EACH ROW
EXECUTE FUNCTION ensure_single_embedding();

-- Down migration
-- CREATE OR REPLACE FUNCTION down_015()
-- RETURNS void AS $$
-- BEGIN
--     DROP TRIGGER IF EXISTS single_embedding_per_message ON message_embeddings;
--     DROP FUNCTION IF EXISTS ensure_single_embedding;
--     ALTER TABLE messages DROP COLUMN IF EXISTS is_bot_generated;
--     DROP INDEX IF EXISTS message_embeddings_embedding_idx;
--     DROP TABLE IF EXISTS message_embeddings;
--     DROP EXTENSION IF EXISTS vector;
-- END;
-- $$ LANGUAGE plpgsql; 