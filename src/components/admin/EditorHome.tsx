import type { ServerProps } from 'payload'
import Link from 'next/link'

/** Dashboard entry for the everyday job (PLAN §4 "Admin deneyimi"): one big tile to Galeri with what waits for approval. */
export async function EditorHome({ payload, user }: ServerProps) {
  if (!user) return null
  const { totalDocs: pending } = await payload.count({
    collection: 'media',
    where: { status: { equals: 'pending' } },
    overrideAccess: false,
    user,
  })
  return (
    <Link className="editor-home" href="/admin/galeri" prefetch={false}>
      <span className="editor-home__title">Galeri</span>
      <span className="editor-home__text">Fotoğraf ekle, sırala, onayla</span>
      {pending > 0 && <span className="editor-home__count">{pending} fotoğraf onay bekliyor</span>}
    </Link>
  )
}
