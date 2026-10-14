import { type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { publicError } from '@/lib/http/public-error'

import { adminOrSelf, hiddenFromEditor, isAdmin, isAdminField } from '@/access'

/** First account (created without a logged-in user, i.e. first-register) is the owner → admin. */
const firstUserIsAdmin: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation === 'create' && !req.user) {
    const { totalDocs } = await req.payload.count({ collection: 'users', req })
    if (totalDocs === 0) return { ...data, role: 'admin' }
  }
  return data
}

/** Never leave the site without an admin. */
export const canDemoteAdmin = (adminCount: number) => adminCount > 1

const keepOneAdmin: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (operation !== 'update' || originalDoc?.role !== 'admin' || data.role === undefined || data.role === 'admin') return data
  const { totalDocs } = await req.payload.count({ collection: 'users', where: { role: { equals: 'admin' } }, req })
  if (!canDemoteAdmin(totalDocs)) throw publicError('Son yönetici hesabının rolü değiştirilemez.', 'role')
  return data
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: { hidden: hiddenFromEditor, useAsTitle: 'name', defaultColumns: ['name', 'email', 'role'], group: 'Yönetim' },
  auth: { maxLoginAttempts: 8, lockTime: 15 * 60 * 1000 },
  hooks: { beforeChange: [firstUserIsAdmin, keepOneAdmin] },
  access: {
    admin: ({ req }) => Boolean(req.user),
    read: adminOrSelf,
    create: isAdmin,
    update: adminOrSelf,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', label: 'Ad Soyad' },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'editor',
      saveToJWT: true,
      // Editors cannot promote themselves.
      access: { update: isAdminField, create: isAdminField },
      options: [
        { label: 'Yönetici', value: 'admin' },
        { label: 'Editör', value: 'editor' },
      ],
    },
  ],
}
