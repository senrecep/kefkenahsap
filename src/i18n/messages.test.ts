import { describe, expect, it } from 'vitest'

import { routing } from './routing'

const load = async (l: string) => (await import(`../../messages/${l}/index.ts`)).default as Record<string, unknown>
const keys = (o: unknown, p = ''): string[] =>
  o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [p.slice(0, -1)]

// Every locale ships every UI string the TR source has, and nothing else (no silent key fallback at runtime).
describe('messages', () => {
  it.each(routing.locales.filter((l) => l !== routing.defaultLocale))('%s has the same keys as tr', async (l) => {
    expect(keys(await load(l)).sort()).toEqual(keys(await load(routing.defaultLocale)).sort())
  })
})
