import Link from 'next/link'

/** Puts "Galeri" at the top of the admin sidebar (reuses Payload's nav link classes). */
export function GaleriNavLink() {
  return (
    <Link className="nav__link" href="/admin/galeri" prefetch={false}>
      <span className="nav__link-label">Galeri</span>
    </Link>
  )
}
