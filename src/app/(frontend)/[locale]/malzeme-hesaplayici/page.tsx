import type { Metadata } from 'next'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'

import { CalculatorLazy } from '@/components/calculator/CalculatorLazy'
import type { CalcUi } from '@/components/calculator/ui'
import { JsonLd } from '@/components/seo/JsonLd'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { CtaBand } from '@/components/site/CtaBand'
import { Container } from '@/components/ui/Container'
import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { siteUrl } from '@/lib/seo/alternates'
import { webApplicationJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'

type Params = Promise<{ locale: Locale }>

// The calculation lives in the URL fragment (#c=…), which never reaches the server: the page stays one cached
// document, and a filled link is never a separate URL to index (its canonical is this clean page).
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Calculator' })
  return pageMetadata({ locale, title: t('title'), description: t('description'), paths: await staticPaths('/malzeme-hesaplayici') })
}

export default async function CalculatorPage({ params }: { params: Params }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, messages] = await Promise.all([getTranslations('Calculator'), getMessages()])
  const ui: CalcUi = { ...(messages as unknown as { Calculator: { ui: Omit<CalcUi, 'title'> } }).Calculator.ui, title: t('title') }
  const path = getPathname({ locale, href: '/malzeme-hesaplayici' })
  const site = siteUrl().replace(/\/$/, '')
  const h2 = 'text-[1.5rem] md:text-[1.85rem]'
  return (
    <>
      <JsonLd data={webApplicationJsonLd({ site, name: t('title'), url: site + path, description: t('description'), locale })} />
      <Container className="pt-6 md:pt-10">
        <Breadcrumb locale={locale} items={[{ name: t('title'), path }]} />
        <h1 className="mt-6 max-w-[22ch] text-[2.1rem] leading-[1.08] md:text-[3.2rem]">{t('title')}</h1>
        <p className="mt-5 max-w-[62ch] text-[1.15rem] text-ink-soft md:text-[1.25rem]">{t('description')}</p>
      </Container>
      {/* Container classes on a plain div: print keeps only this block (styles.css, [data-calc-tool]). */}
      <div data-calc-tool className="mx-auto mt-10 w-full max-w-7xl px-4 md:mt-12 md:px-6">
        <CalculatorLazy locale={locale} ui={ui} logoSrc="/brand/logo.webp" />
      </div>
      <Container as="section" aria-labelledby="calc-how" className="mt-20 grid gap-x-12 gap-y-10 md:mt-24 lg:grid-cols-2">
        <div>
          <h2 id="calc-how" className={h2}>
            {t('howTitle')}
          </h2>
          <ul className="mt-5 border-t border-line">
            {(['volume', 'example', 'extras', 'vat'] as const).map((k) => (
              <li key={k} className="max-w-[65ch] border-b border-line py-4">
                {t(`how.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className={h2}>{t('limitsTitle')}</h2>
          <ul className="mt-5 border-t border-line">
            {(['prices', 'estimate', 'privacy'] as const).map((k) => (
              <li key={k} className="max-w-[65ch] border-b border-line py-4">
                {t(`limits.${k}`)}
              </li>
            ))}
          </ul>
        </div>
      </Container>
      <CtaBand locale={locale} place="calculator_cta" />
    </>
  )
}
