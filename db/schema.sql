CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sender_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  group_id UUID REFERENCES groups(id)
);

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_primary BOOLEAN DEFAULT FALSE,
  CONSTRAINT single_primary_group 
    CHECK (
      NOT (is_primary IS TRUE AND EXISTS (
        SELECT 1 FROM groups g2 
        WHERE g2.is_primary IS TRUE 
        AND g2.id != id
      ))
    )
);

CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  group_id UUID REFERENCES groups(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id)
);

CREATE TABLE group_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE OR REPLACE FUNCTION cleanup_expired_invites() RETURNS void AS $$
BEGIN
  DELETE FROM group_invites WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

