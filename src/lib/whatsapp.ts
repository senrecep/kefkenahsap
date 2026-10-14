import { Result } from 'tsentials/result'
import { Err } from 'tsentials/errors'

/** Turkish phone number in any common format → E.164 digits without "+" (wa.me format). */
export function normalizeTrPhone(input: string): Result<string> {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('90') && d.length === 12) d = d.slice(2)
  if (d.startsWith('0') && d.length === 11) d = d.slice(1)
  return Result.successIf(d.length === 10, `90${d}`, Err.validation('Phone.Invalid', 'Geçersiz telefon numarası'))
}

/** wa.me link with a prefilled message; `{name}` placeholders without a value are removed. */
export function whatsappUrl(args: { phone: string; template?: string; vars?: Record<string, string | undefined> }): Result<string> {
  return Result.map(normalizeTrPhone(args.phone), (digits) => {
    const base = `https://wa.me/${digits}`
    if (!args.template) return base
    const text = args.template
      .replace(/\{(\w+)\}/g, (_, k: string) => args.vars?.[k] ?? '')
      .replace(/\(\s*\)/g, '')
      .replace(/\s+([.,!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()
    return `${base}?text=${encodeURIComponent(text)}`
  })
}
