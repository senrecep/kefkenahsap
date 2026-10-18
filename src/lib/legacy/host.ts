/**
 * The canonical origin to send a request to when it arrived on the apex of a `www.` canonical host
 * (NEXT_PUBLIC_SITE_URL), else null. Only the apex matches, so dev hosts, IPs and previews are untouched (PLAN §5.1).
 */
export function apexRedirectOrigin(host: string | null, siteUrl: string | undefined): string | null {
  if (!host || !siteUrl) return null
  const canonical = new URL(siteUrl)
  if (!canonical.hostname.startsWith('www.')) return null
  const hostname = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
  return hostname === canonical.hostname.slice(4) ? canonical.origin : null
}
