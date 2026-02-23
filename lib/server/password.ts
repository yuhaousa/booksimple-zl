import "server-only"

import { randomBytes, timingSafeEqual } from "crypto"

const DEFAULT_ITERATIONS = 120_000

function toHex(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("hex")
}

function fromHex(value: string) {
  try {
    return new Uint8Array(Buffer.from(value, "hex"))
  } catch {
    return null
  }
}

async function deriveHash(password: string, salt: Uint8Array, iterations: number) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  )

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    keyMaterial,
    256
  )

  return new Uint8Array(bits)
}

export async function hashPassword(password: string) {
  const salt = new Uint8Array(randomBytes(16))
  const hash = await deriveHash(password, salt, DEFAULT_ITERATIONS)
  return `pbkdf2_sha256$${DEFAULT_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`
}

export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split("$")
  if (parts.length !== 4) return false
  if (parts[0] !== "pbkdf2_sha256") return false

  const iterations = Number.parseInt(parts[1], 10)
  const salt = fromHex(parts[2])
  const expected = fromHex(parts[3])

  if (!Number.isFinite(iterations) || iterations < 10_000) return false
  if (!salt || !expected) return false

  const actual = await deriveHash(password, salt, iterations)
  if (actual.byteLength !== expected.byteLength) return false

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}

