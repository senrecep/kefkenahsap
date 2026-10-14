import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { clusterPhotos, dayFromFilename, transferDays, type ClusterOptions, type ClusterPhoto } from './cluster'

const OPTS: ClusterOptions = { threshold: 0.9, sameDayBonus: 0.2, maxGapDays: 30, minSize: 3, maxSize: 24 }
const p = (key: string, v: number[], day?: string, category = 'deck'): ClusterPhoto => ({ key, category, v, day })
const keys = (r: ReturnType<typeof clusterPhotos>) => (r.ok ? r.value.map((c) => c.keys) : r.errors.map((e) => e.code))

describe('dayFromFilename', () => {
  it('reads the day from WhatsApp and phone camera names', () => {
    expect(dayFromFilename('WhatsApp-Image-2021-04-30-at-20.41.55.webp')).toBe('2021-04-30')
    expect(dayFromFilename('WhatsApp Image 2019-07-02 at 10.11.12 (3).webp')).toBe('2019-07-02')
    expect(dayFromFilename('IMG_20180408_071129.jpg1_.webp')).toBe('2018-04-08')
    expect(dayFromFilename('IMG-20160512-WA0003.webp')).toBe('2016-05-12')
  })

  it('returns undefined for names without a valid date', () => {
    expect(dayFromFilename('1003563_672567726121163_885889356_n.webp')).toBeUndefined()
    expect(dayFromFilename('DSC_0296.webp')).toBeUndefined()
    expect(dayFromFilename('IMG_20181340_000000.webp')).toBeUndefined()
  })
})

describe('transferDays', () => {
  it('flags file-name days that span 3+ categories (a WhatsApp forwarding batch, not a job day)', () => {
    const named = [
      { category: 'deck', day: '2026-08-07' }, { category: 'stairs', day: '2026-08-07' }, { category: 'iroko', day: '2026-08-07' },
      { category: 'deck', day: '2021-06-27' }, { category: 'iroko', day: '2021-06-27' }, { category: 'deck', day: '2021-06-27' },
    ]
    expect([...transferDays(named)]).toEqual(['2026-08-07'])
  })
})

describe('clusterPhotos', () => {
  // Hand-computed cosines: a1·a2 = a1·a3 = 0.96, a2·a3 = 0.9216; group A · group B = 0 or 0.0784; noise · a3 = 0.28.
  const a = [p('a1', [1, 0, 0, 0]), p('a2', [0.96, 0, 0, 0.28]), p('a3', [0.96, 0, 0.28, 0])]
  const b = [p('b1', [0, 1, 0, 0]), p('b2', [0, 0.96, 0, 0.28]), p('b3', [0, 0.96, 0.28, 0])]

  it('links similar photos and drops the singleton', () => {
    // {a1,a2} then a3 joins at average (0.96 + 0.9216) / 2 = 0.9408 ≥ 0.9.
    expect(keys(clusterPhotos([...a, p('noise', [0, 0, 1, 0]), ...b], OPTS))).toEqual([
      ['a1', 'a2', 'a3'],
      ['b1', 'b2', 'b3'],
    ])
  })

  it('never links across categories', () => {
    const same = [1, 0, 0, 0]
    const photos = ['x1', 'x2', 'y1', 'y2', 'x3', 'y3'].map((k) => p(k, same, undefined, k[0]))
    expect(keys(clusterPhotos(photos, OPTS))).toEqual([
      ['x1', 'x2', 'x3'],
      ['y1', 'y2', 'y3'],
    ])
  })

  it('same-day photos link at a lower visual similarity', () => {
    // c1·c2 = c1·c3 = 0.8, c2·c3 = 0.64: below 0.9 alone. Same day adds 0.2 → 1.0, 1.0, 0.84; average 0.92 ≥ 0.9.
    const vs = [[1, 0, 0, 0], [0.8, 0.6, 0, 0], [0.8, 0, 0.6, 0]]
    expect(keys(clusterPhotos(vs.map((v, i) => p(`c${i + 1}`, v)), OPTS))).toEqual([])
    expect(keys(clusterPhotos(vs.map((v, i) => p(`c${i + 1}`, v, '2018-04-08')), OPTS))).toEqual([['c1', 'c2', 'c3']])
  })

  it('splits identical-looking photos whose dates are more than 30 days apart', () => {
    const same = [1, 0, 0, 0]
    const days = ['2018-01-01', '2018-03-01', '2018-01-02', '2018-03-05', '2018-01-10', '2018-03-20']
    expect(keys(clusterPhotos(days.map((d, i) => p(`p${i + 1}`, same, d)), OPTS))).toEqual([
      ['p1', 'p3', 'p5'],
      ['p2', 'p4', 'p6'],
    ])
  })

  it('keeps only clusters of 3 to 24 photos', () => {
    const same = [1, 0, 0, 0]
    const group = (n: number, cat: string) => Array.from({ length: n }, (_, i) => p(`${cat}${i}`, same, undefined, cat))
    const r = clusterPhotos([...group(2, 'two'), ...group(24, 'max'), ...group(25, 'over')], OPTS)
    expect(Result.isSuccess(r) && r.value.map((c) => [c.category, c.keys.length])).toEqual([['max', 24]])
  })

  it('reports the date range of a cluster when known', () => {
    const same = [1, 0, 0, 0]
    const r = clusterPhotos([p('d1', same, '2018-04-10'), p('d2', same), p('d3', same, '2018-04-08')], OPTS)
    expect(Result.isSuccess(r) && r.value[0]).toEqual({ category: 'deck', keys: ['d1', 'd2', 'd3'], from: '2018-04-08', to: '2018-04-10' })
  })

  it('fails on vectors of different length', () => {
    expect(keys(clusterPhotos([p('a', [1, 0]), p('b', [1, 0, 0])], OPTS))).toEqual(['Clusters.DimensionMismatch'])
  })
})
