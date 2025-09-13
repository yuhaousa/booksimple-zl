-- Create a table to track book clicks/views
CREATE TABLE IF NOT EXISTS book_clicks (
    id BIGSERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES "Booklist"(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    click_type VARCHAR(20) NOT NULL CHECK (click_type IN ('read', 'download')),
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_book_clicks_book_id ON book_clicks(book_id);
CREATE INDEX IF NOT EXISTS idx_book_clicks_user_id ON book_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_book_clicks_clicked_at ON book_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_book_clicks_type ON book_clicks(click_type);

-- Enable Row Level Security
ALTER TABLE book_clicks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view book click records" ON book_clicks;
DROP POLICY IF EXISTS "Users can insert own click records" ON book_clicks;

-- Create a policy for users to see all book click records (for admin purposes)
CREATE POLICY "Users can view book click records" ON book_clicks
    FOR SELECT USING (true);

-- Create a policy for authenticated users to insert their own click records
CREATE POLICY "Users can insert own click records" ON book_clicks
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Create a view for book click statistics
CREATE OR REPLACE VIEW book_click_stats AS
SELECT 
    b.id as book_id,
    b.title,
    COALESCE(click_counts.total_clicks, 0) as total_clicks,
    COALESCE(click_counts.read_clicks, 0) as read_clicks,
    COALESCE(click_counts.download_clicks, 0) as download_clicks,
    COALESCE(click_counts.unique_users, 0) as unique_users,
    click_counts.last_clicked_at
FROM "Booklist" b
LEFT JOIN (
    SELECT 
        book_id,
        COUNT(*) as total_clicks,
        COUNT(*) FILTER (WHERE click_type = 'read') as read_clicks,
        COUNT(*) FILTER (WHERE click_type = 'download') as download_clicks,
        COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users,
        MAX(clicked_at) as last_clicked_at
    FROM book_clicks 
    GROUP BY book_id
) click_counts ON b.id = click_counts.book_id;

-- Create a function to record book clicks (to be called from your app)
CREATE OR REPLACE FUNCTION record_book_click(
    p_book_id INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_click_type TEXT DEFAULT 'read',
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO book_clicks (book_id, user_id, click_type, ip_address, user_agent)
    VALUES (p_book_id, p_user_id, p_click_type, p_ip_address::INET, p_user_agent);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
