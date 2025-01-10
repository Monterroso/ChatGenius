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
  group_id UUID REFERENCES groups(id)
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

CREATE TABLE user_status (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'online',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_status_timestamp
  BEFORE UPDATE ON user_status
  FOR EACH ROW
  EXECUTE FUNCTION update_status_timestamp();

-- Create new user_presence table
CREATE TABLE user_presence (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    presence VARCHAR(20) DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add trigger to update last_seen timestamp
CREATE OR REPLACE FUNCTION update_presence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.last_seen = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_presence_timestamp
    BEFORE UPDATE ON user_presence
    FOR EACH ROW
    EXECUTE FUNCTION update_presence_timestamp();