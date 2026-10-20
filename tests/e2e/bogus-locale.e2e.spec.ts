import { expect, test } from '@playwright/test'

// Scanner traffic (GlitchTip): a dotted or unknown first segment is not a locale. It must be a 404, never a DB error (500).
test.describe('bogus locale and scanner paths', () => {
  for (const path of ['/.svn/wc.db', '/foo/bar.php']) {
    test(`GET ${path} is 404`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(404)
    })
  }

  test('POST /api/graphql is not served (GraphQL is disabled)', async ({ request }) => {
    const res = await request.post('/api/graphql', { data: { query: '{ __typename }' } })
    expect(res.status()).toBe(404)
  })

  test('GET /api/graphql-playground is not served', async ({ request }) => {
    expect((await request.get('/api/graphql-playground')).status()).toBe(404)
  })
})
