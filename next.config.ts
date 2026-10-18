import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  output: 'standalone',
  // Trailing slashes are normalized in proxy.ts together with legacy redirects, so each old URL takes one hop.
  skipTrailingSlashRedirect: true,
  // Quote form: photos are downscaled in the browser (≤2560px WebP, re-encoded if >3 MB), so 5 fit well under 16 MB.
  // proxy.ts buffers request bodies (default 10 MB) and that limit is global, so keep both at the same modest ceiling.
  experimental: { serverActions: { bodySizeLimit: '16mb' }, proxyClientMaxBodySize: '16mb' },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
  // Anything that is not production must never be indexed.
  async headers() {
    // Personal data (lead photos) must never be stored by a shared cache (Cloudflare, proxies).
    const privateFiles = { source: '/api/lead-photos/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] }
    // Share cards (#199): unversioned names, so a day's cache plus a week of stale-while-revalidate, not immutable.
    const ogCards = { source: '/og-:locale.png', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] }
    // Logo and icons (#211): fixed names, rarely changed, so a week fresh and then refreshed in the background.
    const brand = { source: '/brand/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=31536000' }] }
    if (process.env.SITE_ENV === 'production') return [privateFiles, ogCards, brand]
    return [privateFiles, ogCards, brand, { source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

const config = withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
const payloadHeaders = config.headers!
// Payload sends `Critical-CH: Sec-CH-Prefers-Color-Scheme` (its admin theme) on every path, which makes Chrome retry
// each first navigation to the public site with the hint: one extra round trip (~600 ms on mobile, #52). Admin only.
config.headers = async () =>
  (await payloadHeaders()).map((rule) => (rule.headers.some((h) => h.key === 'Critical-CH') ? { ...rule, source: '/admin/:path*' } : rule))

export default config
