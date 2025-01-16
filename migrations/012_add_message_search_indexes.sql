-- Add indexes to improve search performance
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, receiver_type);
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Add a composite index for common search patterns
CREATE INDEX IF NOT EXISTS idx_messages_search_composite ON messages(sender_id, receiver_id, group_id, created_at DESC)
WHERE deleted_at IS NULL; 