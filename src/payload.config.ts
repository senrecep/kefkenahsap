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
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Categories, Tags],
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
    tasks: [],
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
  plugins: [
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
