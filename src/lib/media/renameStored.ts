import { CopyObjectCommand, DeleteObjectsCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

/** #209: moves a media document's stored objects to their SEO names. Copy first (a failure undoes its own copies); the caller deletes the old objects once the document points at the new ones. */

type Send = Pick<S3Client, 'send'>
type Move = { from: string; to: string }

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

/** Copies every object to its new key, in parallel. On any failure the copies that succeeded are removed. */
export async function copyObjects(s3: Send, bucket: string, prefix: string | null | undefined, moves: Move[]): Promise<Result<void>> {
  const settled = await Promise.allSettled(
    moves.map((m) => {
      const source = key(prefix, m.from).split('/').map(encodeURIComponent).join('/')
      return s3.send(new CopyObjectCommand({ Bucket: bucket, Key: key(prefix, m.to), CopySource: `${bucket}/${source}` }))
    }),
  )
  const failed = settled.flatMap((r, i) => (r.status === 'rejected' ? [`${moves[i]!.from}: ${String(r.reason)}`] : []))
  if (!failed.length) return Result.ok()
  await deleteObjects(s3, bucket, prefix, moves.filter((_, i) => settled[i]!.status === 'fulfilled').map((m) => m.to))
  return Result.failure(Err.unexpected('Media.CopyFailed', failed.join('; ')))
}
