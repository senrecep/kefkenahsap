/** The four species of the 3D samples (PLAN §6 F2). Teak and thermowood have no library photo, so their texture is procedural. */
export const WOOD_SAMPLES = [
  { key: 'iroko', texture: '/wood/iroko.webp', procedural: false },
  { key: 'teak', texture: '/wood/teak.webp', procedural: true },
  { key: 'cam', texture: '/wood/cam.webp', procedural: false },
  { key: 'thermowood', texture: '/wood/thermowood.webp', procedural: true },
] as const
export type WoodKey = (typeof WOOD_SAMPLES)[number]['key']

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
