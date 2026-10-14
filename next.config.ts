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
    if (process.env.SITE_ENV === 'production') return [privateFiles]
    return [privateFiles, { source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
