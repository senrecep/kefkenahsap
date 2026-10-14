/** Edge-safe HTTP Basic check. `expected` is "user:password"; empty/undefined disables the gate. */
export function isAuthorized(header: string | null, expected: string | undefined): boolean {
  if (!expected) return true
  if (!header?.startsWith('Basic ')) return false
  try {
    return atob(header.slice(6)) === expected
  } catch {
    return false // not base64
  }
}
