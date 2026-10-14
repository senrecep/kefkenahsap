import type { Access, FieldAccess, Where } from 'payload'

type Role = 'admin' | 'editor'
export const roleOf = (user: unknown): Role | undefined => (user as { role?: Role } | null)?.role

export const isAdmin: Access = ({ req }) => roleOf(req.user) === 'admin'
export const isAdminField: FieldAccess = ({ req }) => roleOf(req.user) === 'admin'
export const isStaff: Access = ({ req }) => Boolean(roleOf(req.user))

/** Staff see everything; the public only sees published (drafts-enabled) documents. */
export const publishedOrStaff: Access = ({ req }) =>
  roleOf(req.user) ? true : ({ _status: { equals: 'published' } } satisfies Where)

/** Staff see everything; the public only sees approved media. */
export const approvedOrStaff: Access = ({ req }) =>
  roleOf(req.user) ? true : ({ status: { equals: 'approved' } } satisfies Where)

export const adminOrSelf: Access = ({ req }) =>
  roleOf(req.user) === 'admin' ? true : req.user ? ({ id: { equals: req.user.id } } satisfies Where) : false

/** `admin.hidden` for collections/globals only admins should see in the nav. Hides the UI only; access control is unchanged. */
export const hiddenFromEditor = ({ user }: { user?: unknown }) => roleOf(user) !== 'admin'
