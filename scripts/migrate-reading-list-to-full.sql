-- Migration script to rename reading_list table to reading_list_full
-- This script safely migrates the existing table and all its dependencies

-- Drop existing policies on the old table
DROP POLICY IF EXISTS "Users can view their own reading list" ON reading_list;
DROP POLICY IF EXISTS "Users can insert to their own reading list" ON reading_list;
DROP POLICY IF EXISTS "Users can update their own reading list" ON reading_list;
DROP POLICY IF EXISTS "Users can delete from their own reading list" ON reading_list;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_reading_list_updated_at ON reading_list;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_reading_list_user_id;
DROP INDEX IF EXISTS idx_reading_list_book_id;
DROP INDEX IF EXISTS idx_reading_list_status;
DROP INDEX IF EXISTS idx_reading_list_user_book;

-- Rename the table
ALTER TABLE IF EXISTS reading_list RENAME TO reading_list_full;

-- Recreate indexes with new table name
CREATE INDEX IF NOT EXISTS idx_reading_list_full_user_id ON reading_list_full(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_list_full_book_id ON reading_list_full(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_list_full_status ON reading_list_full(status);
CREATE INDEX IF NOT EXISTS idx_reading_list_full_user_book ON reading_list_full(user_id, book_id);

-- Recreate trigger with new table name
CREATE OR REPLACE TRIGGER update_reading_list_full_updated_at
    BEFORE UPDATE ON reading_list_full
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Recreate RLS policies with new table name
ALTER TABLE reading_list_full ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reading list"
    ON reading_list_full FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert to their own reading list"
    ON reading_list_full FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own reading list"
    ON reading_list_full FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete from their own reading list"
    ON reading_list_full FOR DELETE
    USING (auth.uid()::text = user_id);
