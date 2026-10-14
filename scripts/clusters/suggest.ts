// #33 step 2: candidate clusters + contact sheets for review. Run: bun scripts/clusters/suggest.ts [OUT_DIR]
// Writes seed/clusters/candidates.json and OUT_DIR/<n>.webp (default: a temp dir, not committed).
import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { clusterPhotos } from '@/lib/clusters/cluster'

import { contactSheet, DATA, loadPhotos, OPTIONS, ROOT } from './lib'

const out = process.argv[2] ?? path.join(os.tmpdir(), 'kefken-cluster-candidates')
mkdirSync(out, { recursive: true })
const photos = loadPhotos()
const result = clusterPhotos(photos, OPTIONS)
if (!result.ok) throw new Error(result.errors.map((e) => e.code).join(', '))
const byKey = new Map(photos.map((p) => [p.key, p]))
const candidates = result.value.map((c, i) => ({ n: i + 1, ...c }))
for (const c of candidates) await contactSheet(c.keys.map((k) => path.join(DATA, byKey.get(k)!.folder, byKey.get(k)!.file)), path.join(out, `${c.n}.webp`))
writeFileSync(path.resolve(ROOT, 'seed/clusters/candidates.json'), JSON.stringify({ options: OPTIONS, candidates }, null, 1) + '\n')
const clustered = candidates.reduce((s, c) => s + c.keys.length, 0)
console.log(`${candidates.length} candidates, ${clustered}/${photos.length} photos, ${photos.filter((p) => p.day).length} dated → ${out}`)
for (const c of candidates) console.log(`#${c.n} ${c.category} ${c.keys.length} ${c.from ?? ''}${c.to && c.to !== c.from ? `..${c.to}` : ''}`)
