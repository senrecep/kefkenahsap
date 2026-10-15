import { Picture } from '@/components/ui/Picture'
import type { getGuides } from '@/lib/data/guides'

type Guide = Awaited<ReturnType<typeof getGuides>>[number]

/**
 * Guide tile for the index and "İlgili yazılar": a 3:2 job photo, the title, and (on the index) the excerpt. No box
 * around it (DESIGN.md: there are no cards). Without a photo the title opens the item on a hairline instead. `compact`
 * (related guides): below `sm` a thumbnail beside the title, so three suggestions don't cost three phone screens.
 */
export function GuideCard({ guide: g, heading: H = 'h2', sizes, excerpt = true, priority = false, compact = false }: { guide: Guide; heading?: 'h2' | 'h3'; sizes: string; excerpt?: boolean; priority?: boolean; compact?: boolean }) {
  return (
    <a href={g.href} className={`group ${compact ? 'flex items-start gap-4 sm:block' : 'block'}`}>
      {g.image ? (
        <Picture
          media={g.image}
          sizes={sizes}
          maxWidth={1280}
          priority={priority}
          className={`aspect-[3/2]! rounded-[var(--radius-photo)] bg-mist ${compact ? 'w-32 shrink-0 sm:w-auto' : ''}`}
          imgClassName="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
        />
      ) : (
        <span aria-hidden className="block border-t border-line" />
      )}
      <H className={`text-balance group-hover:text-action ${compact ? 'sm:mt-4' : 'mt-4'} ${H === 'h2' ? 'text-[clamp(1.25rem,2vw,1.5rem)]' : 'text-[1.05rem] sm:text-[1.15rem]'}`}>{g.title}</H>
      {excerpt && g.excerpt && <p className="mt-2 line-clamp-3 max-w-[60ch] text-ink-soft">{g.excerpt}</p>}
    </a>
  )
}
