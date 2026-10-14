/** Links staff can enter in the admin: site-relative paths or http(s) URLs only (no javascript:, data:, //host). */
export const isSafeHref = (href: string): boolean => /^\/(?!\/)/.test(href) || /^https?:\/\//i.test(href)

/** Payload field validator built on isSafeHref. */
export const validateHref = (value: unknown) =>
  value == null || value === '' || (typeof value === 'string' && isSafeHref(value)) || 'Yalnızca /… veya https://… adresleri'
