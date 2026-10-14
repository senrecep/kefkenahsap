// OGL scene for one wood sample: a textured plank, lit from above-front, drawn only when its rotation changes.
// Loaded through a dynamic import once the samples scroll into view, so OGL never ships in the page's first-load JS.
import { Box, Camera, Mesh, Program, Renderer, Texture, Transform } from 'ogl'

const vertex = /* glsl */ `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vec3 light = normalize(vec3(0.3, 0.8, 0.6));
  float shade = 0.55 + 0.45 * max(dot(vNormal, light), 0.0);
  gl_FragColor = vec4(texture2D(tMap, vUv).rgb * shade, 1.0);
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
    const camera = new Camera(gl, { fov: 30 })
    camera.position.set(0, 0, 6)
    const scene = new Transform()
    const texture = new Texture(gl, { image: img, generateMipmaps: false, minFilter: gl.LINEAR })
    const program = new Program(gl, { vertex, fragment, uniforms: { tMap: { value: texture } } })
    const plank = new Mesh(gl, {
      geometry: new Box(gl, { width: 4, height: 1.7, depth: 0.22 }),
      program,
    })
    plank.setParent(scene)
    plank.rotation.set(rotation.x, rotation.y, 0)
    const draw = () => renderer.render({ scene, camera })
    resize = () => {
      renderer.setSize(frame.clientWidth, frame.clientHeight)
      camera.perspective({ aspect: frame.clientWidth / Math.max(1, frame.clientHeight) })
      draw()
    }
    canvas.addEventListener('webglcontextlost', lost)
    observer.observe(frame)
    resize()
    return {
      setRotation: (x, y) => {
        plank.rotation.set(x, y, 0)
        draw()
      },
      destroy,
    }
  } catch (err) {
    destroy()
    throw err
  }
}
