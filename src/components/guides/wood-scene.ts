// OGL scene for one wood sample: a board lying face-up (8:1 top face, about half as thick as it is wide) with its
// real-photo texture on top, the same grain run along its long edges and a darker end grain, lit from above-front with a
// soft oiled sheen and a slight grain relief taken from the photo's own light and dark, drawn only when its rotation changes.
// Loaded through a dynamic import once the samples scroll into view, so OGL never ships in the page's first-load JS.
import { Box, Camera, Mesh, Program, Renderer, Texture, Transform } from 'ogl'

import { FOV, WOOD_BOARD, woodDistance } from '@/lib/wood/samples'

const vertex = /* glsl */ `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vFace;
varying vec3 vView;
void main() {
  vUv = uv;
  vFace = normal;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform vec2 uTexel;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vFace;
varying vec3 vView;
float lum(vec2 uv) { return dot(texture2D(tMap, uv).rgb, vec3(0.299, 0.587, 0.114)); }
void main() {
  // OGL's Box: the top face's u runs along the board, v across it; the long edges' u also runs along it; the ends' u runs
  // across. The top shows the photo; a long edge shows a thin strip of it (the same grain, seen edge-on); an end shows end
  // grain: one column of the photo, darker, as sawn end grain is.
  vec3 f = abs(vFace);
  // The board is 6.4:1, shorter than the 8:1 photo: it shows the middle 80% of the photo's length, uncropped across.
  float u = 0.1 + vUv.x * 0.8;
  vec2 uv = f.y > 0.5 ? vec2(u, vUv.y) : f.z > 0.5 ? vec2(u, 0.45 + vUv.y * 0.1) : vec2(0.12 + vUv.y * 0.02, vUv.x);
  vec3 base = texture2D(tMap, uv).rgb * (f.x > 0.5 ? 0.62 : f.z > 0.5 ? 0.86 : 1.0);
  // Grain relief: darker latewood reads as slightly lower, so the light catches the grain lines.
  vec2 g = f.y > 0.5 ? vec2(lum(uv + vec2(uTexel.x, 0.0)) - lum(uv - vec2(uTexel.x, 0.0)), lum(uv + vec2(0.0, uTexel.y)) - lum(uv - vec2(0.0, uTexel.y))) : vec2(0.0);
  vec3 n = normalize(vNormal - vec3(g, 0.0) * 1.2);
  vec3 light = normalize(vec3(0.3, 0.8, 0.6));
  float diffuse = max(dot(n, light), 0.0);
  // Oiled wood: a broad, weak highlight rather than a glossy one.
  float sheen = pow(max(dot(n, normalize(light + normalize(vView))), 0.0), 18.0) * 0.2;
  gl_FragColor = vec4(base * (0.68 + 0.42 * diffuse) + sheen, 1.0);
}`

export type WoodScene = { setRotation: (x: number, y: number) => void; destroy: () => void }

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`texture failed: ${src}`))
    img.src = src
  })

/**
 * Mounts the plank on `canvas` once its texture has loaded (nothing touches WebGL before that, so a failed or cancelled
 * load leaves nothing to clean up). `onLost` fires if the browser drops the WebGL context, so the photo can return.
 */
export async function mountWoodScene(
  canvas: HTMLCanvasElement,
  src: string,
  rotation: { x: number; y: number },
  onLost: () => void,
): Promise<WoodScene> {
  const img = await loadImage(src)
  // Sized from the frame: OGL writes a fixed px size onto the canvas itself.
  const frame = canvas.parentElement!
  const renderer = new Renderer({
    canvas,
    dpr: Math.min(window.devicePixelRatio, 2),
    alpha: true,
    antialias: true,
  })
  const gl = renderer.gl
  let resize = () => {}
  const observer = new ResizeObserver(() => resize())
  const lost = () => onLost()
  const destroy = () => {
    canvas.removeEventListener('webglcontextlost', lost)
    observer.disconnect()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
  try {
    const camera = new Camera(gl, { fov: FOV })
    const scene = new Transform()
    // 1024×128 is power-of-two, so mipmaps keep the grain crisp on a small phone tile.
    const texture = new Texture(gl, { image: img, generateMipmaps: true, minFilter: gl.LINEAR_MIPMAP_LINEAR, anisotropy: 4 })
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: { tMap: { value: texture }, uTexel: { value: [1 / img.naturalWidth, 1 / img.naturalHeight] } },
    })
    const plank = new Mesh(gl, {
      geometry: new Box(gl, WOOD_BOARD),
      program,
    })
    // Tilted about its long axis, then turned about the world vertical (OGL's YXZ order): the long axis stays level, so
    // no turn swings an end up out of the tile.
    plank.setParent(scene)
    const turn = (r: { x: number; y: number }) => plank.rotation.set(r.x, r.y, 0)
    turn(rotation)
    const draw = () => renderer.render({ scene, camera })
    resize = () => {
      const aspect = frame.clientWidth / Math.max(1, frame.clientHeight)
      renderer.setSize(frame.clientWidth, frame.clientHeight)
      camera.perspective({ aspect })
      // Framed for every pose a drag can reach, so the board fills the tile at rest and never leaves it when turned.
      camera.position.set(0, 0, woodDistance(aspect))
      draw()
    }
    canvas.addEventListener('webglcontextlost', lost)
    observer.observe(frame)
    resize()
    return {
      setRotation: (x, y) => {
        turn({ x, y })
        draw()
      },
      destroy,
    }
  } catch (err) {
    destroy()
    throw err
  }
}
