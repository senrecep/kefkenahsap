/** Links staff can enter in the admin: site-relative paths or http(s) URLs only (no javascript:, data:, //host). */
export const isSafeHref = (href: string): boolean => /^\/(?!\/)/.test(href) || /^https?:\/\//i.test(href)

/** Payload field validator built on isSafeHref. */
export const validateHref = (value: unknown) =>
  value == null || value === '' || (typeof value === 'string' && isSafeHref(value)) || 'Yalnızca /… veya https://… adresleri'

/** An outside link that must be an absolute https URL (e.g. the Google review link, #229). */
export const validateHttpsUrl = (value: unknown) =>
  value == null || value === '' || (typeof value === 'string' && /^https:\/\/[^/\s]+\.[^/\s]+/i.test(value)) || 'Yalnızca https:// ile başlayan tam bir adres girin (Google İşletme Profili → Yorum iste → bağlantıyı kopyala).'

/** The only iframe source the site renders (#143): a Google Maps embed URL from the share dialog. */
export const isMapEmbedUrl = (src: unknown): src is string => typeof src === 'string' && src.startsWith('https://www.google.com/maps/embed?')

export const validateMapEmbedUrl = (value: unknown) =>
  value == null || value === '' || isMapEmbedUrl(value) || 'Yalnızca https://www.google.com/maps/embed?… adresleri (Google Haritalar → Paylaş → Harita yerleştirin)'
