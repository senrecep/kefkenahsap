import { Picture } from '@/components/ui/Picture'
import { Link } from '@/i18n/navigation'
import type { ProjectCard as Card } from '@/lib/data/projects'

/** Project tile: photo, title, one line of place · year. Used by the projects index and "similar projects". */
export function ProjectCard({ project: p, priority = false }: { project: Card; priority?: boolean }) {
  const meta = [[p.district, p.city].filter(Boolean).join(', '), p.year].filter(Boolean).join(' · ')
  return (
    <Link href={{ pathname: '/projeler/[slug]', params: { slug: p.slug } }} className="group block">
      {p.cover && (
        <Picture
          media={p.cover}
          sizes="(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          maxWidth={1280}
          priority={priority}
          className="aspect-[3/2]! rounded-[var(--radius-photo)]"
          imgClassName="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
        />
      )}
      <h3 className="mt-4 text-[1.2rem] group-hover:text-action">{p.title}</h3>
      {meta && <p className="mt-1 text-ink-soft">{meta}</p>}
    </Link>
  )
}
