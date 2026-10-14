import { routing } from '@/i18n/routing'

/**
 * PLAN §5.1: the language `/` redirects to. The remembered choice (NEXT_LOCALE cookie), then Accept-Language in
 * preference order; only a language in `live` (one with its own content, see getContentLocales) qualifies,
 * otherwise the default (tr).
 */
export function rootLocale(a: { accept: string | null; cookie?: string; live: readonly string[] }): string {
  const preferred = (a.accept ?? '')
    .split(',')
    .map((part, i) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.trim().slice(2) ?? 1)
      return { lang: tag.trim().toLowerCase().split('-')[0]!, q: Number.isFinite(q) ? q : 0, i }
    })
    .filter((p) => p.lang && p.q > 0)
    .sort((x, y) => y.q - x.q || x.i - y.i)
    .map((p) => p.lang)
  return [a.cookie, ...preferred].find((l): l is string => !!l && a.live.includes(l)) ?? routing.defaultLocale
}
