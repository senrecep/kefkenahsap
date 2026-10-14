import { Result } from 'tsentials/result'
import { Err } from 'tsentials/errors'

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }

/** URL/file slug from Turkish or English text: ASCII, lowercase, dash-separated, cut at a word boundary. */
export function slugify(input: string, maxLength = 80): Result<string> {
  const ascii = input
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => TR_MAP[c] ?? c)
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
