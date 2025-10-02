-- Complete Database Setup for Book Reader Application
-- This script creates all necessary tables and configurations

-- =====================================================
-- 1. READING LIST TABLE
-- =====================================================

-- Create reading_list_full table with proper user association (if it doesn't exist)
CREATE TABLE IF NOT EXISTS reading_list_full (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id BIGINT REFERENCES "Booklist"(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'to_read' CHECK (status IN ('to_read', 'reading', 'completed')),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_id)  -- Prevent duplicate entries
);

-- Add missing columns to existing table if they don't exist
DO $$ 
BEGIN
    -- Add user_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reading_list_full' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE reading_list_full ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add added_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reading_list_full' AND column_name = 'added_at'
    ) THEN
        ALTER TABLE reading_list_full ADD COLUMN added_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reading_list_full' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE reading_list_full ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for reading list
CREATE INDEX IF NOT EXISTS idx_reading_list_full_user_id ON reading_list_full(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_list_full_book_id ON reading_list_full(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_list_full_added_at ON reading_list_full(added_at);

-- Enable Row Level Security for reading list
ALTER TABLE reading_list_full ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies for reading_list_full if they exist
DO $$ 
DECLARE 
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'reading_list_full'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON reading_list_full', policy_name);
    END LOOP;
END $$;

-- Create RLS policies for reading list
CREATE POLICY "Users can view their own reading list" ON reading_list_full
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert to their own reading list" ON reading_list_full
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading list" ON reading_list_full
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own reading list" ON reading_list_full
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 2. BOOK HIGHLIGHTS TABLE
-- =====================================================

-- Create book_highlights table
CREATE TABLE IF NOT EXISTS book_highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id INTEGER NOT NULL,
  page_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  color VARCHAR(7) NOT NULL,
  position JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. BOOK NOTES TABLE
-- =====================================================

-- Create book_notes table
CREATE TABLE IF NOT EXISTS book_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id INTEGER NOT NULL,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  position JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. CUSTOM OUTLINE TABLE
-- =====================================================

-- Create custom_outline table for user-defined bookmarks
CREATE TABLE IF NOT EXISTS custom_outline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  parent_id UUID REFERENCES custom_outline(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  original_pdf_index INTEGER, -- Links to original PDF outline item if this is an override
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to custom_outline table if they don't exist
DO $$ 
BEGIN
    -- Add original_pdf_index column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'custom_outline' AND column_name = 'original_pdf_index'
    ) THEN
        ALTER TABLE custom_outline ADD COLUMN original_pdf_index INTEGER;
    END IF;
END $$;

-- =====================================================
-- 5. INDEXES FOR PERFORMANCE
-- =====================================================

-- Add indexes for book highlights
CREATE INDEX IF NOT EXISTS idx_book_highlights_book_id ON book_highlights(book_id);
CREATE INDEX IF NOT EXISTS idx_book_highlights_user_id ON book_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_book_highlights_page_number ON book_highlights(page_number);

-- Add indexes for book notes
CREATE INDEX IF NOT EXISTS idx_book_notes_book_id ON book_notes(book_id);
CREATE INDEX IF NOT EXISTS idx_book_notes_user_id ON book_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_book_notes_page_number ON book_notes(page_number);

-- Add indexes for custom outline
CREATE INDEX IF NOT EXISTS idx_custom_outline_book_id ON custom_outline(book_id);
CREATE INDEX IF NOT EXISTS idx_custom_outline_user_id ON custom_outline(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_outline_parent_id ON custom_outline(parent_id);
CREATE INDEX IF NOT EXISTS idx_custom_outline_sort_order ON custom_outline(sort_order);
CREATE INDEX IF NOT EXISTS idx_custom_outline_pdf_index ON custom_outline(book_id, user_id, original_pdf_index);

-- =====================================================
-- 6. ROW LEVEL SECURITY FOR BOOK READER TABLES
-- =====================================================

-- Enable Row Level Security
ALTER TABLE book_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_outline ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies for book_highlights if they exist
DO $$ 
DECLARE 
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'book_highlights'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON book_highlights', policy_name);
    END LOOP;
END $$;

-- Create RLS policies for book_highlights
CREATE POLICY "Users can view their own highlights" ON book_highlights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own highlights" ON book_highlights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights" ON book_highlights
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights" ON book_highlights
  FOR DELETE USING (auth.uid() = user_id);

-- Drop ALL existing policies for book_notes if they exist
DO $$ 
DECLARE 
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'book_notes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON book_notes', policy_name);
    END LOOP;
END $$;

-- Create RLS policies for book_notes
CREATE POLICY "Users can view their own notes" ON book_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON book_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON book_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON book_notes
  FOR DELETE USING (auth.uid() = user_id);

-- Drop ALL existing policies for custom_outline if they exist
DO $$ 
DECLARE 
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'custom_outline'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON custom_outline', policy_name);
    END LOOP;
END $$;

-- Create RLS policies for custom_outline
CREATE POLICY "Users can view their own custom outline" ON custom_outline
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own custom outline" ON custom_outline
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom outline" ON custom_outline
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom outline" ON custom_outline
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 7. TRIGGERS AND FUNCTIONS
-- =====================================================

-- Create a function to automatically set user_id and updated_at for reading list
CREATE OR REPLACE FUNCTION set_reading_list_full_user_id()
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

-- Create trigger for reading list
DROP TRIGGER IF EXISTS set_reading_list_full_user_id_trigger ON reading_list_full;
CREATE TRIGGER set_reading_list_full_user_id_trigger
    BEFORE INSERT OR UPDATE ON reading_list_full
    FOR EACH ROW EXECUTE FUNCTION set_reading_list_full_user_id();

-- Create a function to automatically set user_id and updated_at for custom outline
CREATE OR REPLACE FUNCTION set_custom_outline_user_id()
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

-- Create trigger for custom outline
DROP TRIGGER IF EXISTS set_custom_outline_user_id_trigger ON custom_outline;
CREATE TRIGGER set_custom_outline_user_id_trigger
    BEFORE INSERT OR UPDATE ON custom_outline
    FOR EACH ROW EXECUTE FUNCTION set_custom_outline_user_id();

-- =====================================================
-- 8. CLEANUP AND FINAL STEPS
-- =====================================================

-- Clean up any existing reading list entries without user_id
DELETE FROM reading_list_full WHERE user_id IS NULL;

-- Show completion message
SELECT 'Database setup completed successfully!' as result;