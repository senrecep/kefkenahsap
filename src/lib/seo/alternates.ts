/** Canonical + hreflang map (PLAN §5.1, §7): only locales whose translation is published are listed; x-default → TR. */
export function buildAlternates(args: { current: string; paths: Record<string, string | null | undefined>; site: string }) {
  const abs = (p: string) => `${args.site.replace(/\/$/, '')}${p}`
  const languages: Record<string, string> = {}
  for (const [l, p] of Object.entries(args.paths)) if (p) languages[l] = abs(p)
  if (args.paths.tr) languages['x-default'] = abs(args.paths.tr)
  const own = args.paths[args.current]
  return { canonical: own ? abs(own) : undefined, languages }
}

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.kefkenahsap.com'
