import { getLocale, getTranslations } from 'next-intl/server'

import { PopularCategories } from '@/components/content/PopularCategories'
import { SearchBox } from '@/components/content/SearchBox'
import { buttonClass } from '@/components/ui/button'
import { Container } from '@/components/ui/Container'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { getNavCategories } from '@/lib/data/site'

export default async function NotFound() {
  const locale = (await getLocale()) as Locale
  const [t, categories] = await Promise.all([getTranslations('NotFound'), getNavCategories(locale)])
  return (
    <Container className="pt-10 pb-6 md:pt-14">
      <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-balance">{t('title')}</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">{t('body')}</p>
      <div className="mt-8">
        <SearchBox locale={locale} />
      </div>
      <h2 className="mt-12 font-[family-name:var(--font-display)] text-xl font-semibold">{t('popular')}</h2>
      <PopularCategories categories={categories} />
      <Link href="/" className={`${buttonClass.quiet} mt-8 -ms-3`}>{t('home')}</Link>
    </Container>
  )
}
