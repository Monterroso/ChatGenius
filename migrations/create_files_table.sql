-- Create files table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  filepath VARCHAR(255) NOT NULL,
  filetype VARCHAR(50) NOT NULL,
  filesize BIGINT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by group
CREATE INDEX idx_files_group_id ON files(group_id);

-- Create index for faster lookups by uploader
CREATE INDEX idx_files_uploader_id ON files(uploader_id);

-- Add trigger for updating updated_at timestamp
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add receiver_id column for direct messages
ALTER TABLE files
ADD COLUMN receiver_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add constraint to ensure either group_id or receiver_id is set, but not both
ALTER TABLE files
ADD CONSTRAINT file_destination_check CHECK (
  (group_id IS NOT NULL AND receiver_id IS NULL) OR
  (group_id IS NULL AND receiver_id IS NOT NULL)
);

-- Create index for faster lookups by receiver
CREATE INDEX idx_files_receiver_id ON files(receiver_id); 