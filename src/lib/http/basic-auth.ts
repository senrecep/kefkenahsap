const enc = new TextEncoder()

/** Edge-safe HTTP Basic check. `expected` is "user:password"; empty/undefined disables the gate. */
export function isAuthorized(header: string | null, expected: string | undefined): boolean {
  if (!expected) return true
  if (!header?.startsWith('Basic ')) return false
  let given: Uint8Array
  try {
    given = Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)) // raw UTF-8 bytes
  } catch {
    return false // not base64
  }
  return constantTimeEqual(given, enc.encode(expected))
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}
