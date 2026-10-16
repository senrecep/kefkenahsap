import { describe, expect, it } from 'vitest'

import { renameRedirect } from './rename'

// Hand-written from CATEGORY_RENAMES (#172): ahsap-yapilar → sundurma-ve-ahsap-cati and its localized slugs.
const db = (...slugs: string[]) => async (s: string) => slugs.includes(s)

describe('renameRedirect', () => {
  describe('before the rename (old data: the record still has the old slugs)', () => {
    const exists = db('ahsap-yapilar', 'wooden-structures', 'holzbauten')
    it('sends the new slug to the old one that is live, temporarily', async () => {
      expect(await renameRedirect('tr', 'sundurma-ve-ahsap-cati', exists)).toEqual({ slug: 'ahsap-yapilar', permanent: false })
      expect(await renameRedirect('de', 'vordaecher-und-holzdaecher', exists)).toEqual({ slug: 'holzbauten', permanent: false })
    })
    it('never redirects the old slug (it is the live page)', async () => {
      expect(await renameRedirect('tr', 'ahsap-yapilar', exists)).toBeNull()
    })
  })

  describe('after the rename', () => {
    const exists = db('sundurma-ve-ahsap-cati', 'porches-and-timber-roofs', 'navesy-i-derevyannye-kryshi', 'mazallat-wa-asquf-khashabiya')
    it('sends every old localized slug to the new one, permanently', async () => {
      expect(await renameRedirect('tr', 'ahsap-yapilar', exists)).toEqual({ slug: 'sundurma-ve-ahsap-cati', permanent: true })
      expect(await renameRedirect('en', 'wooden-structures', exists)).toEqual({ slug: 'porches-and-timber-roofs', permanent: true })
      expect(await renameRedirect('ru', 'derevyannye-konstruktsii', exists)).toEqual({ slug: 'navesy-i-derevyannye-kryshi', permanent: true })
      expect(await renameRedirect('ar', 'hayakil-khashabiya', exists)).toEqual({ slug: 'mazallat-wa-asquf-khashabiya', permanent: true })
    })
  })

  it('answers null when neither slug exists, for a slug of another locale, and for any other slug', async () => {
    expect(await renameRedirect('ru', 'derevyannye-konstruktsii', db())).toBeNull()
    expect(await renameRedirect('en', 'ahsap-yapilar', db('sundurma-ve-ahsap-cati', 'porches-and-timber-roofs'))).toBeNull()
    expect(await renameRedirect('tr', 'deck-ve-zeminler', db('deck-ve-zeminler'))).toBeNull()
  })

  it('asks the database only for a renamed slug', async () => {
    let calls = 0
    await renameRedirect('tr', 'yok-boyle-bir-sey', async () => (calls++, true))
    expect(calls).toBe(0)
  })

  it('never sends the two slugs to each other: with a fresh existence check exactly one direction can fire', async () => {
    for (const live of ['ahsap-yapilar', 'sundurma-ve-ahsap-cati']) {
      const exists = db(live)
      const fired = [await renameRedirect('tr', 'ahsap-yapilar', exists), await renameRedirect('tr', 'sundurma-ve-ahsap-cati', exists)].filter(Boolean)
      expect(fired, live).toHaveLength(1)
      expect(fired[0]!.slug).toBe(live)
    }
  })
})
