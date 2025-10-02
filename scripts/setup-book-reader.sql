-- Setup instructions for the Book Reader Database Tables
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Create book_highlights table
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

-- Step 2: Create book_notes table
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

-- Step 3: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_book_highlights_book_id ON book_highlights(book_id);
CREATE INDEX IF NOT EXISTS idx_book_highlights_user_id ON book_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_book_highlights_page_number ON book_highlights(page_number);

CREATE INDEX IF NOT EXISTS idx_book_notes_book_id ON book_notes(book_id);
CREATE INDEX IF NOT EXISTS idx_book_notes_user_id ON book_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_book_notes_page_number ON book_notes(page_number);

-- Step 4: Enable Row Level Security (RLS)
ALTER TABLE book_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_notes ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for book_highlights (drop existing ones first if they exist)
DROP POLICY IF EXISTS "Users can view their own highlights" ON book_highlights;
DROP POLICY IF EXISTS "Users can insert their own highlights" ON book_highlights;
DROP POLICY IF EXISTS "Users can update their own highlights" ON book_highlights;
DROP POLICY IF EXISTS "Users can delete their own highlights" ON book_highlights;

CREATE POLICY "Users can view their own highlights" ON book_highlights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own highlights" ON book_highlights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights" ON book_highlights
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights" ON book_highlights
  FOR DELETE USING (auth.uid() = user_id);

-- Step 6: Create RLS policies for book_notes (drop existing ones first if they exist)
DROP POLICY IF EXISTS "Users can view their own notes" ON book_notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON book_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON book_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON book_notes;

CREATE POLICY "Users can view their own notes" ON book_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON book_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON book_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON book_notes
  FOR DELETE USING (auth.uid() = user_id);

-- Verification queries (optional - run these to verify setup)
SELECT 'book_highlights table created' as status WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'book_highlights');
SELECT 'book_notes table created' as status WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'book_notes');

-- Show table structures (optional)
-- \d book_highlights
-- \d book_notes
