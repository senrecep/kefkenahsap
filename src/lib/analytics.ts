const GA4_ID = /^G-[A-Z0-9]{4,20}$/

/**
 * #192: the GA4 measurement id: Site Bilgileri's `gaId` when it holds one, else the build-time env. The one answer for the
 * GA loader, the footer "Çerez tercihleri" button and the KVKK/cookie texts (#156), so they never disagree.
 */
export function gaIdOf(settings: { gaId?: string | null }, env: string | undefined = process.env.NEXT_PUBLIC_GA_ID): string | undefined {
  const id = settings.gaId?.trim()
  return (id && GA4_ID.test(id) ? id : env) || undefined
}

export const validateGaId = (value: string | null | undefined): true | string =>
  !value?.trim() || GA4_ID.test(value.trim()) || 'GA4 ölçüm kimliği "G-" ile başlar, ör. G-S84WKG63MS.'
