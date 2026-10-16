// The work categories: stable seed key, data-folder name (kefken-data/Webiste), TR/EN names and slugs.
// `key` names the seed media (seedKey prefix `<key>/<file>`, seed/media-meta/<key>/) and the legacy WP page; it never
// changes. TR slugs kept the old WordPress slugs, so legacy page redirects are a plain /<slug>/ → /tr/<slug>, except
// where a category was renamed later (CATEGORY_RENAMES). `folder: null`: a category added after launch, no seed photos.
export type SeedCategory = { key: string; folder: string | null; slug: { tr: string; en: string }; name: { tr: string; en: string } }

export const SEED_CATEGORIES: SeedCategory[] = [
  // #172: was "Ahşap Yapılar" (ahsap-yapilar / wooden-structures); same record, new name and slugs.
  { key: 'ahsap-yapilar', folder: 'Ahsap Yapilar', slug: { tr: 'sundurma-ve-ahsap-cati', en: 'porches-and-timber-roofs' }, name: { tr: 'Sundurma ve Ahşap Çatı', en: 'Porches and Timber Roofs' } },
  { key: 'deck-ve-zeminler', folder: 'Deck ve Zeminler', slug: { tr: 'deck-ve-zeminler', en: 'decking-and-flooring' }, name: { tr: 'Deck ve Zeminler', en: 'Decking and Flooring' } },
  { key: 'pergola-ve-kamelyalar', folder: 'Pergola ve Kamelyalar', slug: { tr: 'pergola-ve-kamelyalar', en: 'pergolas-and-gazebos' }, name: { tr: 'Pergola ve Kamelyalar', en: 'Pergolas and Gazebos' } },
  { key: 'korkuluk-ve-cit', folder: 'Korkuluk ve Cit', slug: { tr: 'korkuluk-ve-cit', en: 'railings-and-fences' }, name: { tr: 'Korkuluk ve Çit', en: 'Railings and Fences' } },
  { key: 'kopru-ve-iskele', folder: 'Kopru ve Iskele', slug: { tr: 'kopru-ve-iskele', en: 'bridges-and-piers' }, name: { tr: 'Köprü ve İskele', en: 'Bridges and Piers' } },
  { key: 'merdivenler', folder: 'Merdivenler', slug: { tr: 'merdivenler', en: 'stairs' }, name: { tr: 'Merdivenler', en: 'Stairs' } },
  { key: 'ciceklik-ve-oturma-grubu', folder: 'Ciceklik ve Oturma Grubu', slug: { tr: 'ciceklik-ve-oturma-grubu', en: 'planters-and-seating' }, name: { tr: 'Çiçeklik ve Oturma Grubu', en: 'Planters and Seating' } },
  { key: 'kapi-dolap-ve-seperator', folder: 'Kapi Dolap ve Seperator', slug: { tr: 'kapi-dolap-ve-seperator', en: 'doors-cabinets-and-partitions' }, name: { tr: 'Kapı, Dolap ve Seperatör', en: 'Doors, Cabinets and Partitions' } },
  { key: 'ireko-teak', folder: 'Ireko-Teak', slug: { tr: 'ireko-teak', en: 'iroko-and-teak' }, name: { tr: 'İroko ve Teak', en: 'Iroko and Teak' } },
  { key: 'mobilya-ve-cila', folder: 'Mobilya ve Cila', slug: { tr: 'mobilya-ve-cila', en: 'furniture-and-finishing' }, name: { tr: 'Mobilya ve Cila', en: 'Furniture and Finishing' } },
  { key: 'boya-tamir-ve-bakim', folder: 'Boya Tamir ve Bakim', slug: { tr: 'boya-tamir-ve-bakim', en: 'painting-repair-and-maintenance' }, name: { tr: 'Boya, Tamir ve Bakım', en: 'Painting, Repair and Maintenance' } },
  // #172: services added from the photo taxonomy (image-work/taxonomy). Photos come later from the photo loader.
  { key: 'bahce-kulubeleri', folder: null, slug: { tr: 'bahce-kulubeleri', en: 'garden-sheds-and-kennels' }, name: { tr: 'Bahçe ve Köpek Kulübeleri', en: 'Garden Sheds and Kennels' } },
  { key: 'ahsap-ev-ve-bungalov', folder: null, slug: { tr: 'ahsap-ev-ve-bungalov', en: 'wooden-houses-and-bungalows' }, name: { tr: 'Ahşap Ev ve Bungalov', en: 'Wooden Houses and Bungalows' } },
  { key: 'bahce-mobilyasi', folder: null, slug: { tr: 'bahce-mobilyasi', en: 'garden-furniture' }, name: { tr: 'Bahçe Mobilyası', en: 'Garden Furniture' } },
  { key: 'mutfak-ve-gomme-dolap', folder: null, slug: { tr: 'mutfak-ve-gomme-dolap', en: 'kitchens-and-built-in-cabinets' }, name: { tr: 'Mutfak ve Gömme Dolap', en: 'Kitchens and Built-in Cabinets' } },
  { key: 'lambri-ve-kaplama', folder: null, slug: { tr: 'lambri-ve-kaplama', en: 'panelling-and-cladding' }, name: { tr: 'Lambri ve Kaplama', en: 'Panelling and Cladding' } },
]

type Locale = 'tr' | 'en' | 'ru' | 'de' | 'ar'
export type CategoryRename = { key: string; from: Record<Locale, string>; to: Record<Locale, string> }

/**
 * Category slugs changed after they were public: every old localized path answers 301 to the new one
 * (src/lib/legacy/resolve.ts), and scripts/seed/categories-rename.ts moves an already-seeded record.
 * `to` must equal SEED_CATEGORIES and the seed/i18n overlays (checked in categories.test.ts).
 */
export const CATEGORY_RENAMES: CategoryRename[] = [
  {
    key: 'ahsap-yapilar',
    from: { tr: 'ahsap-yapilar', en: 'wooden-structures', ru: 'derevyannye-konstruktsii', de: 'holzbauten', ar: 'hayakil-khashabiya' },
    to: { tr: 'sundurma-ve-ahsap-cati', en: 'porches-and-timber-roofs', ru: 'navesy-i-derevyannye-kryshi', de: 'vordaecher-und-holzdaecher', ar: 'mazallat-wa-asquf-khashabiya' },
  },
]
