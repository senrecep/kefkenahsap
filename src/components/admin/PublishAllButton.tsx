'use client'

import {
  FormSubmit,
  useConfig,
  useDocumentInfo,
  useForm,
  useFormModified,
  useLocale,
} from '@payloadcms/ui'

/**
 * Homepage publish button (#158): always every language. Sections are shared rows with per-language text, and Payload's
 * one-language publish merges rows by position (the Homepage hook strips it anyway); this button says what really happens.
 */
export function PublishAllButton() {
  const {
    globalSlug,
    hasPublishPermission,
    hasPublishedDoc,
    unpublishedVersionCount,
    setHasPublishedDoc,
    setUnpublishedVersionCount,
    setMostRecentVersionIsAutosaved,
  } = useDocumentInfo()
  const { submit } = useForm()
  const modified = useFormModified()
  const { code } = useLocale()
  const { config } = useConfig()

  if (!hasPublishPermission || !globalSlug) return null
  const canPublish = modified || unpublishedVersionCount > 0 || !hasPublishedDoc

  async function publish() {
    const result = await submit({
      action: `${config.routes.api}/globals/${globalSlug}?depth=0&locale=${code}`,
      overrides: { _status: 'published' },
    })
    if (result) {
      setUnpublishedVersionCount(0)
      setMostRecentVersionIsAutosaved(false)
      setHasPublishedDoc(true)
    }
  }

  return (
    <FormSubmit
      buttonId="action-save"
      disabled={!canPublish}
      onClick={publish}
      size="medium"
      type="button"
    >
      Tüm dilleri yayınla
    </FormSubmit>
  )
}
