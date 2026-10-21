import {
  BlocksFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import type { Block } from 'payload'

import { buttonUrl } from '@/lib/email/outgoing'

/** #256: a call-to-action button in an e-mail (rendered by `src/lib/email/outgoing.ts`). */
export const EmailButton: Block = {
  slug: 'button',
  labels: { singular: 'Buton', plural: 'Butonlar' },
  fields: [
    { name: 'label', type: 'text', required: true, label: 'Buton yazısı' },
    {
      name: 'url',
      type: 'text',
      required: true,
      label: 'Adres',
      admin: { description: 'https://, mailto: ya da tel: ile tam adres.' },
      validate: (value: unknown) => buttonUrl(value),
    },
    {
      name: 'style',
      type: 'select',
      required: true,
      defaultValue: 'dolu',
      label: 'Görünüm',
      options: [
        { label: 'Dolu', value: 'dolu' },
        { label: 'Çerçeveli', value: 'cerceveli' },
      ],
    },
  ],
}

/** Body editor of outgoing e-mails and their templates (#254, #256): only what the e-mail renderer can show. */
export const emailBodyEditor = lexicalEditor({
  features: () => [
    ParagraphFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    UnorderedListFeature(),
    OrderedListFeature(),
    // No internal links: an e-mail needs a full address (https://, mailto:, tel:).
    LinkFeature({ enabledCollections: [] }),
    BlocksFeature({ blocks: [EmailButton] }),
    FixedToolbarFeature(),
  ],
})
