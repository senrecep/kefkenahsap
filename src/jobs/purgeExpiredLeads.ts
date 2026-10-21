import type { TaskConfig } from 'payload'
import { SystemDateTimeProvider } from 'tsentials/time'

/** Daily KVKK retention: deletes leads past `retentionUntil` with their photos and the e-mails written to them, and expired outgoing e-mails (#254). */
export const purgeExpiredLeads: TaskConfig<'purgeExpiredLeads'> = {
  slug: 'purgeExpiredLeads',
  schedule: [{ cron: '0 3 * * *', queue: 'default' }],
  outputSchema: [{ name: 'deleted', type: 'number' }, { name: 'deletedEmails', type: 'number' }],
  handler: async ({ req }) => {
    const now = SystemDateTimeProvider.utcNow().toISOString()
    const expired = await req.payload.find({
      collection: 'leads',
      where: { retentionUntil: { less_than: now } },
      depth: 0,
      limit: 500,
      pagination: false,
      req,
    })
    let deleted = 0
    for (const lead of expired.docs) {
      const photoIds = (lead.photos ?? []).map((p) => (typeof p === 'object' ? p.id : p))
      try {
        // #254: replies written to this lead hold its address too; they go with it.
        await req.payload.delete({ collection: 'outgoing-emails', where: { lead: { equals: lead.id } }, req })
        // Lead first: a half-finished run never leaves a lead pointing at deleted photos.
        await req.payload.delete({ collection: 'leads', id: lead.id, req })
        if (photoIds.length) await req.payload.delete({ collection: 'lead-photos', where: { id: { in: photoIds } }, req })
        deleted++
      } catch (err) {
        req.payload.logger.error({ err, lead: lead.id }, 'purgeExpiredLeads: failed for one lead, continuing')
      }
    }
    const emails = await req.payload.delete({ collection: 'outgoing-emails', where: { retentionUntil: { less_than: now } }, depth: 0, req })
    for (const e of emails.errors) req.payload.logger.error({ id: e.id, msg: `purgeExpiredLeads: outgoing e-mail not deleted: ${e.message}` })
    return { output: { deleted, deletedEmails: emails.docs.length } }
  },
}
