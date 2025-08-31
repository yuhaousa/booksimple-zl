-- Create storage buckets for book covers and files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('book-cover', 'book-cover', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('book-file', 'book-file', true, 104857600, ARRAY['application/pdf', 'application/epub+zip', 'application/x-mobipocket-ebook'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create RLS policies for book-cover bucket
CREATE POLICY "Allow public uploads to book-cover" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'book-cover');

CREATE POLICY "Allow public access to book-cover" ON storage.objects
FOR SELECT USING (bucket_id = 'book-cover');

CREATE POLICY "Allow public updates to book-cover" ON storage.objects
FOR UPDATE USING (bucket_id = 'book-cover');

CREATE POLICY "Allow public deletes from book-cover" ON storage.objects
FOR DELETE USING (bucket_id = 'book-cover');

-- Create RLS policies for book-file bucket
CREATE POLICY "Allow public uploads to book-file" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'book-file');

CREATE POLICY "Allow public access to book-file" ON storage.objects
FOR SELECT USING (bucket_id = 'book-file');

CREATE POLICY "Allow public updates to book-file" ON storage.objects
FOR UPDATE USING (bucket_id = 'book-file');

CREATE POLICY "Allow public deletes from book-file" ON storage.objects
FOR DELETE USING (bucket_id = 'book-file');
