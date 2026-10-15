/** Public CDN URL of a stored media object. Media is served straight from the CDN, never through /api/media/file. */
export const mediaFileURL = (filename: string, prefix?: string | null): string =>
  [process.env.MEDIA_PUBLIC_URL, prefix, filename].filter(Boolean).join('/')
