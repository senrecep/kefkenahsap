import { CopyObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

/** #209: moves a media document's stored objects to their SEO names. Copy first (a failure undoes its own copies); the caller deletes the old objects once the document points at the new ones. */

type Send = Pick<S3Client, 'send'>
type Move = { from: string; to: string; contentType: string }

/** #216: every media object is immutable under its name (a replaced file gets a new name), so the browser may keep it for a year. Sent with the object, so a zone rule can respect the origin's header instead of forcing its own on errors too. */
export const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable'

type Stored = { filename?: string | null; mimeType?: string | null; sizes?: Record<string, { filename?: string | null; mimeType?: string | null } | null | undefined> | null }
/** The distinct stored files of a media document (original and sizes) with their content types. */
export function storedFiles(doc: Stored): { filename: string; contentType: string }[] {
  const all = [doc, ...Object.values(doc.sizes ?? {})]
  const byName = new Map(all.flatMap((f) => (f?.filename ? [[f.filename, f.mimeType || doc.mimeType || 'image/webp'] as const] : [])))
  return [...byName].map(([filename, contentType]) => ({ filename, contentType }))
}

let client: S3Client | undefined
/** The CDN bucket the Payload S3 adapter writes to (same env as payload.config.ts). */
export const mediaBucket = () => ({
  bucket: process.env.S3_BUCKET || '',
  s3: (client ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' },
  })),
})

const key = (prefix: string | null | undefined, filename: string) => [prefix, filename].filter(Boolean).join('/')

/** #216: one stored object's bytes, read straight from the bucket (never through the public CDN, which may hold a cached 404 for a reused key). */
export async function readObject(s3: Send, bucket: string, prefix: string | null | undefined, filename: string): Promise<Result<Uint8Array>> {
  return Result.tryAsync(
    async () => {
      const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key(prefix, filename) }))
      return out.Body!.transformToByteArray()
    },
    (e) => Err.unexpected('Media.StorageReadFailed', String(e)),
  )
}

export async function deleteObjects(s3: Send, bucket: string, prefix: string | null | undefined, filenames: string[]): Promise<Result<void>> {
  if (!filenames.length) return Result.ok()
  return Result.tryAsync(
    async () => {
      const out = await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: filenames.map((f) => ({ Key: key(prefix, f) })), Quiet: true } }))
      if (out.Errors?.length) throw new Error(out.Errors.map((e) => `${e.Key}: ${e.Message}`).join('; '))
    },
    (e) => Err.unexpected('Media.DeleteFailed', String(e)),
  )
}

/** Does any of these objects exist? Names are chosen against the bucket, so two processes never overwrite each other's file. */
export async function anyExists(s3: Send, bucket: string, prefix: string | null | undefined, filenames: string[]): Promise<boolean> {
  const found = await Promise.all(filenames.map((f) => s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key(prefix, f) })).then(() => true, (e: { name?: string }) => {
    if (e?.name === 'NotFound' || e?.name === 'NoSuchKey') return false
    throw e
  })))
  return found.some(Boolean)
}

const copyOne = (s3: Send, bucket: string, prefix: string | null | undefined, m: Move) => {
  const source = key(prefix, m.from).split('/').map(encodeURIComponent).join('/')
  // REPLACE: a copy keeps the source's metadata otherwise, and then CacheControl/ContentType could not be set.
  return s3.send(new CopyObjectCommand({ Bucket: bucket, Key: key(prefix, m.to), CopySource: `${bucket}/${source}`, MetadataDirective: 'REPLACE', CacheControl: MEDIA_CACHE_CONTROL, ContentType: m.contentType }))
}

/** #216: the Payload S3 adapter cannot set Cache-Control on its uploads, so a new file's objects are rewritten in place with it. */
export async function applyCacheControl(s3: Send, bucket: string, prefix: string | null | undefined, files: { filename: string; contentType: string }[]): Promise<Result<void>> {
  return Result.tryAsync(
    async () => {
      await Promise.all(files.map((f) => copyOne(s3, bucket, prefix, { from: f.filename, to: f.filename, contentType: f.contentType })))
    },
    (e) => Err.unexpected('Media.CacheControlFailed', String(e)),
  )
}

/** Copies every object to its new key, in parallel. On any failure the copies that succeeded are removed. */
export async function copyObjects(s3: Send, bucket: string, prefix: string | null | undefined, moves: Move[]): Promise<Result<void>> {
  const settled = await Promise.allSettled(
    moves.map((m) => {
      return copyOne(s3, bucket, prefix, m)
    }),
  )
  const failed = settled.flatMap((r, i) => (r.status === 'rejected' ? [`${moves[i]!.from}: ${String(r.reason)}`] : []))
  if (!failed.length) return Result.ok()
  await deleteObjects(s3, bucket, prefix, moves.filter((_, i) => settled[i]!.status === 'fulfilled').map((m) => m.to))
  return Result.failure(Err.unexpected('Media.CopyFailed', failed.join('; ')))
}
