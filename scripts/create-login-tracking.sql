-- Create a table to track user logins
CREATE TABLE IF NOT EXISTS login_tracking (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    login_timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_login_tracking_user_id ON login_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_login_tracking_timestamp ON login_tracking(login_timestamp);

-- Enable Row Level Security
ALTER TABLE login_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view own login records" ON login_tracking;

-- Create a policy for authenticated users to see only their own login records
CREATE POLICY "Users can view own login records" ON login_tracking
    FOR SELECT USING (auth.uid() = user_id);

-- Drop and recreate admin policy if needed
-- DROP POLICY IF EXISTS "Admins can view all login records" ON login_tracking;
-- CREATE POLICY "Admins can view all login records" ON login_tracking
--     FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Create a view for login statistics
CREATE OR REPLACE VIEW user_login_stats AS
SELECT 
    u.id as user_id,
    u.email,
    u.last_sign_in_at,
    u.created_at as user_created_at,
    COALESCE(login_counts.total_logins, 0) as total_logins,
    COALESCE(login_counts.last_login_at, u.last_sign_in_at) as last_login_at,
    COALESCE(login_counts.first_login_at, u.created_at) as first_login_at
FROM auth.users u
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_logins,
        MAX(login_timestamp) as last_login_at,
        MIN(login_timestamp) as first_login_at
    FROM login_tracking 
    GROUP BY user_id
) login_counts ON u.id = login_counts.user_id;

-- Create a function to record login events (to be called from your app)
CREATE OR REPLACE FUNCTION record_login(
    p_user_id UUID,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO login_tracking (user_id, ip_address, user_agent, session_id)
    VALUES (p_user_id, p_ip_address::INET, p_user_agent, p_session_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
