-- Remove auto_status field as we calculate status based on last_seen
ALTER TABLE user_status
DROP COLUMN auto_status;

-- Update the check constraint to only allow valid manual statuses
ALTER TABLE user_status
ADD CONSTRAINT valid_manual_status 
CHECK (manual_status IS NULL OR manual_status IN ('online', 'away', 'dnd', 'offline')); 