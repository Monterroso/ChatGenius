-- Create feedback table
CREATE TABLE bot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES bot_users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES bot_conversations(id) ON DELETE CASCADE,
  message_index INTEGER NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  response_time_ms INTEGER,
  token_count INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_bot_feedback_bot_id ON bot_feedback(bot_id);
CREATE INDEX idx_bot_feedback_user_id ON bot_feedback(user_id);
CREATE INDEX idx_bot_feedback_conversation_id ON bot_feedback(conversation_id);
CREATE INDEX idx_bot_feedback_created_at ON bot_feedback(created_at);

-- Add view for aggregated feedback metrics
CREATE VIEW bot_feedback_metrics AS
SELECT 
  bot_id,
  COUNT(*) as total_feedback,
  ROUND(AVG(rating)::numeric, 2) as avg_rating,
  ROUND(AVG(response_time_ms)::numeric, 2) as avg_response_time,
  ROUND(AVG(token_count)::numeric, 2) as avg_token_count,
  COUNT(*) FILTER (WHERE rating >= 4) as positive_feedback,
  COUNT(*) FILTER (WHERE rating <= 2) as negative_feedback
FROM bot_feedback
GROUP BY bot_id; 