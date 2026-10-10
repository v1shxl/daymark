
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      amplitude *= 0.5;
    }

    return value;
  }

  void main() {
    vec2 uv = vUv;
    vec2 aspectUv = (uv - 0.5) * vec2(
      uResolution.x / max(uResolution.y, 1.0),
      1.0
    );

    float t = uTime * 0.055;

    vec2 mouse = (uMouse - 0.5) * vec2(
      uResolution.x / max(uResolution.y, 1.0),
      1.0
    );

    float mouseDistance = length(aspectUv - mouse);
    float mouseInfluence = exp(-mouseDistance * 2.8);

    vec2 warped = aspectUv;

    warped.x += sin(aspectUv.y * 3.4 + t) * 0.15;
    warped.y += cos(aspectUv.x * 3.1 - t * 1.2) * 0.12;

    warped += normalize(aspectUv - mouse + vec2(0.0001))
      * mouseInfluence * 0.07;

    float fieldA = fbm(warped * 2.0 + vec2(t, -t * 0.7));
    float fieldB = fbm(warped * 3.1 - vec2(t * 0.5, t));
    float field = fieldA * 0.65 + fieldB * 0.35;

    vec3 deepForest = vec3(0.012, 0.035, 0.027);
    vec3 forest = vec3(0.025, 0.115, 0.075);
    vec3 emerald = vec3(0.045, 0.30, 0.17);
    vec3 acidLime = vec3(0.65, 0.91, 0.22);
    vec3 mutedGold = vec3(0.42, 0.38, 0.12);

    vec3 color = mix(deepForest, forest, smoothstep(0.2, 0.75, field));

    float liquidRidge = smoothstep(
      0.53,
      0.72,
      field + sin(warped.x * 4.0 + warped.y * 3.0 + t) * 0.08
    );

    color = mix(color, emerald, liquidRidge * 0.42);

    float glowOne = exp(-length(aspectUv - vec2(-0.62, 0.25)) * 2.0);
    float glowTwo = exp(-length(aspectUv - vec2(0.70, -0.42)) * 2.1);
    float glowThree = exp(-length(aspectUv - vec2(0.08, 0.72)) * 2.6);

    color += emerald * glowOne * 0.52;
    color += acidLime * glowTwo * 0.15;
    color += mutedGold * glowThree * 0.15;
    color += acidLime * mouseInfluence * 0.035;

    float vignette = smoothstep(1.45, 0.18, length(aspectUv));
    color *= 0.65 + vignette * 0.35;

    float grain = hash(gl_FragCoord.xy + uTime) - 0.5;
    color += grain * 0.018;

    gl_FragColor = vec4(color, 1.0);
  }
`

export default function LiquidBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        let renderer: THREE.WebGLRenderer

        try {
            renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: false,
                alpha: false,
                powerPreference: 'low-power',
            })
        } catch {
            canvas.classList.add('liquid-background-fallback')
            return
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
        renderer.setSize(window.innerWidth, window.innerHeight)
        renderer.outputColorSpace = THREE.SRGBColorSpace

        const scene = new THREE.Scene()
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

        const uniforms = {
            uTime: { value: 0 },
            uResolution: {
                value: new THREE.Vector2(window.innerWidth, window.innerHeight),
            },
            uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        }

        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
        })

        const geometry = new THREE.PlaneGeometry(2, 2)
        const plane = new THREE.Mesh(geometry, material)
        scene.add(plane)

        const targetMouse = new THREE.Vector2(0.5, 0.5)
        const currentMouse = new THREE.Vector2(0.5, 0.5)
        let animationFrame = 0
        let lastFrame = 0
        let disposed = false

        function onPointerMove(event: PointerEvent) {
            targetMouse.set(
                event.clientX / Math.max(window.innerWidth, 1),
                1 - event.clientY / Math.max(window.innerHeight, 1),
            )
        }

        function onResize() {
            renderer.setSize(window.innerWidth, window.innerHeight)
            uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
        }

        function animate(now: number) {
            if (disposed) return

            animationFrame = window.requestAnimationFrame(animate)

            // Cap rendering at about 30fps to reduce GPU load.
            if (now - lastFrame < 32) return
            lastFrame = now

            uniforms.uTime.value = now * 0.001
            currentMouse.lerp(targetMouse, 0.035)
            uniforms.uMouse.value.copy(currentMouse)

            renderer.render(scene, camera)
        }

        window.addEventListener('pointermove', onPointerMove, { passive: true })
        window.addEventListener('resize', onResize)

        animationFrame = window.requestAnimationFrame(animate)

        return () => {
            disposed = true
            window.cancelAnimationFrame(animationFrame)
            window.removeEventListener('pointermove', onPointerMove)
            window.removeEventListener('resize', onResize)

            geometry.dispose()
            material.dispose()
            renderer.dispose()
        }
    }, [])

    return <canvas ref={canvasRef} className="liquid-background" aria-hidden="true" />
}
