import "server-only"

export type AuthUserRecord = {
  user_id: string
  email: string
  display_name: string | null
  password_hash: string
}

export type AuthEmailMatchRow = {
  id: number | string
  auth_user_id: string | null
  email: string | null
  display_name: string | null
  created_at: string | null
  has_password: number | string | null
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

export function hasPasswordCredential(row: Pick<AuthEmailMatchRow, "has_password">) {
  return Number(row.has_password ?? 0) > 0
}

function rowsFromD1Result(result: any): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  if (result && typeof result === "object" && Array.isArray((result as { results?: unknown[] }).results)) {
    return (result as { results: Array<Record<string, unknown>> }).results
  }
  return []
}

export async function getAuthEmailMatches(db: any, email: string) {
  const result = (await db
    .prepare(
      `SELECT
        u.id,
        u.auth_user_id,
        u.email,
        u.display_name,
        u.created_at,
        CASE WHEN c.user_id IS NOT NULL THEN 1 ELSE 0 END AS has_password
      FROM user_list u
      LEFT JOIN auth_credentials c ON c.user_id = u.auth_user_id
      WHERE lower(u.email) = ?
      ORDER BY
        CASE WHEN c.user_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN u.auth_user_id IS NOT NULL THEN 0 ELSE 1 END,
        datetime(COALESCE(u.created_at, CURRENT_TIMESTAMP)) ASC,
        u.id ASC`
    )
    .bind(email)
    .all()) as { results?: AuthEmailMatchRow[] } | AuthEmailMatchRow[]

  return rowsFromD1Result(result) as AuthEmailMatchRow[]
}

async function getTableColumns(db: any, table: string) {
  const raw = await db.prepare(`PRAGMA table_info(${table})`).all()
  const rows = rowsFromD1Result(raw)
  return new Set(
    rows
      .map((row) => normalizeValue(row.name))
      .filter((name): name is string => Boolean(name))
      .map((name) => name.toLowerCase())
  )
}

async function ensureColumn(db: any, table: string, columnName: string, definition: string) {
  const columns = await getTableColumns(db, table)
  if (columns.has(columnName.toLowerCase())) return
  await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run()
}

export async function ensureAuthTables(db: any) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auth_user_id TEXT UNIQUE,
        email TEXT NOT NULL,
        display_name TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run()

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

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run()

  // Backfill critical columns for databases migrated from older auth schemas.
  await ensureColumn(db, "user_list", "auth_user_id", "auth_user_id TEXT")
  await ensureColumn(db, "user_list", "email", "email TEXT")
  await ensureColumn(db, "user_list", "display_name", "display_name TEXT")
  await ensureColumn(db, "user_list", "created_at", "created_at TEXT")

  await ensureColumn(db, "auth_credentials", "created_at", "created_at TEXT")
  await ensureColumn(db, "auth_credentials", "updated_at", "updated_at TEXT")

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS login_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        logged_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run()

  await db.prepare("CREATE INDEX IF NOT EXISTS idx_user_list_email_nocase ON user_list(email COLLATE NOCASE)").run()
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_user_list_auth_user_id ON user_list(auth_user_id)").run()
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_login_log_date ON login_log(logged_in_at)").run()
}
