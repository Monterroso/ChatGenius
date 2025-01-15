-- First, create a backup of the context data in case we need it
CREATE TABLE bot_conversations_context_backup AS
SELECT id, context FROM bot_conversations;

-- Remove the context column and add metadata columns
ALTER TABLE bot_conversations
DROP COLUMN context,
ADD COLUMN name VARCHAR(255),
ADD COLUMN description TEXT,
ADD COLUMN metadata JSONB DEFAULT '{}',
ADD COLUMN status VARCHAR(50) DEFAULT 'active',
ADD COLUMN tags TEXT[] DEFAULT '{}',
ADD COLUMN session_data JSONB DEFAULT '{}',
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add an index for status and archived_at for efficient querying
CREATE INDEX idx_bot_conversations_status ON bot_conversations(status);
CREATE INDEX idx_bot_conversations_archived_at ON bot_conversations(archived_at);

-- Add a GIN index for the tags array and JSONB fields for efficient searching
CREATE INDEX idx_bot_conversations_tags ON bot_conversations USING GIN(tags);
CREATE INDEX idx_bot_conversations_metadata ON bot_conversations USING GIN(metadata);
CREATE INDEX idx_bot_conversations_session_data ON bot_conversations USING GIN(session_data);

-- Add constraints
ALTER TABLE bot_conversations
ADD CONSTRAINT valid_status CHECK (status IN ('active', 'archived', 'deleted'));

-- Update the last_interaction trigger to also set updated_at
CREATE OR REPLACE FUNCTION update_bot_conversation_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_interaction = CURRENT_TIMESTAMP;
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bot_conversation_last_interaction ON bot_conversations;

CREATE TRIGGER update_bot_conversation_timestamps
    BEFORE UPDATE ON bot_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_bot_conversation_timestamps();

-- Add comment to explain the table's new purpose
COMMENT ON TABLE bot_conversations IS 'Stores metadata and session information for bot conversations. Messages are stored in the messages table.';

-- Add comments on columns
COMMENT ON COLUMN bot_conversations.name IS 'Optional name for the conversation';
COMMENT ON COLUMN bot_conversations.description IS 'Optional description of the conversation';
COMMENT ON COLUMN bot_conversations.metadata IS 'Flexible JSONB field for storing additional metadata';
COMMENT ON COLUMN bot_conversations.status IS 'Current status of the conversation: active, archived, or deleted';
COMMENT ON COLUMN bot_conversations.tags IS 'Array of tags for categorizing conversations';
COMMENT ON COLUMN bot_conversations.session_data IS 'Session-specific data like preferences or state';
COMMENT ON COLUMN bot_conversations.archived_at IS 'Timestamp when the conversation was archived'; 