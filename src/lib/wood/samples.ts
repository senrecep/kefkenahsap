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

type Size = { width: number; height: number; depth: number }

/**
 * The sample board, an offcut lying face-up: 6.4:1 top face (the middle 80% of the 8:1 photo, so it fills more of its
 * tile), about half as thick as it is wide.
 */
export const WOOD_BOARD: Size = { width: 3.2, height: 0.22, depth: 0.5 }
/** Rest pose: top face seen from about 34° above, turned a little so the front edge and one end read. */
export const WOOD_REST: Rotation = { x: 0.6, y: -0.3 }
/**
 * Every pose a drag or the arrow keys can reach (tilt clamped by MAX_TILT, turn unlimited), sampled: the camera is framed
 * for all of them, so the board never leaves its tile (review of #161).
 */
export const REACHABLE: readonly Rotation[] = Array.from({ length: 17 }, (_, i) => -MAX_TILT + (i * MAX_TILT) / 8).flatMap((x) =>
  Array.from({ length: 48 }, (_, j) => ({ x, y: (j * Math.PI) / 24 })),
)

const TAN = Math.tan((FOV / 2) * (Math.PI / 180))
const corners = (size: Size) =>
  [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [-1, 1].map((sz) => [(sx * size.width) / 2, (sy * size.height) / 2, (sz * size.depth) / 2] as const)))
// OGL's Euler order YXZ: tilted about the board's long axis (x), then turned about the world vertical (y), so the long
// axis always stays level and a turn never swings it up out of the tile.
const turn = (r: Rotation) => ([x, y, z]: readonly [number, number, number]) => {
  const [y1, z1] = [y * Math.cos(r.x) - z * Math.sin(r.x), y * Math.sin(r.x) + z * Math.cos(r.x)]
  return [x * Math.cos(r.y) + z1 * Math.sin(r.y), y1, -x * Math.sin(r.y) + z1 * Math.cos(r.y)] as const
}

/** How far the turned board reaches toward the tile's edge from a camera at distance `d` (1 = the edge; NDC). */
export function projectedExtent(size: Size, r: Rotation, aspect: number, d: number): number {
  return Math.max(...corners(size).map(turn(r)).map(([x, y, z]) => Math.max(Math.abs(x) / ((d - z) * TAN * aspect), Math.abs(y) / ((d - z) * TAN))))
}

/**
 * Camera distance at which the board, in the worst of the given poses, spans `fill` of the tile's width or height,
 * whichever it reaches first: it fills the tile at any tile size and stays inside it in every one of those poses.
 */
export function fitDistance(size: Size, poses: readonly Rotation[], aspect: number, fill = 0.85): number {
  const nearest = Math.max(...poses.flatMap((r) => corners(size).map(turn(r)).map((p) => p[2])))
  const fits = (d: number) => poses.every((r) => projectedExtent(size, r, aspect, d) <= fill)
  // The projected size only shrinks as the camera backs off, so bisect between the nearest corner and far away.
  let lo = nearest + 1e-6
  let hi = 1000
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) hi = mid
    else lo = mid
  }
  return hi
}
