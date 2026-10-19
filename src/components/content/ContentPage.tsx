import type { ReactNode } from 'react'

import { Breadcrumb } from '@/components/site/Breadcrumb'
import { Container } from '@/components/ui/Container'
import type { Locale } from '@/i18n/routing'

// Read mode: one comfortable measure, quiet hierarchy. Shared by CMS rich text and in-repo templates.
export const proseClass =
  'max-w-[68ch] text-lg leading-relaxed text-ink [&_a:not([class])]:font-semibold [&_a:not([class])]:text-action [&_a:not([class])]:underline [&_a:not([class])]:underline-offset-2 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-balance [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-[family-name:var(--font-display)] [&_h3]:text-xl [&_h3]:font-semibold [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mt-4 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:ps-6'

/** Title + body for legal pages (with their breadcrumb: `path` is the page's own path); `note` is a visually quiet remark under the title (e.g. the last-updated date). */
export function ContentPage({ locale, path, title, note, children }: { locale: Locale; path: string; title: string; note?: string; children: ReactNode }) {
  return (
    <Container className="pt-10 pb-6 md:pt-14">
      <Breadcrumb locale={locale} className="mb-6" items={[{ name: title, path }]} />
      <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-balance">{title}</h1>
      {note && <p className="mt-3 text-[0.95rem] text-ink-soft">{note}</p>}
      <div className={`mt-6 ${proseClass}`}>{children}</div>
    </Container>
  )
}
