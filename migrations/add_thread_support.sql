-- Add parent_group_id column to groups table
ALTER TABLE groups
ADD COLUMN parent_group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

-- Add constraint to prevent self-referencing
ALTER TABLE groups 
ADD CONSTRAINT check_not_self_parent 
CHECK (id <> parent_group_id);

-- Add function to enforce single level nesting
CREATE OR REPLACE FUNCTION enforce_single_level_nesting()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_group_id IS NOT NULL THEN
    PERFORM 1 FROM groups WHERE id = NEW.parent_group_id AND parent_group_id IS NOT NULL;
    IF FOUND THEN
      RAISE EXCEPTION 'Threads cannot have threads as parents';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for enforcing single level nesting
CREATE TRIGGER enforce_thread_nesting
BEFORE INSERT OR UPDATE ON groups
FOR EACH ROW EXECUTE FUNCTION enforce_single_level_nesting();

-- Add index for faster lookups of threads by parent
CREATE INDEX idx_groups_parent_id ON groups(parent_group_id); 