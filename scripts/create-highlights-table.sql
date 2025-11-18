-- Create highlights table
CREATE TABLE IF NOT EXISTS highlights (
  id BIGSERIAL PRIMARY KEY,
  book_id BIGINT NOT NULL REFERENCES "Booklist"(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  color VARCHAR(50) NOT NULL DEFAULT '#FBBF24',
  page_number INTEGER NOT NULL,
  position JSONB,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_highlights_book_id ON highlights(book_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_book_user ON highlights(book_id, user_id);

-- Enable Row Level Security
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own highlights
CREATE POLICY "Users can view their own highlights"
  ON highlights FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own highlights
CREATE POLICY "Users can insert their own highlights"
  ON highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own highlights
CREATE POLICY "Users can update their own highlights"
  ON highlights FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own highlights
CREATE POLICY "Users can delete their own highlights"
  ON highlights FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE highlights IS 'User highlights from book reading';
COMMENT ON COLUMN highlights.text IS 'The highlighted text content';
COMMENT ON COLUMN highlights.color IS 'Highlight color (hex code)';
COMMENT ON COLUMN highlights.page_number IS 'Page number where highlight is located';
COMMENT ON COLUMN highlights.position IS 'Position data for rendering highlight';
COMMENT ON COLUMN highlights.note IS 'Optional note attached to highlight';
