import { postgresAdapter } from '@payloadcms/db-postgres'
import { FixedToolbarFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { SystemDateTimeProvider } from 'tsentials/time'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
import { Projects } from './collections/Projects'
import { References } from './collections/References'
import { Pages } from './collections/Pages'
import { Guides } from './collections/Guides'
import { Regions } from './collections/Regions'
import { Leads } from './collections/Leads'
import { LeadPhotos } from './collections/LeadPhotos'
import { EmailTemplates } from './collections/EmailTemplates'
import { OutgoingEmails } from './collections/OutgoingEmails'
import { purgeExpiredLeads } from './jobs/purgeExpiredLeads'
import { tagImageTask } from './jobs/tagImage'
import { releaseStuckMediaJobs } from './jobs/releaseStuck'
import { translateMediaTask } from './jobs/translateMedia'
import { seoRenameTask } from './jobs/seoRename'
import { SEO_RENAME_QUEUE } from './lib/media/seoName'
import { AiUsage } from './collections/AiUsage'
import { AiSettings } from './globals/AiSettings'
import { isFakeAi } from './ai/models'
import { aiDraftEndpoint, aiTranslateEndpoint, aiTagMediaEndpoint, aiTranslateMediaEndpoint } from './endpoints/ai'
import { resendAdapter } from '@payloadcms/email-resend'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { hiddenFromEditor, isStaff } from './access'
import { SiteSettings } from './globals/SiteSettings'
import { Homepage } from './globals/Homepage'
import { Navigation } from './globals/Navigation'
import { s3Storage } from '@payloadcms/storage-s3'
import { mediaFileURL } from './lib/media/url'
import { tr } from '@payloadcms/translations/languages/tr'
import { localeDir, routing } from './i18n/routing'
import { migrations } from './migrations'

for (const key of ['PAYLOAD_SECRET', 'DATABASE_URL', 'MEDIA_PUBLIC_URL'])
  if (!process.env[key]) throw new Error(`${key} is not set`)

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    dateFormat: 'd MMMM yyyy HH:mm',
    // #27: installable admin. Manifest is static (public/admin.webmanifest, scope /admin); no service worker (see PR).
    meta: {
      titleSuffix: '- Kefken Ahşap',
      icons: [
        { rel: 'icon', type: 'image/png', url: '/icon.png' },
        { rel: 'apple-touch-icon', url: '/brand/apple-touch-icon.png' },
      ],
      manifest: '/admin.webmanifest',
      other: { 'apple-mobile-web-app-capable': 'yes', 'mobile-web-app-capable': 'yes', 'theme-color': '#0b7a3e' },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: { Logo: '/components/admin/Brand#Logo', Icon: '/components/admin/Brand#Icon' },
      beforeDashboard: ['/components/admin/EditorHome#EditorHome'],
      beforeNavLinks: ['/components/admin/GaleriNavLink#GaleriNavLink'],
      views: {
        galeri: { Component: '/components/admin/GaleriView#GaleriView', path: '/galeri' },
      },
    },
  },
  // CSRF: in a deployed image (SITE_ENV) the auth cookie is accepted only from the site's own origin.
  // Local dev and CI run on varying ports, so no list there (SameSite=Lax cookie + JSON-only AI endpoints still apply).
  csrf: process.env.SITE_ENV && process.env.NEXT_PUBLIC_SITE_URL ? [new URL(process.env.NEXT_PUBLIC_SITE_URL).origin] : [],
  // Nothing uses GraphQL (the site reads through the Local API); off, scanners get a 404 and the duplicate-type schema build never runs.
  graphQL: { disable: true },
  collections: [Users, Media, Categories, Tags, Projects, References, Pages, Guides, Regions, Leads, LeadPhotos, OutgoingEmails, EmailTemplates, AiUsage],
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
          // `ai` lets the e2e setup refuse to run against a server that would call OpenRouter.
          return Response.json({ ok: true, ai: isFakeAi() ? 'fake' : 'live' })
        } catch {
          return Response.json({ ok: false }, { status: 503 })
        }
      },
    },
    aiTranslateEndpoint,
    aiTranslateMediaEndpoint,
    aiTagMediaEndpoint,
    aiDraftEndpoint,
  ],
  // The admin is Turkish only (one editor, one language); content localization below is separate.
  i18n: {
    supportedLanguages: { tr },
    fallbackLanguage: 'tr',
    // Payload's own Turkish for the per-language publish button reads as machine translation.
    translations: {
      tr: {
        version: { publishIn: 'Yayınla: {{locale}}', publishAllLocales: 'Tüm dilleri yayınla' },
        // The redirects plugin ships no Turkish.
        'plugin-redirects': {
          customUrl: 'Adres (URL)',
          documentToRedirect: 'Yönlendirilecek sayfa',
          fromUrl: 'Eski adres',
          internalLink: 'Sitedeki bir sayfa',
          redirectType: 'Yönlendirme türü',
          toUrlType: 'Hedef türü',
        },
      },
    },
  },
  localization: {
    // rtl: Arabic fields are edited right-to-left in the admin.
    // Short codes keep the header's language switcher narrow on a phone; panels spell the names out (src/i18n/localeNames).
    locales: routing.locales.map((code) => ({ code, label: code.toUpperCase(), rtl: localeDir(code) === 'rtl' })),
    defaultLocale: routing.defaultLocale,
    fallback: false,
    // #158: "Yayınla" publishes only the language on screen; "Tüm dilleri yayınla" is in its menu. An AI translation
    // saved as a draft therefore never goes live with a Turkish edit (tests/int/publish-locale.int.spec.ts).
    // Shared (non-localized) fields — photos, categories, künye numbers — go live with any one-language publish.
    // The Homepage global always publishes every language (see its beforeOperation hook).
    defaultLocalePublishOption: 'active',
  },
  // #203: photo jobs left "processing" by a process that died would block their photo forever (concurrency key).
  onInit: async (payload) => {
    const released = await releaseStuckMediaJobs(payload, SystemDateTimeProvider).catch((err: unknown) => {
      payload.logger.warn({ err }, 'jobs: could not release stuck photo jobs')
      return 0
    })
    if (released) payload.logger.warn(`jobs: released ${released} stuck photo job(s)`)
  },
  jobs: {
    tasks: [purgeExpiredLeads, tagImageTask, translateMediaTask, seoRenameTask],
    // Runs queued jobs (AI tagging, retention, purge) every minute; tasks are added per feature.
    // seoRename has its own queue (SEO_RENAME_QUEUE): after a bulk approve its jobs would otherwise fill the default queue's
    // 10-per-run limit and delay translations and tagging. The per-photo concurrency key is not queue-scoped, so a photo's
    // jobs still never run together. The default queue's limit is raised for the same reason (many uploads queue tagImage).
    autoRun: [
      { cron: '* * * * *', queue: 'default', limit: 50 },
      { cron: '* * * * *', queue: SEO_RENAME_QUEUE, limit: 50 },
    ],
    // tagImage + translateMedia: one job per photo at a time (adds payload_jobs.concurrency_key).
    enableConcurrencyControl: true,
    // Never under Vitest: tests run the queue themselves, and a cron tick between a test's queue() and run() took the job
    // away from it (flaky ai-tag int test, #192).
    shouldAutoRun: () => process.env.NODE_ENV !== 'test',
  },
  // Fixed toolbar: the floating one only appears on text selection, which is hard on a phone.
  editor: lexicalEditor({ features: ({ defaultFeatures }) => [...defaultFeatures, FixedToolbarFeature()] }),
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
      // Same values (same enum), Turkish labels.
      redirectTypeFieldOverride: { options: [{ label: '301 - Kalıcı', value: '301' }, { label: '302 - Geçici', value: '302' }] },
      overrides: {
        labels: { singular: 'Yönlendirme', plural: 'Yönlendirmeler' },
        admin: { group: 'Yönetim', hidden: hiddenFromEditor, useAsTitle: 'from', listSearchableFields: ['from'], hideAPIURL: true },
        access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
      },
    }),
    s3Storage({
      collections: {
        media: {
          // Optional key prefix per environment (e.g. "dev") when environments share one bucket.
          // Always defined ("" when unset) so the media.prefix column exists in every environment and one schema fits all.
          prefix: process.env.S3_PREFIX ?? '',
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename, prefix }) => mediaFileURL(filename, prefix),
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
