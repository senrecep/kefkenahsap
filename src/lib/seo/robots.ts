import type { MetadataRoute } from 'next'

/**
 * PLAN §7 Teknik 6: a single `User-agent: *` group (a bot-specific group would replace these rules and lose
 * the /admin disallow), so every search and AI crawler is allowed. Non-production environments block all.
 */
export function robotsFor(args: { production: boolean; site: string; searchPaths: string[] }): MetadataRoute.Robots {
  if (!args.production) return { rules: [{ userAgent: '*', disallow: '/' }] }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', ...args.searchPaths] }],
    sitemap: `${args.site.replace(/\/$/, '')}/sitemap.xml`,
  }
}
