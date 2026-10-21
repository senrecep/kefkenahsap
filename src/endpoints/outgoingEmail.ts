import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Endpoint, PayloadRequest } from 'payload'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

import { roleOf } from '@/access'
import { positiveId } from '@/ai/guard'
import { outgoingEmail, recipient, sendDenied } from '@/lib/email/outgoing'
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

/** Resend gets this long before the e-mail is stored as failed (a hung call must not leave the row "sent" without an answer). */
export const sendLimits = { timeoutMs: 20_000 }

const db = (req: PayloadRequest) => (req.payload.db as unknown as PostgresAdapter).drizzle

/** Owner rule (sendDenied): editors only reply to a lead at the address that lead left. */
async function denied(req: PayloadRequest, doc: OutgoingEmail): Promise<string | undefined> {
  const leadId = typeof doc.lead === 'object' ? doc.lead?.id : doc.lead
  const lead = leadId && roleOf(req.user) !== 'admin' ? await req.payload.findByID({ collection: 'leads', id: leadId, depth: 0, disableErrors: true, req }) : null
  return sendDenied({ role: roleOf(req.user), to: doc.to, leadEmail: lead?.email })
}

/**
 * POST /api/outgoing-emails/:id/send (#254), staff only. Sends a saved draft once: the draft → sent switch is a single
 * conditional UPDATE, so a double click or two tabs can never send it twice. A failed send is stored as "Hata" with the reason.
 */
export const outgoingEmailSendEndpoint: Endpoint = {
  path: '/:id/send',
  method: 'post',
  handler: async (req) => {
    const loaded = await load(req)
    if (loaded instanceof Response) return loaded
    const refusal = await denied(req, loaded)
    if (refusal) return fail(403, refusal)
    if (loaded.status !== 'draft') return fail(409, 'Bu e-posta zaten gönderildi.')
    // Without Resend, Payload's fallback mailer would print the whole e-mail (personal data) to the log and report success;
    // without the site URL the logo and links would be broken.
    if (!process.env.RESEND_API_KEY || !process.env.NEXT_PUBLIC_SITE_URL) return fail(503, 'E-posta servisi ayarlı değil; yöneticiye haber verin.')

    const claimed = await db(req).execute(
      sql`UPDATE "outgoing_emails" SET "status" = 'sent', "sent_at" = now(), "updated_at" = now() WHERE "id" = ${loaded.id} AND "status" = 'draft' RETURNING "id"`,
    )
    if (!claimed.rows.length) return fail(409, 'Bu e-posta zaten gönderildi.')

    // What is sent is the row as claimed: a save in another tab between the first read and the claim is included.
    const doc = await req.payload.findByID({ collection: 'outgoing-emails', id: loaded.id, depth: 0, req })
    const lateRefusal = await denied(req, doc)
    if (lateRefusal) {
      await db(req).execute(sql`UPDATE "outgoing_emails" SET "status" = 'draft', "sent_at" = NULL WHERE "id" = ${doc.id}`)
      return fail(403, lateRefusal)
    }
    const mail = await render(req, doc)
    const bcc = process.env.LEADS_NOTIFY_EMAIL
    let timer: ReturnType<typeof setTimeout> | undefined
    const sent = await Result.tryAsync(
      () =>
        Promise.race([
          req.payload.sendEmail({ from: FROM, replyTo: REPLY_TO, to: recipient(doc.to, doc.toName), ...(bcc ? { bcc } : {}), subject: doc.subject, ...mail }),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Resend ${sendLimits.timeoutMs / 1000} sn içinde yanıt vermedi (zaman aşımı).`)), sendLimits.timeoutMs)
          }),
        ]),
      (e) => Err.unexpected('Email.SendFailed', String((e as Error)?.message ?? e).slice(0, 500)),
    ).finally(() => clearTimeout(timer))
    if (sent.ok) return Response.json({ status: 'sent' }, { headers: NO_STORE })

    const reason = sent.errors[0]?.description ?? 'Bilinmeyen hata'
    req.payload.logger.error({ id: doc.id, reason, msg: 'outgoing e-mail failed' })
    // The answer describes the e-mail; a database error while recording the failure is only logged.
    const stored = await Result.tryAsync(
      () => req.payload.update({ collection: 'outgoing-emails', id: doc.id, data: { status: 'failed', error: reason, sentAt: null }, req }),
      (e) => Err.unexpected('Email.StatusNotStored', String((e as Error)?.message ?? e)),
    )
    if (!stored.ok) req.payload.logger.error({ id: doc.id, err: stored.errors[0]?.description, msg: 'outgoing e-mail: could not store the failure' })
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
