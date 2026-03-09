import "server-only"
import fs from "fs"
import path from "path"
import os from "os"

// ─── Wrangler token auto-reader (local dev only) ──────────────────────────

function readWranglerToken(): string | null {
  try {
    const configPath = path.join(
      os.homedir(),
      "AppData", "Roaming", "xdg.config", ".wrangler", "config", "default.toml"
    )
    const raw = fs.readFileSync(configPath, "utf-8")
    const match = raw.match(/oauth_token\s*=\s*"([^"]+)"/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

// ─── Cloudflare runtime context (Workers / Pages) ────────────────────────

type CloudflareRequestContext = { env?: Record<string, unknown> }
const CF_CTX = Symbol.for("__cloudflare-context__")

function getCloudflareEnv() {
  const ctx = (globalThis as Record<string | symbol, unknown>)[CF_CTX]
  if (!ctx || typeof ctx !== "object") return null
  return (ctx as CloudflareRequestContext).env ?? null
}

// ─── D1 HTTP fallback ─────────────────────────────────────────────────────

function d1Cfg() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN || readWranglerToken()
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID
  if (!accountId || !token || !databaseId) return null
  return { accountId, token, databaseId }
}

class D1HttpStatement {
  constructor(
    readonly _sql: string,
    readonly _params: unknown[],
    private readonly _cfg: NonNullable<ReturnType<typeof d1Cfg>>,
  ) {}

  bind(...params: unknown[]) {
    return new D1HttpStatement(this._sql, params, this._cfg)
  }

  private async _exec() {
    const { accountId, token, databaseId } = this._cfg
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql: this._sql, params: this._params }),
      },
    )
    const data = (await res.json()) as { success: boolean; errors?: { message: string }[]; result: { results?: unknown[]; meta?: Record<string, unknown> }[] }
    if (!data.success) throw new Error(data.errors?.[0]?.message ?? "D1 HTTP query failed")
    return data.result[0]
  }

  async all() {
    const r = await this._exec()
    return { results: (r.results ?? []) as unknown[] }
  }

  async first() {
    const r = await this._exec()
    return ((r.results ?? [])[0] as unknown) ?? null
  }

  async run() {
    const r = await this._exec()
    return { success: true as const, meta: (r.meta ?? {}) as { last_row_id?: number } }
  }
}

class D1HttpDatabase {
  constructor(private readonly _cfg: NonNullable<ReturnType<typeof d1Cfg>>) {}

  prepare(sql: string) {
    return new D1HttpStatement(sql, [], this._cfg)
  }

  async batch(statements: D1HttpStatement[]) {
    const { accountId, token, databaseId } = this._cfg
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(statements.map((s) => ({ sql: s._sql, params: s._params }))),
      },
    )
    const data = (await res.json()) as { success: boolean; errors?: { message: string }[]; result: unknown[] }
    if (!data.success) throw new Error((data.errors?.[0] as { message?: string })?.message ?? "D1 HTTP batch failed")
    return data.result
  }
}

// ─── R2 HTTP fallback ─────────────────────────────────────────────────────

function r2Cfg() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN || readWranglerToken()
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET
  if (!accountId || !token || !bucketName) return null
  return { accountId, token, bucketName }
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/")
}

class R2HttpObject {
  readonly body: ReadableStream
  readonly size: number
  readonly httpEtag: string
  readonly range?: { offset: number; length: number }
  private readonly _contentType: string

  constructor(opts: { body: ReadableStream; size: number; etag: string; contentType: string; range?: { offset: number; length: number } }) {
    this.body = opts.body
    this.size = opts.size
    this.httpEtag = opts.etag
    this._contentType = opts.contentType
    this.range = opts.range
  }

  writeHttpMetadata(headers: Headers) {
    if (this._contentType) headers.set("content-type", this._contentType)
  }
}

class R2HttpBucket {
  constructor(private readonly _cfg: NonNullable<ReturnType<typeof r2Cfg>>) {}

  private _url(key: string) {
    const { accountId, bucketName } = this._cfg
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${encodeKey(key)}`
  }

  async get(key: string, options?: { range?: Headers | { offset: number; length: number } }): Promise<R2HttpObject | null> {
    const reqHeaders: Record<string, string> = { Authorization: `Bearer ${this._cfg.token}` }
    let parsedRange: { offset: number; length: number } | undefined

    if (options?.range) {
      if (options.range instanceof Headers) {
        const rangeHeader = options.range.get("range")
        if (rangeHeader) {
          reqHeaders["Range"] = rangeHeader
          const m = rangeHeader.match(/bytes=(\d+)-(\d+)/)
          if (m) parsedRange = { offset: +m[1], length: +m[2] - +m[1] + 1 }
        }
      } else {
        const { offset, length } = options.range as { offset: number; length: number }
        reqHeaders["Range"] = `bytes=${offset}-${offset + length - 1}`
        parsedRange = { offset, length }
      }
    }

    const res = await fetch(this._url(key), { headers: reqHeaders })
    if (res.status === 404) return null
    if (!res.ok && res.status !== 206) throw new Error(`R2 HTTP get failed: ${res.status}`)

    const size = res.headers.get("content-length") ? +res.headers.get("content-length")! : 0
    const contentType = res.headers.get("content-type") ?? ""
    const etag = res.headers.get("etag") ?? ""

    if (!parsedRange) {
      const cr = res.headers.get("content-range")
      if (cr) {
        const m = cr.match(/bytes (\d+)-(\d+)\/(\d+)/)
        if (m) parsedRange = { offset: +m[1], length: +m[2] - +m[1] + 1 }
      }
    }

    return new R2HttpObject({ body: res.body!, size, etag, contentType, range: parsedRange })
  }

  async put(key: string, data: ArrayBuffer, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<void> {
    const reqHeaders: Record<string, string> = { Authorization: `Bearer ${this._cfg.token}` }
    if (options?.httpMetadata?.contentType) reqHeaders["Content-Type"] = options.httpMetadata.contentType

    const res = await fetch(this._url(key), { method: "PUT", headers: reqHeaders, body: data })
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      throw new Error(`R2 HTTP put failed: ${res.status} ${txt}`)
    }
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(this._url(key), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this._cfg.token}` },
    })
    if (!res.ok && res.status !== 404) throw new Error(`R2 HTTP delete failed: ${res.status}`)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

export function getD1Database(): any | null {
  const env = getCloudflareEnv()
  if (env?.DB) return env.DB as any
  const cfg = d1Cfg()
  return cfg ? new D1HttpDatabase(cfg) : null
}

export function getR2Bucket(): any | null {
  const env = getCloudflareEnv()
  if (env?.BOOK_FILES) return env.BOOK_FILES as any
  const cfg = r2Cfg()
  return cfg ? new R2HttpBucket(cfg) : null
}

export function requireD1Database() {
  const db = getD1Database()
  if (!db) throw new Error("D1 not available. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_D1_DATABASE_ID in .env.local")
  return db as any
}

export function requireR2Bucket() {
  const bucket = getR2Bucket()
  if (!bucket) throw new Error("R2 not available. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_R2_BUCKET in .env.local")
  return bucket as any
}
