'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useEffect } from 'react'

import './ai/ai.css'

/** GET /api/media/:id/download (#230): a plain same-origin attachment link, so iOS Safari and Android Chrome save it natively. */
export const mediaDownloadHref = (id: number | string) => `/api/media/${id}/download`

/**
 * #230: "İndir" under the upload preview of the media edit view. Also makes the main image of Payload's "Önizleme
 * boyutları" drawer open full size in a new tab on tap (the drawer has no slot for it), so a phone can pinch-zoom it.
 */
export function MediaDownloadField() {
  const { id } = useDocumentInfo()

  useEffect(() => {
    const open = (e: MouseEvent) => {
      const img = e.target instanceof Element ? e.target.closest<HTMLImageElement>('img.preview-sizes__preview') : null
      if (img?.src) window.open(img.src, '_blank', 'noopener')
    }
    document.addEventListener('click', open)
    return () => document.removeEventListener('click', open)
  }, [])

  if (!id) return null
  return (
    <div className="ai-action media-download">
      <a className="ai-btn" href={mediaDownloadHref(id)} download>
        İndir
      </a>
      <p className="ai-action__hint">Filigranlı, tam boy JPEG (Instagram için uygun).</p>
    </div>
  )
}
