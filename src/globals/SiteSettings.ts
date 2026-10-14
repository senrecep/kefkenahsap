import type { GlobalConfig } from 'payload'

import { isAdminField, isStaff } from '@/access'
import { validateHref } from '@/lib/http/safe-href'
import { revalidateGlobal } from '@/hooks/revalidate'

// Single source for NAP, founder facts, socials and WhatsApp templates (schema.org, footer, llms.txt read from here).
// Empty optional fields render nothing anywhere (PRODUCT.md: no invented claims).
export const SiteSettings: GlobalConfig = {
  slug: 'siteSettings',
  label: 'Site Bilgileri',
  admin: { group: 'Yönetim' },
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
                { name: 'craftStartYear', type: 'number', label: 'Mesleğe başlama yılı', admin: { description: 'Doğrulanmadan boş bırakın; boşsa "X yıllık" ifadesi kullanılmaz.' } },
                { name: 'bio', type: 'textarea', localized: true, label: 'Kısa biyografi' },
              ],
            },
            { name: 'teamSize', type: 'number', label: 'Ekip büyüklüğü' },
            { name: 'projectCount', type: 'number', label: 'Tamamlanan proje sayısı' },
          ],
        },
        {
          label: 'İletişim',
          fields: [
            {
              name: 'phones',
              type: 'array',
              label: 'Telefonlar',
              fields: [
                { name: 'label', type: 'text', localized: true, required: true },
                { name: 'number', type: 'text', required: true },
                { name: 'whatsapp', type: 'checkbox', label: 'WhatsApp numarası' },
              ],
            },
            { name: 'email', type: 'email', label: 'E-posta' },
            {
              name: 'address',
              type: 'group',
              label: 'Adres',
              fields: [
                { name: 'street', type: 'text' },
                { type: 'row', fields: [
                  { name: 'district', type: 'text' },
                  { name: 'city', type: 'text' },
                  { name: 'postalCode', type: 'text' },
                ] },
                { name: 'country', type: 'text', defaultValue: 'TR' },
                { type: 'row', fields: [{ name: 'lat', type: 'number' }, { name: 'lng', type: 'number' }] },
                { name: 'mapUrl', type: 'text', validate: validateHref, label: 'Yol tarifi linki (Google Maps)' },
              ],
            },
            {
              name: 'hours',
              type: 'array',
              label: 'Çalışma saatleri',
              fields: [
                { name: 'days', type: 'select', hasMany: true, required: true, options: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] },
                { type: 'row', fields: [{ name: 'opens', type: 'text', required: true }, { name: 'closes', type: 'text', required: true }] },
              ],
            },
            {
              name: 'areaServed',
              type: 'array',
              label: 'Hizmet bölgeleri',
              fields: [
                { name: 'name', type: 'text', localized: true, required: true },
                { name: 'kind', type: 'select', defaultValue: 'district', options: ['district', 'city', 'country'] },
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
              fields: ['default', 'category', 'project', 'image', 'contact'].map((name) => ({
                name,
                type: 'textarea' as const,
                localized: true,
              })),
            },
            { name: 'officeHoursNote', type: 'text', localized: true, label: 'Mesai dışı notu' },
          ],
        },
        {
          label: 'Sosyal & SEO',
          fields: [
            {
              name: 'social',
              type: 'group',
              fields: [
                { name: 'instagram', type: 'text', validate: validateHref },
                { name: 'facebook', type: 'text', validate: validateHref },
                { name: 'googleBusiness', type: 'text', validate: validateHref, label: 'Google İşletme Profili linki' },
              ],
            },
            { name: 'defaultDescription', type: 'textarea', localized: true, label: 'Varsayılan meta açıklama' },
            { name: 'defaultOgImage', type: 'upload', relationTo: 'media' },
            { name: 'gaId', type: 'text', label: 'GA4 ölçüm kimliği', access: { update: isAdminField } },
          ],
        },
      ],
    },
  ],
}
