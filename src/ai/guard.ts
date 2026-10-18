import type { Payload, PayloadRequest } from 'payload'
import { Err, type AppError } from 'tsentials/errors'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider } from 'tsentials/time'

import { roleOf } from '@/access'
import { createRateLimiter } from '@/lib/leads/guard'
import { checkBudget } from './budget'
import { monthUsage } from './usage'

export type AiLimiter = ReturnType<typeof createRateLimiter>
/**
 * Per staff user: 10 AI button presses per 10 minutes (each press is one paid model call).
 * shortcut: in-memory per process (like the contact form); replicas or a restart reset it, the monthly budget still caps spend.
 */
export const aiLimiter = (): AiLimiter => createRateLimiter({ limit: 10, windowMs: 10 * 60_000, clock: SystemDateTimeProvider, maxKeys: 100 })

/** Every AI button endpoint passes here first: signed-in staff, under the rate limit, under the monthly budget. */
export async function aiGate(payload: Payload, req: PayloadRequest, limiter: AiLimiter) {
  const user = req.user
  if (!user || !roleOf(user)) return Result.failure(Err.unauthorized('Auth.Required', 'not signed in as staff'))
  if (!limiter.hit(`${user.collection}:${user.id}`)) return Result.failure(Err.forbidden('AI.RateLimited', `user ${user.id} over the limit`))
  const settings = await payload.findGlobal({ slug: 'aiSettings', depth: 0 })
  const spent = (await monthUsage(payload, undefined, SystemDateTimeProvider)).reduce((s, d) => s + (d.costUsd ?? 0), 0)
  const budget = checkBudget(spent, settings.monthlyBudgetUsd)
  if (Result.isFailure(budget)) return Result.failure(budget.errors[0]!)
  const remainingUsd = settings.monthlyBudgetUsd == null ? Infinity : settings.monthlyBudgetUsd - spent
  return Result.success({ settings, remainingUsd })
}

/** A record id from the request body: a positive safe integer, as a number or a plain digit string. */
export function positiveId(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^[1-9]\d*$/.test(v) ? Number(v) : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : undefined
}

/** JSON only: a cross-site HTML form cannot send it without a CORS preflight, which these endpoints never allow. */
export const isJsonRequest = (h: Headers) => /^application\/json\s*(;|$)/i.test(h.get('content-type') ?? '')

const GENERIC = { status: 500, message: 'AI işlemi tamamlanamadı. Tekrar deneyin.' }
/** The only texts the admin buttons show. Error descriptions (provider replies, exception messages) go to the log. */
export const AI_MESSAGES: Record<string, { status: number; message: string }> = {
  'Auth.Required': { status: 401, message: 'Bu işlem için yönetim paneline giriş yapın.' },
  'AI.RateLimited': { status: 429, message: 'Kısa sürede çok fazla istek gönderildi. Birkaç dakika sonra tekrar deneyin.' },
  'AI.BudgetExceeded': { status: 403, message: 'Aylık AI bütçesi doldu; AI işleri ay sonuna kadar durdu.' },
  'AI.BudgetInsufficient': { status: 403, message: 'Bu işlem aylık AI bütçesinin kalanını aşabilir. Metni kısaltın ya da AI Ayarları’ndan bütçeyi artırın.' },
  'AI.PaymentRequired': { status: 502, message: 'AI hizmetinin kredisi bitti. Yöneticiye haber verin.' },
  'AI.AllModelsFailed': { status: 502, message: 'AI şu an cevap vermedi. Biraz sonra tekrar deneyin.' },
  'AI.NoModels': { status: 500, message: 'Bu görev için model ayarlı değil (AI Ayarları).' },
  'AI.BadContentType': { status: 415, message: 'Geçersiz istek.' },
  'Translate.BadRequest': { status: 400, message: 'Bu kayıt çevrilemez.' },
  'Translate.NotFound': { status: 404, message: 'Kayıt bulunamadı. Önce kaydedin.' },
  'AI.Disabled': { status: 403, message: 'AI kapalı (AI Ayarları ya da sunucu anahtarı). Önce açın.' },
  'AI.RetryNotNeeded': { status: 409, message: 'Bu fotoğraf için AI önerisi zaten hazırlanıyor ya da hazır.' },
  'AI.QueueFailed': { status: 500, message: 'AI önerisi sıraya alınamadı. Tekrar deneyin.' },
  'Media.NotFound': { status: 404, message: 'Fotoğraf bulunamadı; silinmiş olabilir.' },
  'Translate.NoSource': { status: 400, message: 'Çevrilecek metin yok: önce bir dilde başlığı doldurun.' },
  'Translate.NothingMissing': { status: 400, message: 'Tüm diller zaten dolu; çevrilecek eksik dil yok.' },
  'Translate.TooLong': { status: 400, message: 'Metin bir seferde çevrilemeyecek kadar uzun (en çok 20.000 karakter). Bir kısmını elle çevirin.' },
  'Translate.SchemaMismatch': { status: 502, message: 'AI çevirisi eksik geldi; hiçbir şey kaydedilmedi. Tekrar deneyin.' },
  'Draft.BadRequest': { status: 400, message: 'Bu kayıt için taslak yazılamaz.' },
  'Draft.NotFound': { status: 404, message: 'Kayıt bulunamadı. Önce kaydedin.' },
  'Draft.NotesRequired': { status: 400, message: 'En az bir not yazın (her satıra bir madde).' },
  'Draft.NotesTooLong': { status: 400, message: 'Notlar çok uzun: en çok 40 madde ve 4.000 karakter.' },
  'Draft.NotEmpty': { status: 400, message: 'Bu alan dolu; taslak yalnızca boş alana yazılır.' },
  'Draft.TitleRequired': { status: 400, message: 'Önce Türkçe başlığı yazıp kaydedin.' },
  'Draft.SaveFailed': { status: 500, message: 'Taslak kaydedilemedi. Tekrar deneyin.' },
  'Translate.SaveFailed': { status: 500, message: 'Çeviri taslağı kaydedilemedi. Adres (slug) başka bir kayıtta kullanılıyor olabilir.' },
}

/** Edge mapping for the AI endpoints: fixed Turkish text per code; the description is logged, never sent. */
export function aiErrorResponse(err: AppError, log?: (o: { code: string; detail: string }) => void): Response {
  const m = AI_MESSAGES[err.code] ?? GENERIC
  log?.({ code: err.code, detail: err.description })
  return Response.json({ error: m.message, code: err.code }, { status: m.status })
}
