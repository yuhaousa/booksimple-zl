import "server-only"

export type AuthUserRecord = {
  user_id: string
  email: string
  display_name: string | null
  password_hash: string
}

export function normalizeValue(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeEmail(value: unknown) {
  const normalized = normalizeValue(value)
  if (!normalized) return null
  return normalized.toLowerCase()
}

export async function ensureAuthTables(db: any) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS auth_credentials (
        user_id TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run()
}

