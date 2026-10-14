import { ExternalLink } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { buttonClass } from '@/components/ui/button'
import { isMapEmbedUrl } from '@/lib/http/safe-href'

import { MapEmbed } from './MapEmbed'

type Address = { mapUrl?: string | null; mapEmbedUrl?: string | null; appleMapsUrl?: string | null }

/** Contact map (#143): click-to-load Google embed plus Google / Apple Maps links. Empty fields render nothing. */
export async function LocationMap({ address: a, className = '' }: { address?: Address | null; className?: string }) {
  // Re-checked at render: the iframe src is a trust boundary and older rows predate the field validator.
  const embed = isMapEmbedUrl(a?.mapEmbedUrl) ? a.mapEmbedUrl : null
  if (!embed && !a?.mapUrl && !a?.appleMapsUrl) return null
  const t = await getTranslations('Map')
  const links = [
    { href: a?.mapUrl, label: t('google') },
    { href: a?.appleMapsUrl, label: t('apple') },
  ].filter((l): l is { href: string; label: string } => !!l.href)
  return (
    <div className={`grid gap-4 ${className}`}>
      {embed && <MapEmbed src={embed} title={t('title')} show={t('show')} note={t('note')} />}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener" className={buttonClass.outline}>
              {l.label}
              <ExternalLink aria-hidden size={18} strokeWidth={1.75} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
