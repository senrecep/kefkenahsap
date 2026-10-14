// #138: every committed translation overlay (seed/i18n/<locale>/…) parses, matches its source file and has unique slugs.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Maybe } from 'tsentials/maybe'
import type { Result } from 'tsentials/result'

import { routing } from '@/i18n/routing'

import { overlayLocales, readOverlay, uniqueSlugs } from './overlay'
import {
  parseCategoryOverlay,
  parseGuideOverlay,
  parseMediaMetaOverlay,
  parsePageOverlay,
  parseProjectStoriesOverlay,
  parseReferences,
  parseReferencesOverlay,
} from './schema'

const SEED = path.resolve(process.cwd(), 'seed')
const files = (dir: string) => (existsSync(path.join(SEED, dir)) ? readdirSync(path.join(SEED, dir), { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.json')).sort() : [])
const locales = overlayLocales(routing.locales).filter((l) => existsSync(path.join(SEED, 'i18n', l)))
const read = <T>(locale: string, rel: string, parse: (json: string) => Result<T>): T => {
  const r = readOverlay(SEED, locale, rel, parse)
  if (!r.ok) throw new Error(r.errors[0]!.description)
  if (!Maybe.isSome(r.value)) throw new Error(`${locale}/${rel}: missing`)
  return r.value.value
}

describe.each(locales)('%s overlays', (locale) => {
  it.each([
    ['content/categories', parseCategoryOverlay],
    ['content/guides', parseGuideOverlay],
    ['content/pages', parsePageOverlay],
  ] as const)('%s: one valid file per source file, slugs unique', (dir, parse) => {
    expect(files(`i18n/${locale}/${dir}`)).toEqual(files(dir))
    const slugs = files(dir).map((f) => ({ locale, slug: read(locale, `${dir}/${f}`, parse as (j: string) => Result<{ slug: string }>).slug, file: f }))
    expect(uniqueSlugs(slugs)).toEqual({ ok: true, value: undefined })
  })

  it('project stories cover the same projects', () => {
    const source = Object.keys(JSON.parse(readFileSync(path.join(SEED, 'content/project-stories.json'), 'utf8')) as object).sort()
    expect(Object.keys(read(locale, 'content/project-stories.json', parseProjectStoriesOverlay)).sort()).toEqual(source)
  })

  it('reference locations cover the same names', () => {
    const r = parseReferences(readFileSync(path.join(SEED, 'content/references.json'), 'utf8'))
    expect(Object.keys(read(locale, 'content/references.json', parseReferencesOverlay)).sort()).toEqual(r.ok ? r.value.map((x) => x.name).sort() : [])
  })

  it.each(['media-meta', 'media-meta-archive'])('%s: one valid file per photo', (dir) => {
    expect(files(`i18n/${locale}/${dir}`)).toEqual(files(dir))
    for (const f of files(dir)) read(locale, `${dir}/${f}`, parseMediaMetaOverlay)
  })
})
