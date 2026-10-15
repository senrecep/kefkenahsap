'use client'

import { useConfig, useDocumentInfo, useLocale } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

import { localeName } from '@/i18n/localeNames'
import { type LocaleState, localeStates } from '@/lib/i18n/localeStatus'
import './ai.css'

const STATE_TEXT: Record<LocaleState, string> = {
  live: 'Yayında',
  changed: 'Yayında, yayınlanmamış değişiklik var',
  draft: 'Taslak, yayında değil',
  empty: 'Boş',
}

/** "Diller" panel (#158): which languages of this record are live, drafted (e.g. by "AI ile çevir") or empty. */
export function LocaleStatus() {
  const { id, collectionSlug, lastUpdateTime } = useDocumentInfo()
  const { config, getEntityConfig } = useConfig()
  const active = useLocale()
  const [rows, setRows] = useState<{ locale: string; state: LocaleState }[] | null>(null)
  const [failed, setFailed] = useState(false)

  const locales = config.localization ? config.localization.locales : []
  const titleKey = (collectionSlug && getEntityConfig({ collectionSlug })?.admin?.useAsTitle) || 'title'

  useEffect(() => {
    if (!id || !collectionSlug) return
    // Whole documents (depth 0): "changed" compares every per-language value of the draft with the published one.
    const q = new URLSearchParams({ locale: 'all', depth: '0' })
    const get = (draft: boolean) =>
      fetch(`/api/${collectionSlug}/${id}?${q}${draft ? '&draft=true' : ''}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : Promise.reject()))
    Promise.all([get(true), get(false)])
      .then(([draft, published]) => {
        setRows(localeStates({ locales: locales.map((l) => l.code), titleKey, draft, published }))
        setFailed(false)
      })
      .catch(() => setFailed(true))
    // lastUpdateTime: refresh after every save/publish.
  }, [id, collectionSlug, titleKey, lastUpdateTime]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!id) return null

  return (
    <section className="locale-status" aria-labelledby="locale-status-title">
      <h3 id="locale-status-title" className="locale-status__title">
        Diller
      </h3>
      {failed ? (
        <p className="ai-action__hint">Dil durumu alınamadı. Sayfayı yenileyin.</p>
      ) : (
        <ul className="locale-status__list" aria-busy={!rows}>
          {(rows ?? locales.map((l) => ({ locale: l.code, state: null }))).map((r) => (
            <li key={r.locale} className="locale-status__item" data-state={r.state ?? 'loading'} aria-current={r.locale === active.code ? 'true' : undefined}>
              <span className="locale-status__name">
                {localeName(r.locale)}
                {r.locale === active.code && <span className="locale-status__here"> · ekrandaki</span>}
              </span>
              <span className="locale-status__state">{r.state ? STATE_TEXT[r.state] : '…'}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="locale-status__note">
        <strong>Yayınla yalnızca ekrandaki dili yayınlar: {localeName(active.code)} ({active.code.toUpperCase()}).</strong> Taslak bir dili önce okuyun; sonra üstteki dil
        seçiciden o dile geçip Yayınla’ya basın. Fotoğraflar, kategoriler ve diğer dil dışı alanlar tüm dillerde birlikte yayınlanır.
      </p>
    </section>
  )
}
