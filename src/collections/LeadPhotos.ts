import path from 'path'
import type { CollectionConfig } from 'payload'

import { isStaff } from '@/access'

// Customer photos are personal data: stored on a private server volume (never the public CDN bucket),
// served only through Payload's authenticated file route.
export const LeadPhotos: CollectionConfig = {
  slug: 'lead-photos',
  labels: { singular: 'Talep fotoğrafı', plural: 'Talep fotoğrafları' },
  admin: { hidden: true },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  upload: {
    staticDir: process.env.LEAD_PHOTOS_DIR || path.resolve(process.cwd(), 'data/lead-photos'),
    mimeTypes: ['image/*'],
    imageSizes: [{ name: 'thumb', width: 480, withoutEnlargement: true, formatOptions: { format: 'webp' } }],
    adminThumbnail: 'thumb',
  },
  fields: [],
}
