// #33 step 3: docs/clusters/REPORT.md + <n>.webp contact sheets from the reviewed seed/clusters/clusters.json.
// Run: bun run payload run scripts/clusters/report.ts   (reads the stored seoFilenames from the DB)
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { SEED_CATEGORIES } from '@/seed/categories'

import { CLUSTERS_JSON, contactSheet, DATA, ROOT, type ReviewedCluster } from './lib'

const { model, options, clusters } = JSON.parse(readFileSync(CLUSTERS_JSON, 'utf8')) as {
  model: string
  options: Record<string, number>
  clusters: (ReviewedCluster & { n: number })[]
}
const { candidates } = JSON.parse(readFileSync(path.resolve(ROOT, 'seed/clusters/candidates.json'), 'utf8')) as { candidates: unknown[] }
const payload = await getPayload({ config: await config })
const docs = path.resolve(ROOT, 'docs/clusters')
const folderOf = new Map(SEED_CATEGORIES.map((c) => [c.key, c]))

const sections: string[] = []
for (const c of clusters) {
  const cat = folderOf.get(c.category)!
  const media = await payload.find({ collection: 'media', where: { seedKey: { in: c.seedKeys } }, limit: 0, pagination: false, depth: 0 })
  const name = new Map(media.docs.map((m) => [m.seedKey, m.seoFilename]))
  if (name.size !== c.seedKeys.length) throw new Error(`cluster ${c.n}: ${c.seedKeys.length - name.size} photos not in the DB`)
  await contactSheet(c.seedKeys.map((k) => path.join(DATA, cat.folder!, k.slice(c.category.length + 1))), path.join(docs, `${c.n}.webp`))
  const range = c.from ? (c.from === c.to ? c.from : `${c.from} – ${c.to}`) : 'bilinmiyor'
  sections.push(
    [
      `## ${c.n}. ${c.title}`,
      '',
      `- Kategori: ${cat.name.tr} (\`${c.category}\`) · ${c.seedKeys.length} fotoğraf · tarih: ${range} · anahtar \`${c.key}\``,
      '',
      `![Küme ${c.n}](${c.n}.webp)`,
      '',
      ...c.seedKeys.map((k, i) => `${i + 1}. \`${name.get(k)}\``),
    ].join('\n'),
  )
}
const total = clusters.reduce((s, c) => s + c.seedKeys.length, 0)
writeFileSync(
  path.join(docs, 'REPORT.md'),
  `# Olası proje önerileri (#33)

Bu rapor makine önerisidir. Taslak projeler admin'de **Projeler** altında yayınlanmamış olarak durur; sahibi her birini
açıp kontrol eder, başlığı düzeltir, eksik bilgileri (konum, yıl, ölçü, hikaye) kendisi girer ve ancak o zaman yayınlar.
Başlıklar yalnızca fotoğrafta görüneni anlatan çalışma başlıklarıdır; yıl yalnızca EXIF tarihinden yazılmıştır.

**${clusters.length} küme, ${total} fotoğraf** (${candidates.length} aday kümeden gözle elenip ayıklandı; 568 fotoğrafın geri kalanı hiçbir kümeye girmedi).

## Yöntem

- Görsel benzerlik: open_clip \`${model}\`, CPU (\`scripts/clusters/embed.py\` → \`seed/clusters/embeddings.json\`).
- Kümeleme (\`src/lib/clusters/cluster.ts\`): her kategori içinde ortalama bağlantılı (average-linkage) birleştirme;
  eşik \`${options.threshold}\` kosinüs. Aynı gün çekilmiş iki fotoğrafın benzerliğine \`+${options.sameDayBonus}\` eklenir;
  tarihleri \`${options.maxGapDays}\` günden fazla ayrışan gruplar birleşmez. ${options.minSize}–${options.maxSize} fotoğraflık kümeler tutulur.
- Tarih: önce EXIF DateTimeOriginal (122 fotoğraf; saat bilgisi sıfır, yalnızca gün), yoksa dosya adındaki tarih
  (\`IMG_YYYYMMDD_…\`, \`WhatsApp Image YYYY-MM-DD …\`). WhatsApp adları iletim gününü taşır: 3+ kategoriye yayılan bir ad günü
  (ör. 2026-08-07, 69 fotoğraf, EXIF'leri 2022–2024) toplu aktarım sayılır ve yok sayılır.
- Gözden geçirme: aday kümelerin temas sayfalarına bakıldı; tek işe benzemeyenler atıldı, karışık kümelerden yalnızca
  açıkça aynı işe ait fotoğraflar tutuldu. Kararlar \`seed/clusters/clusters.json\` içinde (\`candidate\` = aday no).

## Notlar

- 3, 9, 10 ve 11 numaralı kümeler aynı WhatsApp günlerini (2021-06-08 / 2021-06-27) paylaşıyor; deck ve iroko kategorilerine
  bölünmüş tek bir iş olabilir. Kategoriler arası birleştirme yapılmadı, karar sahibinde.
- 15 (ofis) ve 8 (dış dolap) kümelerinde fotoğraflar aynı tarzda ama aynı yerden olduğu kesin değil.

${sections.join('\n\n')}
`,
)
console.log(`report: ${clusters.length} clusters, ${total} photos → docs/clusters/REPORT.md`)
process.exit(0)
