import { debugErrorAllowed } from '@/lib/observability/report'

/** Throws on purpose so the error reporter can be checked end to end. 404 unless SITE_ENV=development and the token header matches. */
export function GET(req: Request) {
  if (!debugErrorAllowed(req.headers.get('x-debug-token'), process.env.DEBUG_ERROR_TOKEN, process.env.SITE_ENV)) {
    return new Response('Not found', { status: 404 })
  }
  throw new Error(`Debug error (reporter check) ${new Date().toISOString()}`)
}
