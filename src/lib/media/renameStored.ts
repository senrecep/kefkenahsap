import { CopyObjectCommand, DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

/** #209: moves a media document's stored objects to their SEO names. Copy first (a failure undoes its own copies); the old objects are deleted by the caller once the document points at the new ones. */

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

/** Copies every object to its new key. On failure the copies made so far are removed and nothing else has changed. */
export async function copyObjects(s3: Send, bucket: string, prefix: string | null | undefined, moves: Move[]): Promise<Result<void>> {
  const done: string[] = []
  const copied = await Result.tryAsync(
    async () => {
      for (const m of moves) {
        const source = key(prefix, m.from).split('/').map(encodeURIComponent).join('/')
        await s3.send(new CopyObjectCommand({ Bucket: bucket, Key: key(prefix, m.to), CopySource: `${bucket}/${source}` }))
        done.push(m.to)
      }
    },
    (e) => Err.unexpected('Media.CopyFailed', String(e)),
  )
  if (!copied.ok) await deleteObjects(s3, bucket, prefix, done)
  return copied
}
