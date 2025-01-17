-- This migration adds a unique constraint on the "message_id" column of the "message_embeddings" table
-- so that "ON CONFLICT (message_id) DO NOTHING" will work properly.

ALTER TABLE message_embeddings
ADD CONSTRAINT unique_message_embedding
UNIQUE (message_id); 