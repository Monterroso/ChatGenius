-- Create a type for system bot names to maintain a list of reserved names
CREATE TYPE system_bot_name AS ENUM ('Auto Response Bot');

-- Add column to identify system bots
ALTER TABLE bot_users ADD COLUMN IF NOT EXISTS is_system_bot BOOLEAN DEFAULT FALSE;

-- Add check constraint to prevent users from using system bot names
ALTER TABLE bot_users ADD CONSTRAINT prevent_system_bot_names 
  CHECK (
    (is_system_bot = TRUE AND name::system_bot_name IS NOT NULL) OR 
    (is_system_bot = FALSE AND name::system_bot_name IS NULL)
  );

-- Add unique constraint on bot_users name
ALTER TABLE bot_users ADD CONSTRAINT bot_users_name_unique UNIQUE (name);

-- Add system bot for automated responses
INSERT INTO bot_users (name, personality, is_system_bot)
VALUES (
  'Auto Response Bot',
  'I am an AI assistant that emulates the communication style and responses of users when they are away or offline. I analyze their previous messages and conversation patterns to provide responses that align with how they would typically respond. I maintain their tone, level of formality, and typical response patterns while being clearly marked as an automated response.',
  TRUE
)
ON CONFLICT (name) DO UPDATE 
SET personality = EXCLUDED.personality;

-- Create function to get system bot id
CREATE OR REPLACE FUNCTION get_system_bot_id() 
RETURNS UUID AS $$
DECLARE
  bot_id UUID;
BEGIN
  SELECT id INTO bot_id FROM bot_users WHERE name = 'Auto Response Bot' AND is_system_bot = TRUE LIMIT 1;
  RETURN bot_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_system_bot_id() IS 'Returns the ID of the system bot used for automated responses';

-- Add index for faster bot lookup by name and system status
CREATE INDEX IF NOT EXISTS idx_bot_users_name_system ON bot_users(name) WHERE is_system_bot = TRUE;

COMMENT ON COLUMN bot_users.is_system_bot IS 'Indicates if this is a system bot. Users cannot create bots with system bot names.';
COMMENT ON TYPE system_bot_name IS 'Enum of reserved system bot names that users cannot use when creating their own bots.'; 