-- First, let's check if user_list table exists and what columns it has
-- If auth_user_id column doesn't exist, we'll add it

-- Add auth_user_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_list' AND column_name = 'auth_user_id'
    ) THEN
        ALTER TABLE user_list ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_user_list_auth_user_id ON user_list(auth_user_id);
    END IF;
END $$;

-- Make sure the table has the basic structure
CREATE TABLE IF NOT EXISTS user_list (
    id BIGSERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_list_email ON user_list(email);
CREATE INDEX IF NOT EXISTS idx_user_list_auth_user_id ON user_list(auth_user_id);

-- Enable Row Level Security
ALTER TABLE user_list ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_list;
CREATE POLICY "Users can view own profile" ON user_list
    FOR SELECT USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_list;
CREATE POLICY "Users can update own profile" ON user_list
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Service role can do anything
DROP POLICY IF EXISTS "Service role full access" ON user_list;
CREATE POLICY "Service role full access" ON user_list
    FOR ALL USING (true);
