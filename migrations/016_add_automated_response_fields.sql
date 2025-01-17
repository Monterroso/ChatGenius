-- Add fields for tracking automated responses
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS is_automated_response BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_message_id UUID REFERENCES messages(id);

-- Add index for faster lookups of automated responses
CREATE INDEX IF NOT EXISTS idx_messages_automated_response 
ON messages(is_automated_response) 
WHERE is_automated_response = TRUE;

-- Add index for original message references
CREATE INDEX IF NOT EXISTS idx_messages_original_message 
ON messages(original_message_id) 
WHERE original_message_id IS NOT NULL; 