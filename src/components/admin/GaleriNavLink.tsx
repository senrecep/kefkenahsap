import type { ServerProps } from 'payload'
import Link from 'next/link'

import { roleOf } from '@/access'

// Editors reach these only through Galeri (edit photo, add category). `admin.hidden` would also 404 those screens, so hide the nav links only.
const editorHiddenLinks = ['media', 'categories'].map((slug) => `.nav a[href*="/collections/${slug}"]`).join(',')

/** Puts "Galeri" at the top of the admin sidebar (reuses Payload's nav link classes). */
export function GaleriNavLink({ user }: ServerProps) {
  return (
    <>
      {roleOf(user) === 'editor' && <style>{`${editorHiddenLinks}{display:none}`}</style>}
      <Link className="nav__link" href="/admin/galeri" prefetch={false}>
        <span className="nav__link-label">Galeri</span>
      </Link>
    </>
  )
}
