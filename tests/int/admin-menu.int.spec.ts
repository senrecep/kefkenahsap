// #27: `admin.hidden` per role. Editors keep Projeler, Yazılar (#49), Talepler, Giden E-postalar (#254), Site Bilgileri plus media/categories, which stay routable
// for the Galeri view (their nav links are hidden by GaleriNavLink instead); admins see all. Access control is untouched.
import { describe, expect, it } from 'vitest'

import { hiddenFromEditor } from '@/access'
import config from '@/payload.config'

const editor = { id: 1, role: 'editor' }
const admin = { id: 2, role: 'admin' }
const editorVisible = ['projects', 'guides', 'leads', 'outgoing-emails', 'siteSettings', 'media', 'categories']

describe('admin nav per role', async () => {
  const c = await config
  const entities = [...c.collections.filter((e) => !e.slug.startsWith('payload-')).map((e) => ({ slug: e.slug, hidden: e.admin.hidden })), ...c.globals.filter((e) => !e.slug.startsWith('payload-')).map((e) => ({ slug: e.slug, hidden: e.admin.hidden }))]
  const isHidden = (e: (typeof entities)[number], user: unknown) => (typeof e.hidden === 'function' ? e.hidden({ user } as never) : e.hidden === true)

  it('editor keeps only the entities it needs', () => {
    expect(entities.filter((e) => !isHidden(e, editor)).map((e) => e.slug).sort()).toEqual([...editorVisible].sort())
  })

  // #192: Menüler is hidden from everyone too: the site's menus are built in code, so its edits changed nothing.
  it('admin sees everything except the always-hidden lead photos and Menüler', () => {
    expect(entities.filter((e) => isHidden(e, admin)).map((e) => e.slug)).toEqual(['lead-photos', 'navigation'])
  })

  it('a missing user is treated as hidden (fail closed)', () => {
    expect(hiddenFromEditor({ user: undefined })).toBe(true)
    expect(hiddenFromEditor({ user: null })).toBe(true)
  })
})
