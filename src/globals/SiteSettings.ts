import type { GlobalConfig } from 'payload'

import { isAdminField, isStaff } from '@/access'
import { validateGaId } from '@/lib/analytics'
import { validateHref, validateHttpsUrl, validateMapEmbedUrl } from '@/lib/http/safe-href'
import { revalidateGlobal } from '@/hooks/revalidate'

// Single source for NAP, founder facts, socials and WhatsApp templates (schema.org, footer, llms.txt read from here).
// Empty optional fields render nothing anywhere (PRODUCT.md: no invented claims).
// #192: a field the site never shows is either labelled as AI-draft-only or hidden (admin.hidden keeps its column and data).
const AI_ONLY = 'Yalnızca AI taslakları için'
const AI_ONLY_NOTE = 'Sitede gösterilmez. "AI ile taslak" yazarken olgu olarak kullanılır; doğrulanmadan boş bırakın.'
export const SiteSettings: GlobalConfig = {
  slug: 'siteSettings',
  label: 'Site Bilgileri',
  admin: { group: 'Yönetim', hideAPIURL: true },
  hooks: { afterChange: [revalidateGlobal('site')] },
  access: { read: () => true, update: isStaff },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Şirket',
          fields: [
            { name: 'companyName', type: 'text', required: true, defaultValue: 'Kefken Ahşap Dekorasyon', label: 'Şirket adı' },
            { name: 'foundingYear', type: 'number', label: 'Kuruluş yılı', admin: { description: 'Doluysa "…’dan beri" yazılır.' } },
            {
              name: 'founder',
              type: 'group',
              label: 'Kurucu / usta',
              fields: [
                { name: 'name', type: 'text', label: 'Ad soyad' },
                { name: 'phone', type: 'text', label: 'Telefon' },
                { name: 'bio', type: 'textarea', localized: true, label: 'Kısa biyografi' },
                {
                  type: 'collapsible',
                  label: AI_ONLY,
                  fields: [{ name: 'craftStartYear', type: 'number', label: 'Mesleğe başlama yılı', admin: { description: AI_ONLY_NOTE } }],
                },
              ],
            },
            {
              type: 'collapsible',
              label: AI_ONLY,
              fields: [
                { name: 'teamSize', type: 'number', label: 'Ekip büyüklüğü', admin: { description: AI_ONLY_NOTE } },
                { name: 'projectCount', type: 'number', label: 'Tamamlanan proje sayısı', admin: { description: AI_ONLY_NOTE } },
              ],
            },
          ],
        },
        {
          label: 'İletişim',
          fields: [
            {
              name: 'phones',
              type: 'array',
              label: 'Telefonlar',
              labels: { singular: 'Telefon', plural: 'Telefonlar' },
              fields: [
                { name: 'label', type: 'text', localized: true, required: true, label: 'Ad (ör. Ofis, Usta)' },
                { name: 'number', type: 'text', required: true, label: 'Numara' },
                { name: 'whatsapp', type: 'checkbox', label: 'WhatsApp numarası' },
              ],
            },
            { name: 'email', type: 'email', label: 'E-posta' },
            {
              name: 'address',
              type: 'group',
              label: 'Adres',
              fields: [
                { name: 'street', type: 'text', label: 'Sokak / cadde, no' },
                { type: 'row', fields: [
                  { name: 'district', type: 'text', label: 'İlçe' },
                  { name: 'city', type: 'text', label: 'İl' },
                ] },
                { name: 'mapUrl', type: 'text', validate: validateHref, label: 'Yol tarifi linki (Google Maps)' },
                {
                  // Same columns as before (layout only); set once by the admin, so editors can't break the map or schema data.
                  type: 'collapsible',
                  label: 'Teknik (harita ve posta bilgileri)',
                  admin: { initCollapsed: true },
                  fields: [
                    { type: 'row', fields: [
                      { name: 'postalCode', type: 'text', label: 'Posta kodu', access: { update: isAdminField } },
                      { name: 'country', type: 'text', defaultValue: 'TR', label: 'Ülke kodu', access: { update: isAdminField } },
                    ] },
                    { type: 'row', fields: [
                      { name: 'lat', type: 'number', label: 'Enlem', access: { update: isAdminField } },
                      { name: 'lng', type: 'number', label: 'Boylam', access: { update: isAdminField } },
                    ] },
                    {
                      name: 'mapEmbedUrl',
                      type: 'text',
                      validate: validateMapEmbedUrl,
                      label: 'Harita gömme adresi (Google Maps)',
                      access: { update: isAdminField },
                      admin: { description: 'Google Haritalar → Paylaş → Harita yerleştirin: iframe kodundaki src="…" değeri. Ziyaretçi tıklayınca yüklenir.' },
                    },
                    { name: 'appleMapsUrl', type: 'text', validate: validateHref, label: 'Apple Haritalar linki', access: { update: isAdminField } },
                  ],
                },
              ],
            },
            {
              name: 'hours',
              type: 'array',
              label: 'Çalışma saatleri',
              labels: { singular: 'Saat aralığı', plural: 'Saat aralıkları' },
              fields: [
                {
                  name: 'days',
                  type: 'select',
                  hasMany: true,
                  required: true,
                  label: 'Günler',
                  // Values are schema.org day codes (opening hours JSON-LD); only the labels are Turkish.
                  options: [
                    { label: 'Pzt', value: 'Mo' },
                    { label: 'Sal', value: 'Tu' },
                    { label: 'Çar', value: 'We' },
                    { label: 'Per', value: 'Th' },
                    { label: 'Cum', value: 'Fr' },
                    { label: 'Cmt', value: 'Sa' },
                    { label: 'Paz', value: 'Su' },
                  ],
                },
                { type: 'row', fields: [
                  { name: 'opens', type: 'text', required: true, label: 'Açılış (ör. 09:00)' },
                  { name: 'closes', type: 'text', required: true, label: 'Kapanış (ör. 18:00)' },
                ] },
              ],
            },
            {
              name: 'areaServed',
              type: 'array',
              label: 'Hizmet bölgeleri',
              labels: { singular: 'Bölge', plural: 'Bölgeler' },
              fields: [
                { name: 'name', type: 'text', localized: true, required: true, label: 'Bölge adı' },
                {
                  name: 'kind',
                  type: 'select',
                  defaultValue: 'district',
                  label: 'Tür',
                  options: [
                    { label: 'İlçe', value: 'district' },
                    { label: 'İl', value: 'city' },
                    { label: 'Ülke', value: 'country' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'WhatsApp',
          fields: [
            { name: 'whatsappNumber', type: 'text', label: 'WhatsApp numarası' },
            {
              name: 'whatsappTemplates',
              type: 'group',
              label: 'Hazır mesajlar ({category}, {project}, {url} kullanılabilir)',
              fields: (
                [
                  ['default', 'Genel'],
                  ['category', 'Hizmet sayfası'],
                  ['project', 'Proje sayfası'],
                  ['image', 'Fotoğraf sayfası'],
                  ['contact', 'İletişim sayfası'],
                ] as const
              ).map(([name, label]) => ({ name, label, type: 'textarea' as const, localized: true })),
            },
            // Hidden (#192): nothing on the site reads it.
            { name: 'officeHoursNote', type: 'text', localized: true, label: 'Mesai dışı notu', admin: { hidden: true } },
          ],
        },
        {
          label: 'Sosyal & SEO',
          fields: [
            {
              name: 'social',
              type: 'group',
              label: 'Sosyal medya',
              fields: [
                { name: 'instagram', type: 'text', validate: validateHref, label: 'Instagram linki' },
                { name: 'facebook', type: 'text', validate: validateHref, label: 'Facebook linki' },
                { name: 'googleBusiness', type: 'text', validate: validateHref, label: 'Google İşletme Profili linki' },
                {
                  name: 'googleReview',
                  type: 'text',
                  validate: validateHttpsUrl,
                  label: 'Google yorum linki',
                  admin: { description: 'Google İşletme Profili\'ndeki "Yorum iste" bağlantısı. Doluysa footer\'da ve Referanslar sayfasında "Google\'da yorum bırakın" bağlantısı çıkar; boşsa hiçbir şey görünmez.' },
                },
              ],
            },
            { name: 'defaultDescription', type: 'textarea', localized: true, label: 'Varsayılan meta açıklama' },
            { name: 'defaultOgImage', type: 'upload', relationTo: 'media', label: 'Varsayılan paylaşım görseli (WhatsApp, Facebook)' },
            {
              name: 'gaId',
              type: 'text',
              label: 'GA4 ölçüm kimliği',
              validate: validateGaId,
              access: { update: isAdminField },
              admin: { description: 'Ör. G-S84WKG63MS. Boşsa sunucu ayarındaki kimlik kullanılır. Ziyaret ölçümü yalnızca çerez onayından sonra yüklenir; KVKK ve çerez metinleri buna göre yazılır.' },
            },
          ],
        },
      ],
    },
  ],
}
