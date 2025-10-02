-- Create AI Book Analysis Cache Table
-- This table stores AI-generated book analysis to avoid repeated API calls

-- Create ai_book_analysis table
CREATE TABLE IF NOT EXISTS ai_book_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Analysis content fields
  summary TEXT,
  key_themes TEXT[],
  main_characters TEXT[],
  genre_analysis TEXT,
  reading_level TEXT,
  page_count_estimate INTEGER,
  reading_time_minutes INTEGER,
  
  -- Structured analysis data
  content_analysis JSONB, -- Detailed analysis data
  mind_map_data JSONB,   -- Mind map structure data
  
  -- Metadata
  analysis_version VARCHAR(10) DEFAULT '1.0',
  ai_model_used VARCHAR(50) DEFAULT 'gpt-4',
  content_hash VARCHAR(64), -- SHA-256 hash of book content for cache invalidation
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(book_id, content_hash), -- Prevent duplicate analysis for same content
  CHECK (page_count_estimate > 0),
  CHECK (reading_time_minutes > 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_book_analysis_book_id ON ai_book_analysis(book_id);
CREATE INDEX IF NOT EXISTS idx_ai_book_analysis_user_id ON ai_book_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_book_analysis_content_hash ON ai_book_analysis(content_hash);
CREATE INDEX IF NOT EXISTS idx_ai_book_analysis_created_at ON ai_book_analysis(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_book_analysis_last_accessed ON ai_book_analysis(last_accessed_at);

-- Enable Row Level Security (RLS)
ALTER TABLE ai_book_analysis ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own AI analysis" ON ai_book_analysis;
DROP POLICY IF EXISTS "Users can insert their own AI analysis" ON ai_book_analysis;
DROP POLICY IF EXISTS "Users can update their own AI analysis" ON ai_book_analysis;
DROP POLICY IF EXISTS "Users can delete their own AI analysis" ON ai_book_analysis;

-- Create RLS policies for ai_book_analysis
CREATE POLICY "Users can view their own AI analysis" ON ai_book_analysis
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI analysis" ON ai_book_analysis
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI analysis" ON ai_book_analysis
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI analysis" ON ai_book_analysis
  FOR DELETE USING (auth.uid() = user_id);

-- Create a function to automatically update timestamps and access tracking
CREATE OR REPLACE FUNCTION update_ai_analysis_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Set updated_at timestamp on updates
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = NOW();
        NEW.last_accessed_at = NOW();
    END IF;
    
    -- Set user_id to current authenticated user if not provided on INSERT
    IF TG_OP = 'INSERT' AND NEW.user_id IS NULL THEN
        NEW.user_id = auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for timestamp updates
DROP TRIGGER IF EXISTS update_ai_analysis_timestamps_trigger ON ai_book_analysis;
CREATE TRIGGER update_ai_analysis_timestamps_trigger
    BEFORE INSERT OR UPDATE ON ai_book_analysis
    FOR EACH ROW EXECUTE FUNCTION update_ai_analysis_timestamps();

-- Create a function to update last_accessed_at when analysis is retrieved
CREATE OR REPLACE FUNCTION touch_ai_analysis_access(analysis_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE ai_book_analysis 
    SET last_accessed_at = NOW() 
    WHERE id = analysis_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for JSONB fields (GIN indexes for better JSON query performance)
CREATE INDEX IF NOT EXISTS idx_ai_book_analysis_content_analysis_gin ON ai_book_analysis USING GIN (content_analysis);
CREATE INDEX IF NOT EXISTS idx_ai_book_analysis_mind_map_gin ON ai_book_analysis USING GIN (mind_map_data);

-- Add foreign key constraint (assuming books table exists)
-- Uncomment if you want to enforce referential integrity
-- ALTER TABLE ai_book_analysis ADD CONSTRAINT fk_ai_book_analysis_book_id 
-- FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;

-- Create a view for easy analysis retrieval with book information
CREATE OR REPLACE VIEW ai_book_analysis_with_book_info AS
SELECT 
    aba.*,
    b.title as book_title,
    b.author as book_author,
    b.cover_url as book_cover_url
FROM ai_book_analysis aba
LEFT JOIN "Booklist" b ON aba.book_id = b.id;

-- Grant access to the view
GRANT SELECT ON ai_book_analysis_with_book_info TO authenticated;

-- Create a cleanup function to remove old unused analysis (optional)
CREATE OR REPLACE FUNCTION cleanup_old_ai_analysis(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ai_book_analysis 
    WHERE last_accessed_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Show completion message
SELECT 'AI Book Analysis cache table created successfully!' as result;

-- Show table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_book_analysis' 
ORDER BY ordinal_position;
