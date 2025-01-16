-- Drop existing trigger first
DROP TRIGGER IF EXISTS validate_receiver_trigger ON messages;

-- Create updated function to validate receiver_id
CREATE OR REPLACE FUNCTION validate_receiver() RETURNS trigger AS $$
BEGIN
  -- If group_id is set, receiver_id should be null
  IF NEW.group_id IS NOT NULL THEN
    IF NEW.receiver_id IS NOT NULL THEN
      RAISE EXCEPTION 'receiver_id must be null for group messages';
    END IF;
    -- Set receiver_type to 'user' for group messages
    NEW.receiver_type = 'user';
    RETURN NEW;
  END IF;

  -- For direct messages (where group_id is null), validate the receiver
  IF NEW.receiver_id IS NULL THEN
    RAISE EXCEPTION 'receiver_id is required for direct messages';
  END IF;

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

-- Recreate the trigger with the updated function
CREATE TRIGGER validate_receiver_trigger
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION validate_receiver();

-- Add comment explaining the validation rules
COMMENT ON FUNCTION validate_receiver() IS 'Validates message receiver_id and receiver_type based on whether the message is a group message or direct message. For group messages, receiver_id must be null. For direct messages, receiver_id must be valid and match the receiver_type.'; 