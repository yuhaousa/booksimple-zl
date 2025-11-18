-- Add video support to books table
ALTER TABLE "Booklist" 
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS video_file_url TEXT,
ADD COLUMN IF NOT EXISTS video_title TEXT,
ADD COLUMN IF NOT EXISTS video_description TEXT;

-- Add comment
COMMENT ON COLUMN "Booklist".video_url IS 'External video link (YouTube, Vimeo, etc.)';
COMMENT ON COLUMN "Booklist".video_file_url IS 'Uploaded video file storage path';
COMMENT ON COLUMN "Booklist".video_title IS 'Title of the related video';
COMMENT ON COLUMN "Booklist".video_description IS 'Description of the video content';
