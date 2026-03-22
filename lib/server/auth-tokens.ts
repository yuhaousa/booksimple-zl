import "server-only"

import { createHash, randomBytes } from "crypto"

export type AuthTokenType = "verify_email" | "reset_password"

type AuthTokenRow = {
  id: number | string
  user_id: string
  email: string
  token_type: AuthTokenType
  expires_at: string
  used_at: string | null
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function expiresAtIso(minutes: number) {
  return new Date(Date.now() + Math.max(1, minutes) * 60_000).toISOString()
}

export async function issueAuthToken(
  db: any,
  options: {
    userId: string
    email: string
    type: AuthTokenType
    ttlMinutes: number
  }
) {
  const token = randomBytes(32).toString("hex")
  const tokenHash = hashToken(token)
  const expiresAt = expiresAtIso(options.ttlMinutes)

  await db
    .prepare(
      `UPDATE auth_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND token_type = ? AND used_at IS NULL`
    )
    .bind(options.userId, options.type)
    .run()

  await db
    .prepare(
      `INSERT INTO auth_tokens (user_id, email, token_hash, token_type, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(options.userId, options.email, tokenHash, options.type, expiresAt)
    .run()

  return {
    token,
    expiresAt,
  }
}

export async function consumeAuthToken(db: any, token: string, type: AuthTokenType) {
  const tokenHash = hashToken(token)
  const row = (await db
    .prepare(
      `SELECT id, user_id, email, token_type, expires_at, used_at
       FROM auth_tokens
       WHERE token_hash = ? AND token_type = ? AND used_at IS NULL
       LIMIT 1`
    )
    .bind(tokenHash, type)
    .first()) as AuthTokenRow | null

  if (!row) return null
  if (Date.parse(row.expires_at) <= Date.now()) return null

  await db
    .prepare("UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(row.id)
    .run()

  return row
}
