import { unstable_cache } from 'next/cache'

import type { Locale } from '@/i18n/routing'
import type { Category, Media, Project } from '@/payload-types'

import { getPayload, TAGS } from './payload'

const HOUR = 3600
// The local API bypasses collection access, so public filters are explicit here.
const published = { _status: { equals: 'published' } } as const
const isApproved = (m: unknown): m is Media => typeof m === 'object' && m !== null && (m as Media).status === 'approved'

const card = (p: Pick<Project, 'id' | 'title' | 'slug' | 'city' | 'district' | 'year' | 'cover' | 'gallery' | 'categories'>) => ({
  id: p.id,
  title: p.title,
  slug: p.slug!,
  city: p.city,
  district: p.district,
  year: p.year,
  cover: isApproved(p.cover) ? p.cover : (p.gallery ?? []).find(isApproved),
  categories: (p.categories ?? []).filter((c): c is Category => typeof c === 'object' && c !== null && c._status === 'published'),
})
export type ProjectCard = ReturnType<typeof card>

/** All published projects as cards, newest first. shortcut: filtered in memory, move to a DB query past ~200 projects. */
export const getProjectCards = (locale: Locale) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'projects',
        locale,
        depth: 1,
        limit: 200,
        sort: ['-year', '-createdAt'],
        where: published,
        select: { title: true, slug: true, city: true, district: true, year: true, cover: true, gallery: true, categories: true },
      })
      return res.docs.filter((p) => p.slug).map(card)
    },
    ['projectCards', locale],
    { tags: [TAGS.projects, TAGS.media, TAGS.categories], revalidate: HOUR },
  )()

/** Published project by localized slug, with approved gallery photos in saved order and every locale's slug. */
export const getProject = (locale: Locale, slug: string) =>
  unstable_cache(
    async () => {
      const payload = await getPayload()
      const res = await payload.find({ collection: 'projects', locale, depth: 1, limit: 1, where: { and: [published, { slug: { equals: slug } }] } })
      const project = res.docs[0]
      if (!project) return null
      const all = (await payload.findByID({
        collection: 'projects',
        id: project.id,
        locale: 'all',
        depth: 0,
        select: { slug: true, title: true },
      })) as unknown as { slug?: Record<string, string | null>; title?: Record<string, string | null> }
      const slugs: Record<string, string> = {}
      for (const [l, s] of Object.entries(all.slug ?? {})) if (s && all.title?.[l]) slugs[l] = s
      // Draft categories stay off the public page (the local API returns them).
      project.categories = (project.categories ?? []).filter((c) => typeof c === 'object' && c?._status === 'published')
      return { project, gallery: (project.gallery ?? []).filter(isApproved), cover: isApproved(project.cover) ? project.cover : undefined, slugs }
    },
    ['project', locale, slug],
    { tags: [TAGS.projects, TAGS.media, TAGS.categories, TAGS.tags], revalidate: HOUR },
  )()

/** References with their published projects (no logos: PLAN §6). */
export const getReferences = (locale: Locale) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'references',
        locale,
        depth: 1,
        limit: 200,
        sort: '_order',
        select: { name: true, location: true, projects: true },
        joins: { projects: { limit: 20, where: published } },
      })
      return res.docs.map((r) => ({
        id: r.id,
        name: r.name,
        location: r.location,
        projects: (r.projects?.docs ?? []).filter((p): p is Project => typeof p === 'object' && Boolean(p.slug)).map((p) => ({ id: p.id, title: p.title, slug: p.slug! })),
      }))
    },
    ['references', locale],
    { tags: [TAGS.references, TAGS.projects], revalidate: HOUR },
  )()
