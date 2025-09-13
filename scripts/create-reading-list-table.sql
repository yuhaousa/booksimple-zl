-- First, check if reading_list table exists and add missing columns
DO $$ 
BEGIN
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reading_list' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE reading_list ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add added_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reading_list' AND column_name = 'added_at'
    ) THEN
        ALTER TABLE reading_list ADD COLUMN added_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reading_list' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE reading_list ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create reading_list table with proper user association (if it doesn't exist)
CREATE TABLE IF NOT EXISTS reading_list (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id BIGINT REFERENCES "Booklist"(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'to_read' CHECK (status IN ('to_read', 'reading', 'completed')),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_id)  -- Prevent duplicate entries
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reading_list_user_id ON reading_list(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_list_book_id ON reading_list(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_list_added_at ON reading_list(added_at);

-- Enable Row Level Security
ALTER TABLE reading_list ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own reading list" ON reading_list;
DROP POLICY IF EXISTS "Users can view their own reading list" ON reading_list;

-- Create RLS policies
CREATE POLICY "Users can view their own reading list" ON reading_list
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert to their own reading list" ON reading_list
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading list" ON reading_list
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own reading list" ON reading_list
    FOR DELETE USING (auth.uid() = user_id);

-- Create a function to automatically set user_id and updated_at
CREATE OR REPLACE FUNCTION set_reading_list_user_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Set user_id to current authenticated user if not provided
    IF NEW.user_id IS NULL THEN
        NEW.user_id = auth.uid();
    END IF;
    
    -- Set updated_at to current timestamp on updates
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS set_reading_list_user_id_trigger ON reading_list;
CREATE TRIGGER set_reading_list_user_id_trigger
    BEFORE INSERT OR UPDATE ON reading_list
    FOR EACH ROW EXECUTE FUNCTION set_reading_list_user_id();

-- Migration: For existing reading_list entries without user_id, 
-- we need to either delete them or assign them to book owners
-- Since we can't know who added them, let's clear existing entries
-- Users will need to re-add books to their reading lists
DELETE FROM reading_list WHERE user_id IS NULL;
