import { CopyObjectCommand, HeadObjectCommand, ListObjectsV2Command, type HeadObjectCommandOutput, type S3Client } from '@aws-sdk/client-s3'

import { MEDIA_CACHE_CONTROL } from './renameStored'

/** #219: gives objects stored before #216 the Cache-Control every new media object carries, in place (bytes are never rewritten). */

type Send = Pick<S3Client, 'send'>

const BY_EXTENSION: Record<string, string> = {
  webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml',
  pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
}

export const needsUpdate = (head: Pick<HeadObjectCommandOutput, 'CacheControl'>): boolean => head.CacheControl !== MEDIA_CACHE_CONTROL

/** The stored ContentType is kept as is; only an object without one (S3 then reports a generic binary type) gets a type from its extension. */
export function contentTypeFor(existing: string | undefined, key: string): string {
  const generic = !existing || existing === 'application/octet-stream' || existing === 'binary/octet-stream'
  const inferred = BY_EXTENSION[key.split('.').pop()?.toLowerCase() ?? '']
  return generic ? (inferred ?? existing ?? 'application/octet-stream') : existing
}

/** Rewrites one object's headers with a self-copy (REPLACE drops every header, so the existing ones are carried over). */
export async function backfillObject(s3: Send, bucket: string, key: string, dryRun: boolean): Promise<'updated' | 'skipped'> {
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  if (!needsUpdate(head)) return 'skipped'
  if (!dryRun) {
    await s3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: key,
        CopySource: `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
        MetadataDirective: 'REPLACE',
        CacheControl: MEDIA_CACHE_CONTROL,
        ContentType: contentTypeFor(head.ContentType, key),
        ContentDisposition: head.ContentDisposition,
        ContentEncoding: head.ContentEncoding,
        ContentLanguage: head.ContentLanguage,
        Expires: head.Expires,
        Metadata: head.Metadata,
      }),
    )
  }
  return 'updated'
}

export type BackfillCounts = { updated: number; skipped: number; failed: number }

/** Every object under `prefix` (paginated listing, so orphans and legacy files count too), `concurrency` at a time. A failed key is reported and counted; the rest go on. */
export async function backfillPrefix(
  s3: Send,
  bucket: string,
  prefix: string,
  opts: { dryRun?: boolean; concurrency?: number; onProgress?: (counts: BackfillCounts) => void; onError?: (key: string, err: unknown) => void } = {},
): Promise<BackfillCounts> {
  const counts: BackfillCounts = { updated: 0, skipped: 0, failed: 0 }
  let token: string | undefined
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }))
    token = page.NextContinuationToken
    const keys = (page.Contents ?? []).flatMap((o) => (o.Key && !o.Key.endsWith('/') ? [o.Key] : []))
    let next = 0
    const worker = async () => {
      for (let key = keys[next++]; key !== undefined; key = keys[next++]) {
        try {
          counts[await backfillObject(s3, bucket, key, Boolean(opts.dryRun))]++
        } catch (err) {
          counts.failed++
          opts.onError?.(key, err)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 16, keys.length) }, worker))
    opts.onProgress?.(counts)
  } while (token)
  return counts
}
