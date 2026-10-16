import { Err, type AppError } from 'tsentials/errors'
import { fetchResult, type FetchResultInit } from 'tsentials/http'
import { Result } from 'tsentials/result'

/**
 * #185: media files are cached at the Cloudflare edge for a year, so a deleted or replaced file stays public until its
 * exact URLs are purged. The page cache (HTML) is a separate concern (PLAN §3.3).
 */

type MediaFiles = {
  filename?: string | null
  prefix?: string | null
  sizes?: Record<string, { filename?: string | null } | null | undefined> | null
}

/** Public CDN URLs of a media document: the main file and every size, without repeats. */
export function mediaPublicURLs(doc: MediaFiles, base: string): string[] {
  if (!doc.filename) return []
  const files = [doc.filename, ...Object.values(doc.sizes ?? {}).map((s) => s?.filename)]
  return [...new Set(files.filter((f): f is string => Boolean(f)))].map((f) => [base, doc.prefix, f].filter(Boolean).join('/'))
}

type Post = (url: string, body: unknown, init: FetchResultInit) => Promise<Result<unknown>>

// Cloudflare accepts at most 30 files per purge request on every plan.
const CHUNK = 30

/** Purge-by-URL client for one zone. Every chunk is tried; the failures are collected. */
export function createCdnPurger({ zoneId, token, post = fetchResult.post }: { zoneId: string; token: string; post?: Post }) {
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`
  return async (urls: string[]): Promise<Result<void>> => {
    const chunks = Array.from({ length: Math.ceil(urls.length / CHUNK) }, (_, i) => urls.slice(i * CHUNK, (i + 1) * CHUNK))
    const results = await Promise.all(
      chunks.map((files) => post(endpoint, { files }, { headers: { Authorization: `Bearer ${token}` }, timeout: 10_000 })),
    )
    const errors: AppError[] = results.flatMap((r) => {
      if (!r.ok) return [Err.unexpected('Cloudflare.PurgeFailed', `Cloudflare purge failed: ${r.errors[0]?.code ?? 'unknown'}`)]
      const body = r.value as { success?: boolean; errors?: { message?: string }[] } | null
      return body?.success === true ? [] : [Err.unexpected('Cloudflare.PurgeFailed', `Cloudflare purge failed: ${body?.errors?.[0]?.message ?? 'success=false'}`)]
    })
    return errors.length ? Result.failure(...errors) : Result.ok()
  }
}
