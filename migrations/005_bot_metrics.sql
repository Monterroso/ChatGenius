-- Create bot metrics table
CREATE TABLE bot_metrics (
  bot_id UUID PRIMARY KEY REFERENCES bot_users(id) ON DELETE CASCADE,
  total_tokens BIGINT DEFAULT 0,
  prompt_tokens BIGINT DEFAULT 0,
  completion_tokens BIGINT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bot errors table
CREATE TABLE bot_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bot_users(id) ON DELETE CASCADE,
  error_type VARCHAR(255) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_bot_errors_bot_id ON bot_errors(bot_id);
CREATE INDEX idx_bot_errors_created_at ON bot_errors(created_at);

-- Add trigger to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_bot_metrics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bot_metrics_last_updated
  BEFORE UPDATE ON bot_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_metrics_timestamp(); 