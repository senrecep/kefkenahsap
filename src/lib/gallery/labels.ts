// Gallery UI strings resolved on the server (GalleryGrid) and passed down, so no i18n runtime ships to the client.
export const GALLERY_LABELS = ['more', 'loading', 'retry', 'loadFailed', 'lightbox', 'counter', 'close', 'prev', 'next', 'openPage'] as const
export type GalleryLabels = Record<(typeof GALLERY_LABELS)[number], string>
