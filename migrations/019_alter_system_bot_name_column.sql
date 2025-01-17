BEGIN;

-- 1) Drop any default constraint that might rely on the old enum
ALTER TABLE bot_users ALTER COLUMN name DROP DEFAULT;

-- 2) Drop the check constraint that uses the enum
ALTER TABLE bot_users DROP CONSTRAINT IF EXISTS prevent_system_bot_names;

-- 3) Drop the system_bot_name type
DROP TYPE IF EXISTS system_bot_name;

COMMIT;