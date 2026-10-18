import { ArrowRight } from 'lucide-react'

import { Picture } from '@/components/ui/Picture'
import { Link } from '@/i18n/navigation'
import type { ProjectCard as Card } from '@/lib/data/projects'

/**
 * Project tile: photo, title, one line of place · year. Used by the projects index and "similar projects".
 * `wide` (#156): a lone result in a row: photo and text side by side from `sm`, so one card doesn't sit in a third of the row.
 */
export function ProjectCard({ project: p, priority = false, wide = false }: { project: Card; priority?: boolean; wide?: boolean }) {
  const meta = [[p.district, p.city].filter(Boolean).join(', '), p.year].filter(Boolean).join(' · ')
  return (
    <Link
      href={{ pathname: '/projeler/[slug]', params: { slug: p.slug } }}
      className={`group block ${wide ? 'sm:grid sm:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] sm:items-center sm:gap-8 lg:gap-12' : ''}`}
    >
      {p.cover && (
        <Picture
          media={p.cover}
          sizes={wide ? '(min-width: 1280px) 720px, (min-width: 640px) 58vw, calc(100vw - 2rem)' : '(min-width: 1280px) 395px, (min-width: 1024px) calc(33.4vw - 2rem), (min-width: 640px) calc(50vw - 1.75rem), calc(100vw - 2rem)'}
          maxWidth={1280}
          priority={priority}
          className="aspect-[3/2]! rounded-[var(--radius-photo)]"
          imgClassName="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
        />
      )}
      <div>
        <h3 className={`mt-4 group-hover:text-action ${wide ? 'text-[1.2rem] sm:mt-0 sm:text-[clamp(1.35rem,2.2vw,1.75rem)] sm:text-balance' : 'text-[1.2rem]'}`}>{p.title}</h3>
        {meta && <p className="mt-1 text-ink-soft">{meta}</p>}
        {wide && (
          <ArrowRight
            aria-hidden
            size={22}
            strokeWidth={1.75}
            className="mt-5 hidden text-action transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1 sm:block rtl:rotate-180 rtl:group-hover:-translate-x-1"
          />
        )}
      </div>
    </Link>
  )
}
