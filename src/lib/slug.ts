import { Result } from 'tsentials/result'
import { Err } from 'tsentials/errors'

import { routing } from '@/i18n/routing'

// Fixed route segments (TR internal + translated public paths): a category slug may not shadow them.
export const RESERVED_CATEGORY_SLUGS: ReadonlySet<string> = new Set([
  ...Object.entries(routing.pathnames)
    .flatMap(([internal, p]) => [internal, ...(typeof p === 'string' ? [] : Object.values(p))].map((x) => x.split('/')[1]!))
    .filter((seg) => seg && !seg.startsWith('[')), // '/' and dynamic segments are not reserved words
  'admin',
  'api',
  'wp-content',
])

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', ß: 'ss' }
// Russian → Latin (BGN/PCGN-style, no diacritics): ru titles get readable ASCII slugs too.
const RU_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

// German spelling for umlauts in a de text (Über → ueber); elsewhere ö/ü are Turkish letters (o/u).
const DE_MAP: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue' }

/** URL/file slug from Turkish, English, German (pass locale 'de' for ae/oe/ue) or Russian text: ASCII, lowercase, dash-separated, cut at a word boundary. */
export function slugify(input: string, maxLength = 80, locale?: string): Result<string> {
  const lower = input.toLocaleLowerCase(locale === 'de' ? 'de-DE' : 'tr-TR')
  const ascii = (locale === 'de' ? lower.replace(/[äöü]/g, (c) => DE_MAP[c]!) : lower)
    .replace(/[çğıöşüß]/g, (c) => TR_MAP[c] ?? c)
    .replace(/[а-яё]/g, (c) => RU_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
  const words = ascii.split(/[^a-z0-9]+/).filter(Boolean)
  let out = ''
  for (const w of words) {
    const next = out ? `${out}-${w}` : w
    if (next.length > maxLength) break
    out = next
  }
  // A single word longer than maxLength is truncated rather than dropped.
  if (!out && words[0]) out = words[0].slice(0, maxLength)
  return Result.successIf(out.length > 0, out, Err.validation('Slug.Empty', 'Text produced an empty slug'))
}
