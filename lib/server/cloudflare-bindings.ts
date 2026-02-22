import "server-only"

type CloudflareRequestContext = {
  env?: Record<string, unknown>
}

const CLOUDFLARE_CONTEXT_SYMBOL = Symbol.for("__cloudflare-context__")

function getCloudflareRequestContext(): CloudflareRequestContext | null {
  const context = (globalThis as Record<string | symbol, unknown>)[CLOUDFLARE_CONTEXT_SYMBOL]
  if (!context || typeof context !== "object") return null
  return context as CloudflareRequestContext
}

export function getCloudflareEnv() {
  return getCloudflareRequestContext()?.env ?? null
}

export function getD1Database(): any | null {
  const env = getCloudflareEnv()
  const db = env?.DB
  return (db ?? null) as any
}

export function getR2Bucket(): any | null {
  const env = getCloudflareEnv()
  const bucket = env?.BOOK_FILES
  return (bucket ?? null) as any
}

export function requireD1Database() {
  const db = getD1Database()
  if (!db) {
    throw new Error("Cloudflare D1 binding `DB` is not available.")
  }
  return db as any
}

export function requireR2Bucket() {
  const bucket = getR2Bucket()
  if (!bucket) {
    throw new Error("Cloudflare R2 binding `BOOK_FILES` is not available.")
  }
  return bucket as any
}
