import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

/**
 * Guard against a silent storage mix-up (seen once: every original held the first photo's bytes).
 * Originals are re-encoded on upload, so this compares shape and uniqueness, not bytes.
 * `servedDigests` (served md5 → source md5) is shared across one run.
 */
export async function verifyStored(stored: string, upload: string, size: { width: number; height: number }, servedDigests: Map<string, string>) {
  if (!process.env.MEDIA_PUBLIC_URL) throw new Error('MEDIA_PUBLIC_URL is not set: cannot fetch stored files to verify them')
  const res = await fetch([process.env.MEDIA_PUBLIC_URL, process.env.S3_PREFIX, stored].filter(Boolean).join('/'))
  if (!res.ok) throw new Error(`fetching stored ${stored} failed: ${res.status}`)
  const served = Buffer.from(await res.arrayBuffer())
  const got = await sharp(served).metadata()
  const digest = createHash('md5').update(served).digest('hex')
  const source = createHash('md5').update(readFileSync(upload)).digest('hex')
  // The same photo can sit in two categories, so a repeated digest is only wrong when the sources differ.
  if (got.width !== size.width || got.height !== size.height || (servedDigests.get(digest) ?? source) !== source) {
    throw new Error(`storage returned wrong bytes for ${stored}`)
  }
  servedDigests.set(digest, source)
}
