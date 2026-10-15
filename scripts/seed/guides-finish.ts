// #146: brings the seeded guides in an existing database up to the committed seed, without touching owner edits:
//  - cover: the photo named in seed/content/guides/<file>.json (`cover`, an approved library photo), only while empty;
//  - showAuthor: on (the founder byline; siteSettings.founder). A checkbox cannot tell an owner's deliberate "off" from
//    the old default, so pass --skip-author if the owner has switched it off on purpose;
//  - ahsap-turleri, every locale: the old build notes ("eski sitemizdeki tablo…") become the reader-facing note, only
//    while the stored text is still exactly the old one; the woodSamples block goes in after the table note, only if absent.
// Each guide gets at most one write per locale, on its LATEST version: when that is published the write stays published
// (no new draft to forget), when it is a draft it stays a draft (an owner's unpublished draft is never pushed live).
// Prints the target database first; --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/guides-finish.ts [-- --dry-run | --yes] [--skip-author]
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import type { Config } from '@/payload-types'

import config from '@/payload.config'
import { insertBlockAfter, replaceText, textOf } from '@/lib/content/blocks'
import { parseGuide } from '@/lib/content/schema'

import { guardTarget, unwrap } from './i18n'

const dryRun = process.argv.includes('--dry-run')
const skipAuthor = process.argv.includes('--skip-author')
const DIR = path.resolve(process.cwd(), 'seed/content/guides')

// ahsap-turleri: [old, new] text of the table intro, the table note and the Thermowood cell, per locale (seed before #146 → after).
const FIXES: Record<string, [string, string][]> = {
  tr: [
    ['Tablo, eski sitemizdeki ağaç cinsleri tablosundan derlendi ve yaygın kaynaklardaki bilgilerle sadeleştirildi.', 'Değerler yaygın kaynaklardaki ortalamalardır; aynı türde bile ağaçtan ağaca değişir.'],
    ['* Thermowood eski tabloda yoktu; bu satır genel bilgidir. Yoğunluk değerleri kaynaklarda verilen ortalama değerlerdir; aynı türde bile ağaçtan ağaca değişir. "Kısmen", türün dış mekânda koşula ve bakıma bağlı olarak kullanılabildiğini anlatır.', '"Kısmen", türün dış mekânda koşula ve bakıma bağlı olarak kullanılabildiğini anlatır.'],
    ['Thermowood*', 'Thermowood'],
  ],
  en: [
    ['The table was compiled from the wood species table on our old site and simplified with information from common references.', 'The values are averages from common references; they vary from tree to tree even within one species.'],
    ['* Thermowood was not in the old table; this row is general knowledge. Densities are average values given in references and vary from tree to tree within a species. "Partly" means the species can be used outdoors depending on conditions and care.', '"Partly" means the species can be used outdoors depending on conditions and care.'],
    ['Thermowood*', 'Thermowood'],
  ],
  ru: [
    ['Таблица составлена на основе таблицы пород древесины с нашего прежнего сайта и упрощена с учётом данных из распространённых источников.', 'Значения — средние величины из распространённых источников; даже у одной породы они различаются от дерева к дереву.'],
    ['* Термодерева в прежней таблице не было; эта строка — общие сведения. Значения плотности — средние величины, приводимые в источниках; даже у одной породы они различаются от дерева к дереву. «Частично» означает, что породу можно использовать на улице в зависимости от условий и ухода.', '«Частично» означает, что породу можно использовать на улице в зависимости от условий и ухода.'],
    ['Термодерево*', 'Термодерево'],
  ],
  de: [
    ['Die Tabelle wurde aus der Holzartentabelle unserer früheren Website zusammengestellt und mit Angaben aus gängigen Quellen vereinfacht.', 'Die Werte sind Durchschnittswerte aus gängigen Quellen; selbst innerhalb einer Art schwanken sie von Baum zu Baum.'],
    ['* Thermoholz stand nicht in der alten Tabelle; diese Zeile ist allgemeines Wissen. Die Dichtewerte sind Durchschnittswerte aus der Literatur; selbst innerhalb einer Art schwanken sie von Baum zu Baum. „Teilweise“ bedeutet, dass die Art draußen je nach Bedingungen und Pflege eingesetzt werden kann.', '„Teilweise“ bedeutet, dass die Art draußen je nach Bedingungen und Pflege eingesetzt werden kann.'],
    ['Thermoholz*', 'Thermoholz'],
  ],
  ar: [
    ['جُمع الجدول من جدول أنواع الأشجار في موقعنا القديم، وبُسِّط بمعلومات من المصادر الشائعة.', 'القيم متوسطات من المصادر الشائعة، وتختلف من شجرة إلى أخرى حتى في النوع نفسه.'],
    ['* لم يكن الخشب المعالج حرارياً في الجدول القديم؛ وهذا السطر معلومات عامة. وقيم الكثافة هي متوسطات واردة في المصادر؛ وتختلف من شجرة إلى أخرى حتى في النوع نفسه. وكلمة «جزئيًا» تعني أن النوع يمكن استخدامه في الخارج حسب الظروف والصيانة.', 'كلمة «جزئيًا» تعني أن النوع يمكن استخدامه في الخارج حسب الظروف والصيانة.'],
    ['الخشب المعالج حرارياً*', 'الخشب المعالج حرارياً'],
  ],
}

type Body = { root: { type: string; children: unknown[] } & Record<string, unknown> } & Record<string, unknown>

/** The fixed ahsap-turleri body for one locale and what changed, or undefined when nothing does. */
function fixBody(body: Body | null | undefined, locale: string): { body: Body; what: string } | undefined {
  if (!body?.root) return undefined
  let next = body
  let texts = 0
  for (const [from, to] of FIXES[locale] ?? []) {
    const r = replaceText(next, from, to)
    if (r) [next, texts] = [r, texts + 1]
  }
  // After the table note (old or new wording), else right after the table; never twice.
  const notes = new Set((FIXES[locale] ?? []).slice(1, 2).flat())
  const placed =
    insertBlockAfter(next, 'woodSamples', (n) => notes.has(textOf(n))) ??
    insertBlockAfter(next, 'woodSamples', (n) => (n as { type?: string }).type === 'table')
  if (placed) next = placed
  const what = [texts && `${texts} text fix(es)`, placed && 'woodSamples block'].filter(Boolean).join(' + ')
  return what ? { body: next, what } : undefined
}

guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const locales = (payload.config.localization ? payload.config.localization.localeCodes : ['tr']) as Config['locale'][]
let writes = 0
const failed: string[] = []

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const seed = unwrap(parseGuide(readFileSync(path.join(DIR, file), 'utf8')))
  try {
    const found = await payload.find({ collection: 'guides', locale: 'tr', draft: true, where: { slug: { equals: seed.tr.slug } }, limit: 1, depth: 0 })
    const id = found.docs[0]?.id
    if (!id) {
      console.log(`guide ${file}: not in this database, skipped (scripts/seed/content.ts creates it)`)
      continue
    }
    const latest = await payload.findByID({ collection: 'guides', id, locale: 'tr', fallbackLocale: false, draft: true, depth: 0 })
    const published = latest._status === 'published'
    const write = async (locale: string, data: Record<string, unknown>, what: string) => {
      console.log(`${dryRun ? '[dry run] ' : ''}guide ${file} [${locale}] (${published ? 'published' : 'draft'}): ${what}`)
      writes++
      if (dryRun) return
      await payload.update({ collection: 'guides', id, locale: locale as 'tr', draft: !published, data: { ...data, ...(published ? { _status: 'published' } : {}) } as never, context: { skipAi: true } })
    }

    const doc: Record<string, unknown> = {}
    if (!latest.cover && seed.cover) {
      const media = await payload.find({ collection: 'media', where: { and: [{ seoFilename: { equals: seed.cover } }, { status: { equals: 'approved' } }] }, limit: 1, depth: 0, select: { seoFilename: true } })
      if (media.docs[0]) doc.cover = media.docs[0].id
      else console.log(`guide ${file}: cover "${seed.cover}" is not an approved photo here, left empty`)
    }
    if (!skipAuthor && !latest.showAuthor) doc.showAuthor = true
    if (Object.keys(doc).length) await write('tr', doc, Object.keys(doc).join(', '))

    if (seed.tr.slug !== 'ahsap-turleri') continue
    for (const locale of locales) {
      const current = await payload.findByID({ collection: 'guides', id, locale, fallbackLocale: false, draft: true, depth: 0 })
      const fixed = fixBody(current.body as Body | null | undefined, locale)
      if (fixed) await write(locale, { body: fixed.body }, fixed.what)
    }
  } catch (err) {
    // One guide must not stop the rest; listed below, and the run exits 1.
    failed.push(file)
    console.error(`guide ${file}: ${err instanceof Error ? err.message : err}`)
  }
}
console.log(`${dryRun ? '[dry run] ' : ''}guides finish: ${writes} write(s), ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
