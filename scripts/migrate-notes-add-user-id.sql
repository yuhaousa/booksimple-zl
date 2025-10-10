-- Migration: Add user_id column to study_notes table
-- Run this script if your study_notes table already exists without user_id

-- Add user_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'study_notes' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.study_notes 
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_study_notes_user_id ON public.study_notes(user_id);

-- Drop old policy if exists
DROP POLICY IF EXISTS "Allow all operations on study_notes" ON public.study_notes;

-- Create new policies for user-specific access
CREATE POLICY "Users can view their own notes" ON public.study_notes
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON public.study_notes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON public.study_notes
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON public.study_notes
FOR DELETE USING (auth.uid() = user_id);
