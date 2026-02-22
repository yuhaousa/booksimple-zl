import "server-only"

import { toAssetUrl } from "@/lib/server/storage"

export type BookRow = {
  id: number
  created_at: string
  updated_at: string
  title: string | null
  description: string | null
  author: string | null
  publisher: string | null
  isbn: string | null
  tags: string | null
  year: number | null
  cover_url: string | null
  file_url: string | null
  user_id: string | null
  video_url: string | null
  video_file_url: string | null
  video_title: string | null
  video_description: string | null
}

export function normalizeBookForResponse(row: BookRow) {
  return {
    ...row,
    cover_url: toAssetUrl(row.cover_url),
    file_url: toAssetUrl(row.file_url),
    video_file_url: toAssetUrl(row.video_file_url),
  }
}

export const BOOK_SELECT_SQL = `SELECT
  id,
  created_at,
  updated_at,
  title,
  description,
  author,
  publisher,
  isbn,
  tags,
  year,
  cover_url,
  file_url,
  user_id,
  video_url,
  video_file_url,
  video_title,
  video_description
FROM "Booklist"`

export function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}
