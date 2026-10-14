import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
import { Projects } from './collections/Projects'
import { References } from './collections/References'
import { Pages } from './collections/Pages'
import { Leads } from './collections/Leads'
import { LeadPhotos } from './collections/LeadPhotos'
import { purgeExpiredLeads } from './jobs/purgeExpiredLeads'
import { tagImageTask } from './jobs/tagImage'
import { AiUsage } from './collections/AiUsage'
import { AiSettings } from './globals/AiSettings'
import { resendAdapter } from '@payloadcms/email-resend'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { hiddenFromEditor, isStaff } from './access'
import { SiteSettings } from './globals/SiteSettings'
import { Homepage } from './globals/Homepage'
import { Navigation } from './globals/Navigation'
import { s3Storage } from '@payloadcms/storage-s3'
import { tr } from '@payloadcms/translations/languages/tr'
import { en } from '@payloadcms/translations/languages/en'
import { ar } from '@payloadcms/translations/languages/ar'
import { routing } from './i18n/routing'
import { migrations } from './migrations'

for (const key of ['PAYLOAD_SECRET', 'DATABASE_URL', 'MEDIA_PUBLIC_URL'])
  if (!process.env[key]) throw new Error(`${key} is not set`)

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    // #27: installable admin. Manifest is static (public/admin.webmanifest, scope /admin); no service worker (see PR).
    meta: {
      titleSuffix: '- Kefken Ahşap',
      icons: [
        { rel: 'icon', type: 'image/png', url: '/brand/pwa-192.png' },
        { rel: 'apple-touch-icon', url: '/brand/apple-touch-icon.png' },
      ],
      manifest: '/admin.webmanifest',
      other: { 'apple-mobile-web-app-capable': 'yes', 'mobile-web-app-capable': 'yes', 'theme-color': '#0b7a3e' },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      beforeNavLinks: ['/components/admin/GaleriNavLink#GaleriNavLink'],
      views: {
        galeri: { Component: '/components/admin/GaleriView#GaleriView', path: '/galeri' },
      },
    },
  },
  collections: [Users, Media, Categories, Tags, Projects, References, Pages, Leads, LeadPhotos, AiUsage],
  // Real e-mail only outside tests; without a key Payload logs e-mails to the console.
  email:
    process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'test'
      ? resendAdapter({
          apiKey: process.env.RESEND_API_KEY,
          defaultFromAddress: 'bildirim@kefkenahsap.com',
          defaultFromName: 'Kefken Ahşap',
        })
      : undefined,
  globals: [SiteSettings, Homepage, Navigation, AiSettings],
  endpoints: [
    {
      // Liveness + DB reachability for the container healthcheck.
      path: '/health',
      method: 'get',
      handler: async ({ payload }) => {
        try {
          await payload.count({ collection: 'users' })
          return Response.json({ ok: true })
        } catch {
          return Response.json({ ok: false }, { status: 503 })
        }
      },
    },
  ],
  i18n: { supportedLanguages: { tr, en, ar }, fallbackLanguage: 'tr' },
  localization: {
    locales: [...routing.locales],
    defaultLocale: routing.defaultLocale,
    fallback: false,
  },
  jobs: {
    tasks: [purgeExpiredLeads, tagImageTask],
    // Runs queued jobs (AI tagging, retention, purge) every minute; tasks are added per feature.
    autoRun: [{ cron: '* * * * *', queue: 'default' }],
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET as string, // checked at module load above
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // Schema changes only through migrations (src/migrations): push prompts block CI and are unsafe in prod.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
    prodMigrations: migrations,
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  upload: { limits: { fileSize: 25 * 1024 * 1024 } }, // lead photos are additionally capped at 10 MB by the form (#41)
  plugins: [
    // Manual redirects managed in the admin (old WP pages/attachments and future URL changes).
    // Bulk WP media redirects live in a JSON map (#32), not here.
    redirectsPlugin({
      collections: ['pages', 'categories', 'projects'],
      redirectTypes: ['301', '302'],
      overrides: {
        admin: { group: 'Yönetim', hidden: hiddenFromEditor },
        access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
      },
    }),
    s3Storage({
      collections: {
        media: {
          // Optional key prefix per environment (e.g. "dev") when environments share one bucket.
          prefix: process.env.S3_PREFIX || undefined,
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename, prefix }) =>
            [process.env.MEDIA_PUBLIC_URL, prefix, filename].filter(Boolean).join('/'),
        },
      },
      bucket: process.env.S3_BUCKET || '',
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'auto',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  ],
})
