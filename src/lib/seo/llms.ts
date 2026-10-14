type Text = string | null | undefined

export type FactsInput = {
  companyName: string
  founderName?: Text
  foundingYear?: number | null
  address?: { street?: Text; district?: Text; city?: Text; postalCode?: Text; country?: Text } | null
  phones?: { label?: Text; number: string }[] | null
  email?: Text
  hours?: { days?: Text[] | null; opens: string; closes: string }[] | null
  areaServed?: { name: string }[] | null
  services?: string[]
  social?: { instagram?: Text; facebook?: Text; googleBusiness?: Text } | null
}

const join = (parts: Text[]) => parts.filter((p) => p?.trim()).join(', ')

/** PLAN §7 Teknik 9 "Key Facts": siteSettings fields only, and only the filled ones (never an invented value). */
export function keyFacts(f: FactsInput, site: string): string[] {
  const facts: [string, Text | number][] = [
    ['Name', f.companyName],
    ['Website', site],
    ['Founder', f.founderName],
    ['Founded', f.foundingYear],
    ['Address', f.address && join([f.address.street, f.address.district, f.address.city, f.address.postalCode, f.address.country])],
    ...(f.phones ?? []).map((p): [string, Text] => ['Phone', p.label?.trim() ? `${p.number} (${p.label})` : p.number]),
    ['Email', f.email],
    ...(f.hours ?? []).map((h): [string, Text] => ['Opening hours', `${join(h.days ?? [])} ${h.opens}–${h.closes}`]),
    ['Areas served', join((f.areaServed ?? []).map((a) => a.name))],
    ['Services', join(f.services ?? [])],
    ['Instagram', f.social?.instagram],
    ['Facebook', f.social?.facebook],
    ['Google Business Profile', f.social?.googleBusiness],
  ]
  return facts.filter(([, v]) => (typeof v === 'number' ? true : v?.trim())).map(([k, v]) => `- ${k}: ${v}`)
}

export type LlmsSection = { title: string; items: { name: string; url: string; text?: Text }[] }

/** llms.txt (link list) or llms-full.txt (`full`: each item with its whole text), per llmstxt.org. */
export function llmsTxt(args: { title: string; summary?: Text; facts: string[]; sections: LlmsSection[]; full?: boolean }): string {
  const out = [`# ${args.title}`, '']
  if (args.summary?.trim()) out.push(`> ${args.summary.trim()}`, '')
  if (args.facts.length) out.push('## Key Facts', '', ...args.facts, '')
  for (const s of args.sections) {
    out.push(`## ${s.title}`, '')
    for (const i of s.items) {
      const text = i.text?.trim()
      if (args.full) out.push(`### [${i.name}](${i.url})`, '', ...(text ? [text, ''] : []))
      else out.push(`- [${i.name}](${i.url})${text ? `: ${text}` : ''}`)
    }
    if (!args.full) out.push('')
  }
  return out.join('\n')
}
