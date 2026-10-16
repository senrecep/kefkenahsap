import { describe, expect, it } from 'vitest'

import { renameRedirect } from './rename'

// Hand-written from CATEGORY_RENAMES (#172): ahsap-yapilar → sundurma-ve-ahsap-cati and its localized slugs.
const db = (...slugs: string[]) => async (s: string) => slugs.includes(s)

describe('renameRedirect', () => {
  describe('before the rename (old data: the record still has the old slugs)', () => {
    const exists = db('ahsap-yapilar', 'wooden-structures', 'holzbauten')
    it('sends the new slug to the old one that is live', async () => {
      expect(await renameRedirect('tr', 'sundurma-ve-ahsap-cati', exists)).toBe('ahsap-yapilar')
      expect(await renameRedirect('de', 'vordaecher-und-holzdaecher', exists)).toBe('holzbauten')
    })
    it('never redirects the old slug (it is the live page)', async () => {
      expect(await renameRedirect('tr', 'ahsap-yapilar', exists)).toBeNull()
    })
  })

  describe('after the rename', () => {
    const exists = db('sundurma-ve-ahsap-cati', 'porches-and-timber-roofs', 'navesy-i-derevyannye-kryshi', 'mazallat-wa-asquf-khashabiya')
    it('sends every old localized slug to the new one', async () => {
      expect(await renameRedirect('tr', 'ahsap-yapilar', exists)).toBe('sundurma-ve-ahsap-cati')
      expect(await renameRedirect('en', 'wooden-structures', exists)).toBe('porches-and-timber-roofs')
      expect(await renameRedirect('ru', 'derevyannye-konstruktsii', exists)).toBe('navesy-i-derevyannye-kryshi')
      expect(await renameRedirect('ar', 'hayakil-khashabiya', exists)).toBe('mazallat-wa-asquf-khashabiya')
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
})
