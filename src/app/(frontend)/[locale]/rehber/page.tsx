import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'

import { Container } from '@/components/ui/Container'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import type { Locale } from '@/i18n/routing'
import { getGuides } from '@/lib/data/guides'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'

type Props = { params: Promise<{ locale: Locale }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Guides' })
  const empty = (await getGuides(locale)).length === 0
  // An empty index is a thin page: keep it out of the index until the first guide is published.
  return pageMetadata({ locale, title: t('title'), description: t('metaDescription'), paths: staticPaths('/rehber'), noindex: empty })
}

export default async function GuidesIndex({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, format, guides] = await Promise.all([getTranslations('Guides'), getFormatter(), getGuides(locale)])

  return (
    <Container className="pt-8 pb-20 md:pt-12">
      <header className="max-w-[46rem]">
        <h1 className="text-[clamp(2rem,4vw,3rem)]">{t('title')}</h1>
        <p className="mt-4 text-lg text-ink-soft">{t('intro')}</p>
      </header>

      {guides.length === 0 ? (
        <div className="mt-10 max-w-[46rem] border-t border-line pt-8">
          <p>{t('empty')}</p>
          <WhatsAppButton locale={locale} place="guides-empty" className="mt-6" />
        </div>
      ) : (
        <ol className="mt-10 max-w-[52rem] divide-y divide-line border-y border-line">
          {guides.map((g) => (
            <li key={g.id}>
              <article className="py-8">
                <h2 className="text-[clamp(1.35rem,2.4vw,1.75rem)]">
                  <a href={g.href} className="hover:text-action hover:underline">
                    {g.title}
                  </a>
                </h2>
                {g.excerpt && <p className="mt-3 line-clamp-3 max-w-[68ch] text-ink-soft">{g.excerpt}</p>}
                <p className="mt-3 text-[0.9rem] text-ink-soft">
                  {t('updated')}: <time dateTime={g.updatedAt}>{format.dateTime(new Date(g.updatedAt), { dateStyle: 'long' })}</time>
                </p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </Container>
  )
}
