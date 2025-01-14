-- Create bot_users table
CREATE TABLE bot_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  api_key TEXT,
  personality TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add user_id column to bot_users
ALTER TABLE bot_users
ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create index for user_id on bot_users (optional for performance)
CREATE INDEX idx_bot_users_user_id ON bot_users(user_id);

-- Create bot_conversations table
CREATE TABLE bot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bot_users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  context JSONB,
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bot_commands table
CREATE TABLE bot_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bot_users(id) ON DELETE CASCADE,
  command VARCHAR(50) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bot_id, command)
);

-- Create bot_knowledge table
CREATE TABLE bot_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bot_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding_id TEXT, -- Store Pinecone vector ID for reference
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_bot_conversations_bot_id ON bot_conversations(bot_id);
CREATE INDEX idx_bot_conversations_user_id ON bot_conversations(user_id);
CREATE INDEX idx_bot_commands_bot_id ON bot_commands(bot_id);
CREATE INDEX idx_bot_knowledge_bot_id ON bot_knowledge(bot_id);

-- Add trigger for updating updated_at columns
CREATE TRIGGER update_bot_users_updated_at
    BEFORE UPDATE ON bot_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_commands_updated_at
    BEFORE UPDATE ON bot_commands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_knowledge_updated_at
    BEFORE UPDATE ON bot_knowledge
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 