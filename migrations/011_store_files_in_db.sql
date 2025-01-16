-- Add file_data column to store binary content
ALTER TABLE files
ADD COLUMN file_data BYTEA;

-- Mark filepath as deprecated but keep it for now to support migration
COMMENT ON COLUMN files.filepath IS 'DEPRECATED: File path is no longer used as files are stored in database';

-- Add comment explaining file_data column
COMMENT ON COLUMN files.file_data IS 'Binary content of the uploaded file stored directly in the database'; 