import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

import type { AiTask } from '../models'
import type { GuideDraft, StoryDraft } from '../prompts/draft'

/** "AI ile taslak" targets: guides (excerpt + body) and project stories. */
export const DRAFT_TASKS = { guides: 'draftGuide', projects: 'draftProjectStory' } as const satisfies Record<string, AiTask>
export type DraftCollection = keyof typeof DRAFT_TASKS
export const isDraftable = (c: string): c is DraftCollection => Object.hasOwn(DRAFT_TASKS, c)
/** The rich text field the draft writes; it must be empty (a person's text is never overwritten). */
export const DRAFT_BODY: Record<DraftCollection, 'body' | 'story'> = { guides: 'body', projects: 'story' }

const MAX_NOTES = 40
export const MAX_NOTES_CHARS = 4000
const MAX_CHARS = MAX_NOTES_CHARS

export function parseNotes(raw: string): Result<string[]> {
  if (raw.length > MAX_CHARS) return Result.failure(Err.validation('Draft.NotesTooLong', `Notlar en çok ${MAX_CHARS} karakter olabilir.`))
  const notes = raw
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
  if (!notes.length) return Result.failure(Err.validation('Draft.NotesRequired', 'En az bir not yazın (her satıra bir madde).'))
  if (notes.length > MAX_NOTES) return Result.failure(Err.validation('Draft.NotesTooLong', `En çok ${MAX_NOTES} madde yazılabilir.`))
  return Result.success(notes)
}

type Settings = {
  companyName?: string | null
  foundingYear?: number | null
  founder?: { name?: string | null; craftStartYear?: number | null } | null
  teamSize?: number | null
  projectCount?: number | null
  address?: { district?: string | null; city?: string | null } | null
  areaServed?: { name?: string | null }[] | null
}

/** Site Bilgileri as fact lines; an empty field gives no line, so the model has nothing to restate (no invented claims). */
export function siteFacts(s: Settings): string[] {
  const place = [s.address?.district, s.address?.city].filter(Boolean).join(', ')
  const areas = (s.areaServed ?? []).map((a) => a.name).filter(Boolean).join(', ')
  return [
    s.companyName && `Firma adı: ${s.companyName}`,
    s.foundingYear && `Kuruluş yılı: ${s.foundingYear}`,
    s.founder?.name && `Kurucu: ${s.founder.name}`,
    s.founder?.craftStartYear && `Kurucunun mesleğe başlama yılı: ${s.founder.craftStartYear}`,
    s.teamSize && `Ekip büyüklüğü: ${s.teamSize}`,
    s.projectCount && `Tamamlanan proje sayısı: ${s.projectCount}`,
    place && `Adres: ${place}`,
    areas && `Hizmet verilen bölgeler: ${areas}`,
  ].filter((x): x is string => Boolean(x))
}

const text = (t: string) => ({ mode: 'normal', text: t, type: 'text', style: '', detail: 0, format: 0, version: 1 })
const block = { format: '', indent: 0, version: 1, direction: 'ltr' as const }
const paragraph = (t: string) => ({ ...block, type: 'paragraph', textFormat: 0, children: [text(t)] })
type LexNode = { type: string; text?: string; children?: LexNode[]; [k: string]: unknown }
const root = (children: LexNode[]) => ({ root: { type: 'root', ...block, children } })

export function guideLexical(sections: GuideDraft['sections']) {
  return root(
    sections.flatMap((s) => [
      { ...block, type: 'heading', tag: 'h2', children: [text(s.heading)] },
      ...s.paragraphs.filter((p) => p.trim()).map(paragraph),
      ...(s.bullets.some((b) => b.trim())
        ? [{
            ...block, type: 'list', tag: 'ul', listType: 'bullet', start: 1,
            children: s.bullets.filter((b) => b.trim()).map((b, i) => ({ ...block, type: 'listitem', value: i + 1, children: [text(b)] })),
          }]
        : []),
    ]),
  )
}

export const storyLexical = (paragraphs: string[]) => root(paragraphs.filter((p) => p.trim()).map(paragraph))

/** Update data from the model output. Built field by field, so nothing else the model returns (e.g. `_status`) gets through. */
export function draftData(collection: DraftCollection, output: GuideDraft | StoryDraft, current: { excerpt?: string | null }): Record<string, unknown> {
  if (collection === 'projects') return { story: storyLexical((output as StoryDraft).paragraphs) }
  const g = output as GuideDraft
  return { body: guideLexical(g.sections), ...(current.excerpt?.trim() ? {} : { excerpt: g.excerpt }) }
}

/**
 * The only update an AI draft makes: a draft version in the default locale, as the signed-in user.
 * `_status` is removed here whatever the caller passed, so this path cannot publish.
 */
export function draftUpdateArgs(a: { collection: DraftCollection; id: number | string; data: Record<string, unknown> }) {
  const { _status: _drop, ...data } = a.data
  return { collection: a.collection, id: a.id, locale: 'tr' as const, data, draft: true as const, overrideAccess: false as const }
}

/** Photos whose captions may go to the model: only ones attached to this document (gallery/cover) that are approved. */
export function allowedPhotoIds(requested: number[], doc: { gallery?: unknown; cover?: unknown }): number[] {
  const own = new Set([...(Array.isArray(doc.gallery) ? doc.gallery : []), doc.cover].map((v) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)))
  return requested.filter((id) => own.has(id))
}
