import { describe, expect, it, vi } from 'vitest'
import { Err } from 'tsentials/errors'

import { aiErrorResponse, isJsonRequest, positiveId } from './guard'

describe('aiErrorResponse: fixed Turkish messages, details only in the server log', () => {
  it('never echoes provider text or exception messages', async () => {
    const log = vi.fn()
    const res = aiErrorResponse(Err.unexpected('AI.AllModelsFailed', 'All models failed: a: 401 {"error":"key sk-or-v1-abc invalid"}'), log)
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body).toEqual({ error: 'AI şu an cevap vermedi. Biraz sonra tekrar deneyin.', code: 'AI.AllModelsFailed' })
    expect(JSON.stringify(body)).not.toContain('sk-or')
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ code: 'AI.AllModelsFailed', detail: expect.stringContaining('sk-or') }))
  })

  it('maps each code to its status', () => {
    expect(aiErrorResponse(Err.unauthorized('Auth.Required', 'x')).status).toBe(401)
    expect(aiErrorResponse(Err.forbidden('AI.RateLimited', 'x')).status).toBe(429)
    expect(aiErrorResponse(Err.forbidden('AI.BudgetExceeded', 'x')).status).toBe(403)
    expect(aiErrorResponse(Err.validation('AI.BadContentType', 'x')).status).toBe(415)
    expect(aiErrorResponse(Err.validation('Translate.TooLong', 'x')).status).toBe(400)
  })

  it('an unknown code gets a generic message, not its description', async () => {
    const body = await aiErrorResponse(Err.unexpected('Something.New', 'internal stack trace')).json()
    expect(body.error).toBe('AI işlemi tamamlanamadı. Tekrar deneyin.')
    expect(aiErrorResponse(Err.unexpected('Something.New', 'x')).status).toBe(500)
  })
})

describe('request checks', () => {
  it('positiveId: positive safe integers (number or digit string) only', () => {
    expect(positiveId(7)).toBe(7)
    expect(positiveId('42')).toBe(42)
    for (const bad of [0, -1, 1.5, '07', '1e3', ' 1', 'abc', '', null, undefined, {}, [1], Number.MAX_SAFE_INTEGER + 1, '9007199254740993'])
      expect(positiveId(bad), JSON.stringify(bad)).toBeUndefined()
  })

  it('isJsonRequest: only application/json bodies (a form post cannot reach the AI endpoints)', () => {
    const h = (ct?: string) => new Headers(ct ? { 'content-type': ct } : {})
    expect(isJsonRequest(h('application/json'))).toBe(true)
    expect(isJsonRequest(h('application/json; charset=utf-8'))).toBe(true)
    expect(isJsonRequest(h('text/plain'))).toBe(false)
    expect(isJsonRequest(h('application/x-www-form-urlencoded'))).toBe(false)
    expect(isJsonRequest(h('multipart/form-data; boundary=x'))).toBe(false)
    expect(isJsonRequest(h())).toBe(false)
  })
})
