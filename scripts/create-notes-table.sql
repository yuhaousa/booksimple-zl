-- Create study notes table
CREATE TABLE IF NOT EXISTS public.study_notes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  title character varying NOT NULL,
  content text,
  book_id bigint REFERENCES public.Booklist(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tags text,
  category character varying,
  CONSTRAINT study_notes_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;

-- Drop old policy if exists
DROP POLICY IF EXISTS "Allow all operations on study_notes" ON public.study_notes;

-- Create policy to allow users to manage their own notes
CREATE POLICY "Users can view their own notes" ON public.study_notes
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON public.study_notes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON public.study_notes
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON public.study_notes
FOR DELETE USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_study_notes_book_id ON public.study_notes(book_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_user_id ON public.study_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_created_at ON public.study_notes(created_at DESC);
