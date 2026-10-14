import type { CollectionConfig } from 'payload'

// WebP only: sources are already WebP; AVIF would double storage and encode time (PLAN §3.3).
const widths = [320, 640, 960, 1280, 1920] as const

export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  fields: [
    { name: 'alt', type: 'text', localized: true },
    { name: 'category', type: 'relationship', relationTo: 'categories', index: true },
  ],
  upload: {
    mimeTypes: ['image/*'],
    focalPoint: true,
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: widths.map((w) => ({
      name: `w${w}`,
      width: w,
      withoutEnlargement: true,
      formatOptions: { format: 'webp' as const, options: { quality: 80 } },
    })),
  },
}
