// OGL scene for one wood sample: a board-shaped plank (8:1 face) with its real-photo texture, lit from above-front with a
// soft sheen and a slight grain relief taken from the photo's own light and dark, drawn only when its rotation changes.
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
varying vec3 vView;
void main() {
  vUv = uv;
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
varying vec3 vView;
float lum(vec2 uv) { return dot(texture2D(tMap, uv).rgb, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec3 base = texture2D(tMap, vUv).rgb;
  // Grain relief: darker latewood reads as slightly lower, so the light catches the grain lines.
  vec2 g = vec2(lum(vUv + vec2(uTexel.x, 0.0)) - lum(vUv - vec2(uTexel.x, 0.0)), lum(vUv + vec2(0.0, uTexel.y)) - lum(vUv - vec2(0.0, uTexel.y)));
  vec3 n = normalize(vNormal - vec3(g, 0.0) * 1.2);
  vec3 light = normalize(vec3(0.3, 0.8, 0.6));
  float diffuse = max(dot(n, light), 0.0);
  // Oiled wood: a broad, weak highlight rather than a glossy one.
  float sheen = pow(max(dot(n, normalize(light + normalize(vView))), 0.0), 24.0) * 0.14;
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
    const camera = new Camera(gl, { fov: 20 })
    const scene = new Transform()
    // 1024×128 is power-of-two, so mipmaps keep the grain crisp on a small phone tile.
    const texture = new Texture(gl, { image: img, generateMipmaps: true, minFilter: gl.LINEAR_MIPMAP_LINEAR, anisotropy: 4 })
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: { tMap: { value: texture }, uTexel: { value: [1 / img.naturalWidth, 1 / img.naturalHeight] } },
    })
    // A deck board: 8:1 face like the texture, about a seventh as thick as it is wide.
    const plank = new Mesh(gl, {
      geometry: new Box(gl, { width: 4, height: 0.5, depth: 0.12 }),
      program,
    })
    plank.setParent(scene)
    plank.rotation.set(rotation.x, rotation.y, 0)
    const draw = () => renderer.render({ scene, camera })
    resize = () => {
      const aspect = frame.clientWidth / Math.max(1, frame.clientHeight)
      renderer.setSize(frame.clientWidth, frame.clientHeight)
      camera.perspective({ aspect })
      // Distance at which the 4-unit board spans ~85% of the frame width (fov 20°, a long lens: little perspective
      // stretch on the near end), so it fills the tile at any size.
      camera.position.set(0, 0, 4 / 0.85 / (2 * Math.tan((10 * Math.PI) / 180) * aspect))
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
