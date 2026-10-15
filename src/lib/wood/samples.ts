/**
 * The four species of the 3D samples (PLAN §6 F2). DESIGN.md: wood is never drawn, so a species shows only once it has a
 * crop from a real job photo (scripts/wood-textures.ts); `photo` is that photo's gallery slug (SEO filename), linked under
 * the sample. Teak and thermowood wait for owner photos (docs/content/CHECKLIST.md).
 */
export const WOOD_SAMPLES: readonly {
  key: 'iroko' | 'teak' | 'cam' | 'thermowood'
  texture: string | null
  photo: string | null
}[] = [
  { key: 'iroko', texture: '/wood/iroko.webp', photo: 'iroko-deck-zemin-karo-arasi' },
  { key: 'teak', texture: null, photo: null },
  { key: 'cam', texture: '/wood/cam.webp', photo: 'bahce-emprenyeli-cam-deck-zemin' },
  { key: 'thermowood', texture: null, photo: null },
]
export type WoodKey = (typeof WOOD_SAMPLES)[number]['key']

/** Species that have a real-photo texture, in display order. */
export const shownSamples = () =>
  WOOD_SAMPLES.filter((s): s is { key: WoodKey; texture: string; photo: string } => s.texture !== null && s.photo !== null)

type LexNode = { type?: string; fields?: { blockType?: string }; children?: LexNode[] }
const hasBlock = (n: LexNode): boolean =>
  (n.type === 'block' && n.fields?.blockType === 'woodSamples') || (n.children ?? []).some(hasBlock)
/** Whether a Lexical body holds the woodSamples block: the page loads the samples component only then. */
export const hasWoodSamples = (body: { root?: LexNode } | null | undefined) =>
  Boolean(body?.root && hasBlock(body.root))

/** PLAN §9: the WebGL view loads only with WebGL, no reduced-motion, no Save-Data and not on a low-memory device. */
export const can3d = (env: {
  webgl: boolean
  reducedMotion: boolean
  saveData: boolean
  deviceMemory?: number
}) =>
  env.webgl &&
  !env.reducedMotion &&
  !env.saveData &&
  (env.deviceMemory === undefined || env.deviceMemory > 2)

type Rotation = { x: number; y: number }
const STEP = Math.PI / 12
const KEYS: Record<string, Rotation> = {
  ArrowLeft: { x: 0, y: -STEP },
  ArrowRight: { x: 0, y: STEP },
  ArrowUp: { x: -STEP, y: 0 },
  ArrowDown: { x: STEP, y: 0 },
}
/** Arrow keys turn the focused sample by 15°; any other key does nothing. */
export const keyRotation = (key: string): Rotation | null => KEYS[key] ?? null

/** ±80°: tilting further would show only the plank's edge. */
export const MAX_TILT = (80 * Math.PI) / 180
export const rotate = (r: Rotation, d: Rotation): Rotation => ({
  x: Math.max(-MAX_TILT, Math.min(MAX_TILT, r.x + d.x)),
  y: r.y + d.y,
})
