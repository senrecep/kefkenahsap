// The 11 work categories: data-folder name (kefken-data/Webiste), legacy WP slug, TR/EN names and slugs.
// TR slugs keep the old WordPress slugs so legacy page redirects are a plain /<slug>/ → /tr/<slug>.
export type SeedCategory = { folder: string; slug: { tr: string; en: string }; name: { tr: string; en: string } }

export const SEED_CATEGORIES: SeedCategory[] = [
  { folder: 'Ahsap Yapilar', slug: { tr: 'ahsap-yapilar', en: 'wooden-structures' }, name: { tr: 'Ahşap Yapılar', en: 'Wooden Structures' } },
  { folder: 'Deck ve Zeminler', slug: { tr: 'deck-ve-zeminler', en: 'decking-and-flooring' }, name: { tr: 'Deck ve Zeminler', en: 'Decking and Flooring' } },
  { folder: 'Pergola ve Kamelyalar', slug: { tr: 'pergola-ve-kamelyalar', en: 'pergolas-and-gazebos' }, name: { tr: 'Pergola ve Kamelyalar', en: 'Pergolas and Gazebos' } },
  { folder: 'Korkuluk ve Cit', slug: { tr: 'korkuluk-ve-cit', en: 'railings-and-fences' }, name: { tr: 'Korkuluk ve Çit', en: 'Railings and Fences' } },
  { folder: 'Kopru ve Iskele', slug: { tr: 'kopru-ve-iskele', en: 'bridges-and-piers' }, name: { tr: 'Köprü ve İskele', en: 'Bridges and Piers' } },
  { folder: 'Merdivenler', slug: { tr: 'merdivenler', en: 'stairs' }, name: { tr: 'Merdivenler', en: 'Stairs' } },
  { folder: 'Ciceklik ve Oturma Grubu', slug: { tr: 'ciceklik-ve-oturma-grubu', en: 'planters-and-seating' }, name: { tr: 'Çiçeklik ve Oturma Grubu', en: 'Planters and Seating' } },
  { folder: 'Kapi Dolap ve Seperator', slug: { tr: 'kapi-dolap-ve-seperator', en: 'doors-cabinets-and-partitions' }, name: { tr: 'Kapı, Dolap ve Seperatör', en: 'Doors, Cabinets and Partitions' } },
  { folder: 'Ireko-Teak', slug: { tr: 'ireko-teak', en: 'iroko-and-teak' }, name: { tr: 'İroko ve Teak', en: 'Iroko and Teak' } },
  { folder: 'Mobilya ve Cila', slug: { tr: 'mobilya-ve-cila', en: 'furniture-and-finishing' }, name: { tr: 'Mobilya ve Cila', en: 'Furniture and Finishing' } },
  { folder: 'Boya Tamir ve Bakim', slug: { tr: 'boya-tamir-ve-bakim', en: 'painting-repair-and-maintenance' }, name: { tr: 'Boya, Tamir ve Bakım', en: 'Painting, Repair and Maintenance' } },
]
