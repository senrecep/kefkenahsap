import { routing } from '@/i18n/routing'
import { siteUrl } from '@/lib/seo/alternates'
import { keyFacts, llmsTxt } from '@/lib/seo/llms'

import { getServicesAllLocales } from './seo'
import { getSiteSettings } from './site'

/** llms.txt / llms-full.txt (PLAN §7 Teknik 9): Key Facts from siteSettings + every live service per locale. */
export async function renderLlms(full: boolean) {
  const locale = routing.defaultLocale
  const [s, services] = await Promise.all([getSiteSettings(locale), getServicesAllLocales()])
  const site = siteUrl().replace(/\/$/, '')
  // Whitelisted fields only: settings also hold admin-only values (analytics ids, templates).
  const facts = keyFacts(
    {
      companyName: s.companyName,
      founderName: s.founder?.name,
      foundingYear: s.foundingYear,
      address: s.address,
      phones: s.phones,
      email: s.email,
      hours: s.hours,
      areaServed: s.areaServed,
      services: services.map((c) => c.name?.[locale]).filter((n): n is string => Boolean(n)),
      social: s.social,
    },
    site,
  )
  const sections = routing.locales.map((l) => ({
    title: `Services (${l})`,
    items: services
      .filter((c) => c.paths[l])
      .map((c) => {
        const faq = (c.faq?.[l] ?? []).map((f) => `**${f.q}**\n${f.a}`)
        return { name: c.name![l]!, url: `${site}${c.paths[l]}`, text: full ? [c.shortDesc?.[l], ...faq].filter(Boolean).join('\n\n') : c.shortDesc?.[l] }
      }),
  }))
  return llmsTxt({ title: s.companyName, summary: s.defaultDescription, facts, sections, full })
}

export const llmsResponse = async (full: boolean) =>
  new Response(await renderLlms(full), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
