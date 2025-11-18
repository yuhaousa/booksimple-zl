-- Create book_tracking table to track reading progress
CREATE TABLE IF NOT EXISTS book_tracking (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES "Booklist"(id) ON DELETE CASCADE,
    current_page INTEGER DEFAULT 1,
    total_pages INTEGER DEFAULT 0,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, book_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_book_tracking_user_id ON book_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_book_tracking_book_id ON book_tracking(book_id);
CREATE INDEX IF NOT EXISTS idx_book_tracking_last_read ON book_tracking(last_read_at);

-- Enable Row Level Security
ALTER TABLE book_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own reading progress" ON book_tracking;
DROP POLICY IF EXISTS "Users can insert their own reading progress" ON book_tracking;
DROP POLICY IF EXISTS "Users can update their own reading progress" ON book_tracking;

CREATE POLICY "Users can view their own reading progress" ON book_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading progress" ON book_tracking
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading progress" ON book_tracking
    FOR UPDATE USING (auth.uid() = user_id);

-- Create function to update reading progress
CREATE OR REPLACE FUNCTION update_reading_progress(
    p_user_id UUID,
    p_book_id BIGINT,
    p_current_page INTEGER,
    p_total_pages INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_progress DECIMAL(5,2);
BEGIN
    -- Calculate progress percentage
    IF p_total_pages > 0 THEN
        v_progress := (p_current_page::DECIMAL / p_total_pages::DECIMAL * 100);
    ELSE
        v_progress := 0;
    END IF;

    -- Insert or update reading progress (only update if new page is greater)
    INSERT INTO book_tracking (user_id, book_id, current_page, total_pages, progress_percentage, last_read_at, updated_at)
    VALUES (p_user_id, p_book_id, p_current_page, p_total_pages, v_progress, NOW(), NOW())
    ON CONFLICT (user_id, book_id) 
    DO UPDATE SET
        current_page = GREATEST(book_tracking.current_page, p_current_page),
        total_pages = p_total_pages,
        progress_percentage = CASE 
            WHEN p_total_pages > 0 THEN (GREATEST(book_tracking.current_page, p_current_page)::DECIMAL / p_total_pages::DECIMAL * 100)
            ELSE 0
        END,
        last_read_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
