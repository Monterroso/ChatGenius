CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_primary BOOLEAN DEFAULT FALSE
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sender_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  group_id UUID REFERENCES groups(id),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);


-- Add a unique index that only applies to primary groups
CREATE UNIQUE INDEX single_primary_group 
  ON groups ((TRUE))
  WHERE is_primary = TRUE;

CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  group_id UUID REFERENCES groups(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id)
);

CREATE TABLE group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE OR REPLACE FUNCTION cleanup_expired_invites() RETURNS void AS $$
BEGIN
  DELETE FROM group_invites WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Update user_status table
DROP TABLE IF EXISTS user_status;
CREATE TABLE user_status (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    manual_status TEXT,
    auto_status TEXT CHECK (auto_status IN ('online', 'away', 'dnd', 'offline')),
    invisible BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    devices JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to automatically clean stale devices
CREATE OR REPLACE FUNCTION clean_stale_devices()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean devices that haven't been seen in 5 minutes
  NEW.devices = (
    SELECT COALESCE(
      jsonb_agg(device)
      FILTER (WHERE (device->>'lastSeen')::timestamp with time zone > NOW() - INTERVAL '5 minutes'),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(NEW.devices) AS device
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to clean stale devices before any update
CREATE TRIGGER clean_stale_devices_trigger
  BEFORE UPDATE ON user_status
  FOR EACH ROW
  EXECUTE FUNCTION clean_stale_devices();



-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_status_updated_at
    BEFORE UPDATE ON user_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE user_moods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
    mood TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add trigger for updating the updated_at timestamp
CREATE TRIGGER update_user_moods_updated_at
    BEFORE UPDATE ON user_moods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add the reactions table to store emoji reactions
CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (message_id, user_id, emoji)
);

-- First ensure the column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE messages 
        ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    END IF;
END $$;

-- Update all existing messages to explicitly set deleted_at to NULL
UPDATE messages 
SET deleted_at = NULL 
WHERE deleted_at IS NULL;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at 
ON messages(deleted_at) 
WHERE deleted_at IS NULL;

