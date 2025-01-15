-- First, drop existing foreign key constraints
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;

-- Add sender_type and receiver_type columns to distinguish between users and bots
ALTER TABLE messages
ADD COLUMN sender_type VARCHAR(10) CHECK (sender_type IN ('user', 'bot')) NOT NULL DEFAULT 'user',
ADD COLUMN receiver_type VARCHAR(10) CHECK (receiver_type IN ('user', 'bot')) NOT NULL DEFAULT 'user';

-- Create a function to validate sender_id
CREATE OR REPLACE FUNCTION validate_sender() RETURNS trigger AS $$
BEGIN
  IF NEW.sender_type = 'user' THEN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.sender_id) THEN
      RAISE EXCEPTION 'Invalid user sender_id';
    END IF;
  ELSIF NEW.sender_type = 'bot' THEN
    IF NOT EXISTS (SELECT 1 FROM bot_users WHERE id = NEW.sender_id) THEN
      RAISE EXCEPTION 'Invalid bot sender_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to validate receiver_id
CREATE OR REPLACE FUNCTION validate_receiver() RETURNS trigger AS $$
BEGIN
  IF NEW.receiver_type = 'user' THEN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.receiver_id) THEN
      RAISE EXCEPTION 'Invalid user receiver_id';
    END IF;
  ELSIF NEW.receiver_type = 'bot' THEN
    IF NOT EXISTS (SELECT 1 FROM bot_users WHERE id = NEW.receiver_id) THEN
      RAISE EXCEPTION 'Invalid bot receiver_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to validate sender and receiver
CREATE TRIGGER validate_sender_trigger
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION validate_sender();

CREATE TRIGGER validate_receiver_trigger
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION validate_receiver();

-- Update existing messages to have correct types
UPDATE messages 
SET sender_type = 'user', 
    receiver_type = 'user' 
WHERE sender_type IS NULL 
   OR receiver_type IS NULL; 