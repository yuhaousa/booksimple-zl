-- Test script to verify ai_book_analysis table exists and can be used
-- Run this in Supabase SQL Editor to troubleshoot

-- 1. Check if table exists
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_book_analysis'
ORDER BY ordinal_position;

-- 2. Check if any data exists
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT book_id) as unique_books,
    COUNT(DISTINCT user_id) as unique_users
FROM ai_book_analysis;

-- 3. Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'ai_book_analysis';

-- 4. Test basic insert (this will fail due to RLS but should show table structure)
-- SELECT 'Testing basic structure - expect RLS error' as test_note;

-- 5. Check if functions exist
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('touch_ai_analysis_access', 'cleanup_old_ai_analysis', 'update_ai_analysis_timestamps');

-- 6. Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'ai_book_analysis';