import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { s3Storage } from '@payloadcms/storage-s3'
import { tr } from '@payloadcms/translations/languages/tr'
import { en } from '@payloadcms/translations/languages/en'
import { ar } from '@payloadcms/translations/languages/ar'
import { routing } from './i18n/routing'
import { migrations } from './migrations'

if (!process.env.PAYLOAD_SECRET) throw new Error('PAYLOAD_SECRET is not set')

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Categories],
  endpoints: [{ path: '/health', method: 'get', handler: () => Response.json({ ok: true }) }],
  i18n: { supportedLanguages: { tr, en, ar }, fallbackLanguage: 'tr' },
  localization: {
    locales: [...routing.locales],
    defaultLocale: routing.defaultLocale,
    fallback: false,
  },
  jobs: {
    tasks: [
      {
        slug: 'heartbeat',
        schedule: [{ cron: '* * * * *', queue: 'default' }],
        handler: async ({ req }) => {
          req.payload.logger.info('jobs heartbeat')
          return { output: {} }
        },
      },
    ],
    autoRun: [{ cron: '* * * * *', queue: 'default' }],
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET,
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
