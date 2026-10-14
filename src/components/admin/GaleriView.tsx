import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { redirect } from 'next/navigation'

import { GaleriClient } from './GaleriClient'

/** /admin/galeri — mobile-first upload, review and ordering of category media (PLAN §4 "Admin deneyimi"). */
export async function GaleriView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, locale, permissions, visibleEntities } = initPageResult
  const user = req.user as { role?: string } | null
  if (!user?.role) redirect(`${req.payload.config.routes.admin}/login`)

  const query = { depth: 0, limit: 200, locale: 'tr', overrideAccess: false, pagination: false, req } as const
  const [categories, projects] = await Promise.all([
    req.payload.find({ ...query, collection: 'categories', sort: '_order', select: { name: true } }),
    req.payload.find({ ...query, collection: 'projects', sort: '-updatedAt', select: { title: true } }),
  ])

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      req={req}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={{ collections: visibleEntities?.collections, globals: visibleEntities?.globals }}
    >
      <GaleriClient
        categories={categories.docs.map((c) => ({ id: c.id, name: c.name || `#${c.id}` }))}
        projects={projects.docs.map((p) => ({ id: p.id, name: p.title || `#${p.id}` }))}
      />
    </DefaultTemplate>
  )
}
