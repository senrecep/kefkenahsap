import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Endpoint, PayloadRequest } from 'payload'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider } from 'tsentials/time'

import { roleOf } from '@/access'
import { positiveId } from '@/ai/guard'
import { outgoingEmail, recipient } from '@/lib/email/outgoing'
import type { OutgoingEmail } from '@/payload-types'

export const FROM = 'Kefken Ahşap Dekorasyon <info@kefkenahsap.com>'
export const REPLY_TO = 'info@kefkenahsap.com'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const fail = (status: number, message: string) => Response.json({ message }, { status, headers: NO_STORE })

/** Staff check + the document; a Response when the request stops here. */
async function load(req: PayloadRequest): Promise<OutgoingEmail | Response> {
  if (!req.user) return fail(401, 'Bu işlem için yönetim paneline giriş yapın.')
  if (!roleOf(req.user)) return fail(403, 'Bu işlem için yetkiniz yok.')
  const id = positiveId(req.routeParams?.id)
  const doc = id === undefined ? null : await req.payload.findByID({ collection: 'outgoing-emails', id, depth: 0, disableErrors: true, req })
  return doc ?? fail(404, 'E-posta bulunamadı; silinmiş olabilir.')
}

async function render(req: PayloadRequest, doc: OutgoingEmail) {
  const s = await req.payload.findGlobal({ slug: 'siteSettings', locale: 'tr', depth: 0, req })
  return outgoingEmail({
    subject: doc.subject,
    body: doc.body as never,
    signature: { name: s.founder?.name, company: s.companyName, phones: s.phones, email: s.email },
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '',
  })
}

/**
 * POST /api/outgoing-emails/:id/send (#254), staff only. Sends a saved draft once: the draft → sent switch is a single
 * conditional UPDATE, so a double click or two tabs can never send it twice. A failed send is stored as "Hata" with the reason.
 */
export const outgoingEmailSendEndpoint: Endpoint = {
  path: '/:id/send',
  method: 'post',
  handler: async (req) => {
    const doc = await load(req)
    if (doc instanceof Response) return doc
    // Without Resend, Payload's fallback mailer would print the whole e-mail (personal data) to the log and report success.
    if (!process.env.RESEND_API_KEY) return fail(503, 'E-posta servisi ayarlı değil; yöneticiye haber verin.')
    if (doc.status !== 'draft') return fail(409, 'Bu e-posta zaten gönderildi.')
    const mail = await render(req, doc)

    const claimed = await (req.payload.db as unknown as PostgresAdapter).drizzle.execute(
      sql`UPDATE "outgoing_emails" SET "status" = 'sent', "updated_at" = now() WHERE "id" = ${doc.id} AND "status" = 'draft' RETURNING "id"`,
    )
    if (!claimed.rows.length) return fail(409, 'Bu e-posta zaten gönderildi.')

    const bcc = process.env.LEADS_NOTIFY_EMAIL
    const sent = await Result.tryAsync(
      () =>
        req.payload.sendEmail({
          from: FROM,
          replyTo: REPLY_TO,
          to: recipient(doc.to, doc.toName),
          ...(bcc ? { bcc } : {}),
          subject: doc.subject,
          ...mail,
        }),
      (e) => Err.unexpected('Email.SendFailed', String((e as Error)?.message ?? e).slice(0, 500)),
    )
    const now = SystemDateTimeProvider.utcNow().toISOString()
    if (sent.ok) {
      await req.payload.update({ collection: 'outgoing-emails', id: doc.id, data: { sentAt: now }, req })
      return Response.json({ status: 'sent' }, { headers: NO_STORE })
    }
    const reason = sent.errors[0]?.description ?? 'Bilinmeyen hata'
    req.payload.logger.error({ id: doc.id, reason, msg: 'outgoing e-mail failed' })
    await req.payload.update({ collection: 'outgoing-emails', id: doc.id, data: { status: 'failed', error: reason }, req })
    return fail(502, 'E-posta gönderilemedi. Ayrıntı "Hata" alanında; "Çoğalt" ile yeniden gönderebilirsiniz.')
  },
}

/** GET /api/outgoing-emails/:id/preview (#254): the saved e-mail exactly as it will be sent, in a sandboxed page. */
export const outgoingEmailPreviewEndpoint: Endpoint = {
  path: '/:id/preview',
  method: 'get',
  handler: async (req) => {
    const doc = await load(req)
    if (doc instanceof Response) return doc
    const { html } = await render(req, doc)
    return new Response(html, {
      headers: {
        ...NO_STORE,
        'Content-Type': 'text/html; charset=utf-8',
        // Same origin as the admin: no scripts, no forms, only images and inline styles.
        'Content-Security-Policy': "sandbox; default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'",
      },
    })
  },
}
