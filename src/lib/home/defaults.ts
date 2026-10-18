// #213: the homepage sections fall back to messages/<locale>/home.json when an admin field is empty. This copies those
// defaults into the empty admin fields so the admin shows what the site shows. Keys mirror src/components/home/*.

/** block → text field → key in the `Home` messages namespace. */
const TEXT_KEYS: Record<string, Record<string, string>> = {
  hero: { heading: 'heroTitle', subheading: 'heroText' },
  featuredGallery: { heading: 'galleryTitle' },
  services: { heading: 'servicesTitle' },
  featuredProjects: { heading: 'projectsTitle' },
  process: { heading: 'processTitle' },
  references: { heading: 'referencesTitle' },
  woodTypes: { heading: 'woodTitle' },
  faq: { heading: 'faqTitle' },
  contact: { heading: 'contactTitle' },
}
const STEP_KEYS = ['survey', 'quote', 'build', 'install', 'care'] as const

type Step = { title: string; text?: string | null }
export type HomeMessages = { steps: Record<(typeof STEP_KEYS)[number], { title: string; text: string }> } & Record<string, unknown>
/** One locale's block, as read from the global (localized fields hold that locale's plain value). */
export type HomeBlock = { blockType: string } & Record<string, unknown>

const blank = (v: unknown) => v == null || (typeof v === 'string' && !v.trim())
const defaultSteps = (m: HomeMessages): Step[] => STEP_KEYS.map((k) => ({ title: m.steps[k].title, text: m.steps[k].text }))
const hasSteps = (v: unknown) => Array.isArray(v) && v.length > 0

/**
 * One locale: fills empty headings/subheadings and an empty process step list with the message default. Never touches a
 * non-empty value; ids and order stay. `filled` lists what changed as `<block>.<field>` (empty on a re-run).
 */
export function fillHomeDefaults<B extends HomeBlock>(layout: readonly B[], m: HomeMessages): { layout: B[]; filled: string[] } {
  const filled: string[] = []
  const out = layout.map((block) => {
    const next: Record<string, unknown> = { ...block }
    for (const [field, key] of Object.entries(TEXT_KEYS[block.blockType] ?? {})) {
      if (!blank(block[field])) continue
      next[field] = String(m[key])
      filled.push(`${block.blockType}.${field}`)
    }
    if (block.blockType === 'process' && !hasSteps(block.steps)) {
      next.steps = defaultSteps(m)
      filled.push('process.steps')
    }
    return next as B
  })
  return { layout: out, filled }
}

/** What the public page renders (the admin value, else the message default); used to prove a fill changes nothing. */
export function effectiveHomeText(layout: readonly HomeBlock[], m: HomeMessages) {
  return layout.map((block) => ({
    blockType: block.blockType,
    ...Object.fromEntries(Object.entries(TEXT_KEYS[block.blockType] ?? {}).map(([field, key]) => [field, (typeof block[field] === 'string' && (block[field] as string).trim()) || String(m[key])])),
    ...(block.blockType === 'process' ? { steps: (hasSteps(block.steps) ? (block.steps as Step[]) : defaultSteps(m)).map((s) => [s.title, s.text ?? '']) } : {}),
  }))
}
