import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'

export async function Logo({ className = '' }: { className?: string }) {
  const t = await getTranslations('Site')
  return (
    <Link href="/" className={`inline-flex shrink-0 items-center ${className}`} aria-label={t('name')}>
      {/* Brand lockup cropped from the owner's master file (public/brand/PROVENANCE.txt) */}
      <img src="/brand/logo.webp" alt={t('name')} width={247} height={56} className="h-11 w-auto md:h-12" decoding="async" />
    </Link>
  )
}
