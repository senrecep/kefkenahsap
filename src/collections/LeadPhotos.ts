import path from 'path'
import type { CollectionConfig } from 'payload'

import { isStaff } from '@/access'
import { LEAD_PHOTO_TYPES } from '@/lib/leads/validate'

// Customer photos are personal data: stored on a private server volume (never the public CDN bucket),
// served only through Payload's authenticated file route.
export const LeadPhotos: CollectionConfig = {
  slug: 'lead-photos',
  labels: { singular: 'Talep fotoğrafı', plural: 'Talep fotoğrafları' },
  admin: { hidden: true },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  upload: {
    staticDir: process.env.LEAD_PHOTOS_DIR || path.resolve(process.cwd(), 'data/lead-photos'),
    // No SVG (scriptable); originals re-encoded to WebP, which drops EXIF/GPS metadata.
    mimeTypes: LEAD_PHOTO_TYPES,
    formatOptions: { format: 'webp', options: { quality: 85 } },
    imageSizes: [{ name: 'thumb', width: 480, withoutEnlargement: true, formatOptions: { format: 'webp' } }],
    adminThumbnail: 'thumb',
  },
  fields: [],
}
