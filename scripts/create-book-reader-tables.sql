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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_book_highlights_book_id ON book_highlights(book_id);
CREATE INDEX IF NOT EXISTS idx_book_highlights_user_id ON book_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_book_highlights_page_number ON book_highlights(page_number);

CREATE INDEX IF NOT EXISTS idx_book_notes_book_id ON book_notes(book_id);
CREATE INDEX IF NOT EXISTS idx_book_notes_user_id ON book_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_book_notes_page_number ON book_notes(page_number);

-- Add foreign key constraints (assuming books table exists)
-- ALTER TABLE book_highlights ADD CONSTRAINT fk_book_highlights_book_id FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
-- ALTER TABLE book_notes ADD CONSTRAINT fk_book_notes_book_id FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

-- Enable Row Level Security (RLS)
ALTER TABLE book_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for book_highlights
CREATE POLICY "Users can view their own highlights" ON book_highlights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own highlights" ON book_highlights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights" ON book_highlights
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights" ON book_highlights
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for book_notes
CREATE POLICY "Users can view their own notes" ON book_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON book_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON book_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON book_notes
  FOR DELETE USING (auth.uid() = user_id);
