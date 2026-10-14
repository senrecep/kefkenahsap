import { getPayload as getPayloadBase } from 'payload'

import config from '@payload-config'

export const getPayload = () => getPayloadBase({ config })

/** Cache tags shared by data loaders and Payload revalidation hooks. */
export const TAGS = {
  site: 'site',
  categories: 'categories',
  media: 'media',
  projects: 'projects',
  pages: 'pages',
  guides: 'guides',
  references: 'references',
  tags: 'tags',
  homepage: 'homepage',
} as const
