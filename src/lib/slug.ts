import { Result } from 'tsentials/result'
import { Err } from 'tsentials/errors'

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', ß: 'ss' }
// Russian → Latin (BGN/PCGN-style, no diacritics): ru titles get readable ASCII slugs too.
const RU_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

/** URL/file slug from Turkish, English, German or Russian text: ASCII, lowercase, dash-separated, cut at a word boundary. */
export function slugify(input: string, maxLength = 80): Result<string> {
  const ascii = input
    .toLocaleLowerCase('tr-TR')
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
