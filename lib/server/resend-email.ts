import "server-only"

type ResendConfig = {
  apiKey: string
  from: string
  fromName: string
}

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function loadResendConfig(db: any): Promise<ResendConfig | null> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS admin_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by TEXT
      )`
    )
    .run()

  const rows = (await db
    .prepare(
      `SELECT setting_key, setting_value
       FROM admin_settings
       WHERE setting_key IN ('email_resend_api_key', 'email_from', 'email_from_name')`
    )
    .all()) as { results?: Array<{ setting_key: string; setting_value: string }> }

  const values: Record<string, string> = {}
  for (const row of rows.results ?? []) {
    values[row.setting_key] = row.setting_value
  }

  const apiKey = normalizeValue(values.email_resend_api_key)
  const from = normalizeValue(values.email_from)
  const fromName = normalizeValue(values.email_from_name) ?? "Book365"

  if (!apiKey || !from) return null
  return { apiKey, from, fromName }
}

export async function sendResendEmail(
  db: any,
  message: {
    to: string
    subject: string
    html: string
  }
) {
  const config = await loadResendConfig(db)
  if (!config) {
    throw new Error("Email delivery is not configured. Save Resend settings in Admin > Settings > Email first.")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${config.fromName} <${config.from}>`,
      to: [message.to],
      subject: message.subject,
      html: message.html,
    }),
  })

  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = result?.message || result?.name || `HTTP ${response.status}`
    throw new Error(`Resend rejected the request: ${detail}`)
  }

  return result
}
