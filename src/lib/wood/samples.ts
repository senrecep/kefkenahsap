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
  { key: 'iroko', texture: '/wood/iroko.webp', photo: 'iroko-deck-zemin-ahsap-dolap-kapagi' },
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

/** Vertical field of view of the samples' camera (a long lens: little perspective stretch on the near end). */
export const FOV = 20

/**
 * Camera distance at which a box of this size, turned by `r` (a turntable: first turned about its own vertical axis by `y`, then tilted toward the camera by `x`), spans
 * `fill` of the tile's width or height, whichever it reaches first, so the board fills its tile at any tile size.
 */
export function fitDistance(size: { width: number; height: number; depth: number }, r: Rotation, aspect: number, fill = 0.85): number {
  const t = Math.tan((FOV / 2) * (Math.PI / 180))
  const corners = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [-1, 1].map((sz) => [(sx * size.width) / 2, (sy * size.height) / 2, (sz * size.depth) / 2] as const)))
  const turned = corners.map(([x, y, z]) => {
    const [x1, z1] = [x * Math.cos(r.y) + z * Math.sin(r.y), -x * Math.sin(r.y) + z * Math.cos(r.y)]
    return [x1, y * Math.cos(r.x) - z1 * Math.sin(r.x), y * Math.sin(r.x) + z1 * Math.cos(r.x)] as const
  })
  const fits = (d: number) => turned.every(([x, y, z]) => Math.abs(x) / ((d - z) * t * aspect) <= fill && Math.abs(y) / ((d - z) * t) <= fill)
  // The projected size only shrinks as the camera backs off, so bisect between the nearest corner and far away.
  let lo = Math.max(...turned.map((p) => p[2])) + 1e-6
  let hi = 1000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) hi = mid
    else lo = mid
  }
  return hi
}
