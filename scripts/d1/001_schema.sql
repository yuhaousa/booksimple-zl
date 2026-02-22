-- D1 bootstrap schema for booksimple-zl
-- Converted from Supabase/Postgres design to SQLite-compatible D1 SQL.
-- Notes:
-- 1) UUID/JSONB/TIMESTAMPTZ are stored as TEXT.
-- 2) RLS/policies/functions are not supported in D1 and must be handled in app code.
-- 3) Arrays (for example key_themes) are stored as JSON string TEXT.

PRAGMA foreign_keys = ON;

-- Core books table used throughout the app.
CREATE TABLE IF NOT EXISTS "Booklist" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title TEXT,
  description TEXT,
  author TEXT,
  publisher TEXT,
  isbn TEXT,
  tags TEXT,
  year INTEGER,
  cover_url TEXT,
  file_url TEXT,
  user_id TEXT,
  video_url TEXT,
  video_file_url TEXT,
  video_title TEXT,
  video_description TEXT
);

-- Optional local profile mirror (previously from Supabase auth/profile tables).
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  auth_user_id TEXT UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS reading_list_full (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  book_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'to_read' CHECK (status IN ('to_read', 'reading', 'completed')),
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, book_id),
  FOREIGN KEY (book_id) REFERENCES "Booklist"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title TEXT NOT NULL,
  content TEXT,
  book_id INTEGER,
  user_id TEXT,
  tags TEXT,
  category TEXT,
  FOREIGN KEY (book_id) REFERENCES "Booklist"(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS book_notes (
  id TEXT PRIMARY KEY,
  book_id INTEGER NOT NULL,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  position TEXT NOT NULL,
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES "Booklist"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS book_highlights (
  id TEXT PRIMARY KEY,
  book_id INTEGER NOT NULL,
  page_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  color TEXT NOT NULL,
  position TEXT NOT NULL,
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES "Booklist"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS custom_outline (
  id TEXT PRIMARY KEY,
  book_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  parent_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  original_pdf_index INTEGER,
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES "Booklist"(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES custom_outline(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_book_analysis (
  id TEXT PRIMARY KEY,
  book_id INTEGER NOT NULL,
  user_id TEXT,
  summary TEXT,
  key_themes TEXT,
  main_characters TEXT,
  genre_analysis TEXT,
  reading_level TEXT,
  page_count_estimate INTEGER,
  reading_time_minutes INTEGER,
  content_analysis TEXT,
  mind_map_data TEXT,
  analysis_version TEXT DEFAULT '1.0',
  ai_model_used TEXT DEFAULT 'gpt-4o-mini',
  content_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (book_id, content_hash),
  CHECK (page_count_estimate IS NULL OR page_count_estimate > 0),
  CHECK (reading_time_minutes IS NULL OR reading_time_minutes > 0),
  FOREIGN KEY (book_id) REFERENCES "Booklist"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS book_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  book_id INTEGER NOT NULL,
  current_page INTEGER NOT NULL DEFAULT 1,
  total_pages INTEGER NOT NULL DEFAULT 0,
  progress_percentage REAL NOT NULL DEFAULT 0,
  last_read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, book_id),
  FOREIGN KEY (book_id) REFERENCES "Booklist"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS book_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  user_id TEXT,
  click_type TEXT NOT NULL DEFAULT 'read' CHECK (click_type IN ('read', 'download')),
  clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES "Booklist"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  login_timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booklist_user_id ON "Booklist"(user_id);
CREATE INDEX IF NOT EXISTS idx_booklist_created_at ON "Booklist"(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_settings_updated_at ON admin_settings(updated_at);

CREATE INDEX IF NOT EXISTS idx_reading_list_user_id ON reading_list_full(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_list_book_id ON reading_list_full(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_list_added_at ON reading_list_full(added_at);

CREATE INDEX IF NOT EXISTS idx_study_notes_book_id ON study_notes(book_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_user_id ON study_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_created_at ON study_notes(created_at);

CREATE INDEX IF NOT EXISTS idx_book_notes_book_id ON book_notes(book_id);
CREATE INDEX IF NOT EXISTS idx_book_notes_user_id ON book_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_book_notes_page_number ON book_notes(page_number);

CREATE INDEX IF NOT EXISTS idx_book_highlights_book_id ON book_highlights(book_id);
CREATE INDEX IF NOT EXISTS idx_book_highlights_user_id ON book_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_book_highlights_page_number ON book_highlights(page_number);

CREATE INDEX IF NOT EXISTS idx_custom_outline_book_id ON custom_outline(book_id);
CREATE INDEX IF NOT EXISTS idx_custom_outline_user_id ON custom_outline(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_outline_parent_id ON custom_outline(parent_id);
CREATE INDEX IF NOT EXISTS idx_custom_outline_sort_order ON custom_outline(sort_order);
CREATE INDEX IF NOT EXISTS idx_custom_outline_pdf_index ON custom_outline(book_id, user_id, original_pdf_index);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_book_id ON ai_book_analysis(book_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_user_id ON ai_book_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_content_hash ON ai_book_analysis(content_hash);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_created_at ON ai_book_analysis(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_last_accessed ON ai_book_analysis(last_accessed_at);

CREATE INDEX IF NOT EXISTS idx_book_tracking_user_id ON book_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_book_tracking_book_id ON book_tracking(book_id);
CREATE INDEX IF NOT EXISTS idx_book_tracking_last_read ON book_tracking(last_read_at);

CREATE INDEX IF NOT EXISTS idx_book_clicks_book_id ON book_clicks(book_id);
CREATE INDEX IF NOT EXISTS idx_book_clicks_user_id ON book_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_book_clicks_clicked_at ON book_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_book_clicks_type ON book_clicks(click_type);

CREATE INDEX IF NOT EXISTS idx_login_tracking_user_id ON login_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_login_tracking_timestamp ON login_tracking(login_timestamp);

-- Views used by current app code.
CREATE VIEW IF NOT EXISTS book_click_stats AS
SELECT
  b.id AS book_id,
  b.title AS title,
  COALESCE(c.total_clicks, 0) AS total_clicks,
  COALESCE(c.read_clicks, 0) AS read_clicks,
  COALESCE(c.download_clicks, 0) AS download_clicks,
  COALESCE(c.unique_users, 0) AS unique_users,
  c.last_clicked_at AS last_clicked_at
FROM "Booklist" b
LEFT JOIN (
  SELECT
    book_id,
    COUNT(*) AS total_clicks,
    SUM(CASE WHEN click_type = 'read' THEN 1 ELSE 0 END) AS read_clicks,
    SUM(CASE WHEN click_type = 'download' THEN 1 ELSE 0 END) AS download_clicks,
    COUNT(DISTINCT user_id) AS unique_users,
    MAX(clicked_at) AS last_clicked_at
  FROM book_clicks
  GROUP BY book_id
) c
ON b.id = c.book_id;

CREATE VIEW IF NOT EXISTS user_login_stats AS
SELECT
  u.auth_user_id AS user_id,
  u.email AS email,
  u.created_at AS user_created_at,
  COALESCE(l.total_logins, 0) AS total_logins,
  l.last_login_at AS last_login_at,
  l.first_login_at AS first_login_at
FROM user_list u
LEFT JOIN (
  SELECT
    user_id,
    COUNT(*) AS total_logins,
    MAX(login_timestamp) AS last_login_at,
    MIN(login_timestamp) AS first_login_at
  FROM login_tracking
  GROUP BY user_id
) l
ON u.auth_user_id = l.user_id;

-- Keep updated_at columns current on writes.
CREATE TRIGGER IF NOT EXISTS tr_booklist_updated_at
AFTER UPDATE ON "Booklist"
FOR EACH ROW
BEGIN
  UPDATE "Booklist" SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tr_study_notes_updated_at
AFTER UPDATE ON study_notes
FOR EACH ROW
BEGIN
  UPDATE study_notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tr_reading_list_updated_at
AFTER UPDATE ON reading_list_full
FOR EACH ROW
BEGIN
  UPDATE reading_list_full SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tr_ai_analysis_updated_at
AFTER UPDATE ON ai_book_analysis
FOR EACH ROW
BEGIN
  UPDATE ai_book_analysis
  SET updated_at = CURRENT_TIMESTAMP, last_accessed_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

