-- Drop unused bot-related tables in the correct order to respect foreign key constraints

-- First drop tables that reference bot_users
DROP TABLE IF EXISTS bot_metrics CASCADE;
DROP TABLE IF EXISTS bot_errors CASCADE;
DROP TABLE IF EXISTS bot_knowledge CASCADE;
DROP TABLE IF EXISTS bot_commands CASCADE;
DROP TABLE IF EXISTS bot_conversations CASCADE;

-- Drop related functions and triggers that are no longer needed
DROP FUNCTION IF EXISTS update_bot_metrics_timestamp CASCADE;

-- Add a comment explaining what was removed
COMMENT ON TABLE bot_users IS 'This table was kept while other bot-related tables (bot_metrics, bot_errors, bot_knowledge, bot_commands, bot_conversations) were removed as they were unused in the application.'; 