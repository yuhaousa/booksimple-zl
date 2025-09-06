-- Create study notes table
CREATE TABLE IF NOT EXISTS public.study_notes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  title character varying NOT NULL,
  content text,
  book_id bigint REFERENCES public.Booklist(id) ON DELETE SET NULL,
  tags text,
  category character varying,
  CONSTRAINT study_notes_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on study_notes" ON public.study_notes
FOR ALL USING (true) WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_study_notes_book_id ON public.study_notes(book_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_created_at ON public.study_notes(created_at DESC);
