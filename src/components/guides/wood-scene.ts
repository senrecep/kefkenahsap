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

/** Mounts the plank on `canvas`; resolves once the texture is drawn (the static image stays until then). */
export function mountWoodScene(
  canvas: HTMLCanvasElement,
  src: string,
  rotation: { x: number; y: number },
): Promise<WoodScene> {
  const renderer = new Renderer({
    canvas,
    dpr: Math.min(window.devicePixelRatio, 2),
    alpha: true,
    antialias: true,
  })
  const gl = renderer.gl
  const camera = new Camera(gl, { fov: 30 })
  camera.position.set(0, 0, 6)
  const scene = new Transform()
  const texture = new Texture(gl, { generateMipmaps: false, minFilter: gl.LINEAR })
  const program = new Program(gl, { vertex, fragment, uniforms: { tMap: { value: texture } } })
  const plank = new Mesh(gl, {
    geometry: new Box(gl, { width: 4, height: 1.7, depth: 0.22 }),
    program,
  })
  plank.setParent(scene)

  const draw = () => renderer.render({ scene, camera })
  // Sized from the frame: OGL writes a fixed px size onto the canvas itself.
  const frame = canvas.parentElement!
  const resize = () => {
    renderer.setSize(frame.clientWidth, frame.clientHeight)
    camera.perspective({ aspect: frame.clientWidth / Math.max(1, frame.clientHeight) })
    draw()
  }
  const observer = new ResizeObserver(resize)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      texture.image = img
      plank.rotation.set(rotation.x, rotation.y, 0)
      observer.observe(frame)
      resize()
      resolve({
        setRotation: (x, y) => {
          plank.rotation.set(x, y, 0)
          draw()
        },
        destroy: () => {
          observer.disconnect()
          gl.getExtension('WEBGL_lose_context')?.loseContext()
        },
      })
    }
    img.onerror = () => reject(new Error(`texture failed: ${src}`))
    img.src = src
  })
}
