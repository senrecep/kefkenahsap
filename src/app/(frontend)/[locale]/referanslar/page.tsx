import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { CtaBand } from '@/components/site/CtaBand'
import { JsonLd } from '@/components/seo/JsonLd'
import { Container } from '@/components/ui/Container'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { getReferences } from '@/lib/data/projects'
import { itemListJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'

type Params = Promise<{ locale: Locale }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'References' })
  return pageMetadata({ locale, title: t('title'), description: t('description'), paths: await staticPaths('/referanslar') })
}

export default async function ReferencesPage({ params }: { params: Params }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, refs] = await Promise.all([getTranslations('References'), getReferences(locale)])
  return (
    <>
      <Container className="pt-10 md:pt-16">
        <JsonLd data={itemListJsonLd(refs.map((r) => ({ name: r.name })))} />
        <h1 className="text-[2.1rem] leading-[1.08] md:text-[3.2rem]">{t('title')}</h1>
        <p className="mt-5 max-w-[62ch] text-[1.15rem] text-ink-soft md:text-[1.25rem]">{t('description')}</p>
        {refs.length > 0 ? (
          <ul className="mt-10 max-w-4xl border-t border-line">
            {refs.map((r) => (
              <li key={r.id} className="grid gap-1 border-b border-line py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-6">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-[1.15rem] font-semibold">{r.name}</p>
                  {r.projects.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      {r.projects.map((p) => (
                        <li key={p.id}>
                          <Link href={{ pathname: '/projeler/[slug]', params: { slug: p.slug } }} className="text-action underline">
                            {p.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {r.location && <p className="text-ink-soft">{r.location}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-10 text-ink-soft">{t('empty')}</p>
        )}
      </Container>
      <CtaBand locale={locale} place="references_cta" />
    </>
  )
}
