-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'bot_conversations' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE bot_conversations 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Update all existing records to have updated_at set
UPDATE bot_conversations 
SET updated_at = CURRENT_TIMESTAMP 
WHERE updated_at IS NULL; 