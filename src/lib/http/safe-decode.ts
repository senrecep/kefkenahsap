import { notFound } from 'next/navigation'

/** Decodes a route param; a malformed escape (e.g. `%E0%A4%A`) is a 404, never a 500. */
export function safeDecode(param: string): string {
  try {
    return decodeURIComponent(param)
  } catch {
    notFound()
  }
}
