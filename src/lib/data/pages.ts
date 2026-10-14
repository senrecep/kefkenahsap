import { unstable_cache } from 'next/cache'

import { routing, type Locale } from '@/i18n/routing'

import { getPayload, TAGS } from './payload'

/** Published `pages` doc whose slug (in `locale`) is one of `slugs`; null → the page falls back to its in-repo template. */
export const getPage = (locale: Locale, slugs: string[]) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'pages',
        locale,
        limit: 1,
        depth: 1,
        overrideAccess: false,
        draft: false,
        where: { and: [{ slug: { in: slugs } }, { _status: { equals: 'published' } }] },
      })
      return res.docs[0] ?? null
    },
    ['page', locale, ...slugs],
    { tags: [TAGS.pages], revalidate: 3600 },
  )()

/** Each locale's own title of that page (no fallback), for the dil-yayında rule; null when no CMS page exists. */
export const getPageTitles = (slugs: string[]) =>
  unstable_cache(
    async () => {
      const page = await getPage(routing.defaultLocale, slugs)
      if (!page) return null
      const all = await (await getPayload()).findByID({ collection: 'pages', id: page.id, locale: 'all', depth: 0, overrideAccess: false, draft: false, select: { title: true } })
      return (all.title ?? {}) as unknown as Record<string, string | null | undefined>
    },
    ['pageTitles', ...slugs],
    { tags: [TAGS.pages], revalidate: 3600 },
  )()
