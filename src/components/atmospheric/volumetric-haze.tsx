/**
 * Layer 1 — Volumetric Haze
 *
 * Full-viewport Three.js canvas running a multi-octave Simplex-noise
 * fog shader with a biological breathing rhythm and teal (#00FFFF)
 * glow concentrated in the lighter noise bands.
 *
 * Post-processing: UnrealBloom with high threshold / low strength so
 * only the teal highlights bloom through the haze.
 */

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";

/* ────────────────────────────── GLSL ────────────────────────────── */

const fogVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fogFragment = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uResolution;
  varying vec2  vUv;

  /* ── Simplex 3D noise (Ashima Arts) ── */
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x  = x_ * ns.x + ns.yyyy;
    vec4 y  = y_ * ns.x + ns.yyyy;
    vec4 h  = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  /* ── fBm built on snoise ── */
  float fbm(vec3 p) {
    float f = 0.0;
    float amplitude = 0.5;
    float lacunarity = 2.0;
    for (int i = 0; i < 6; i++) {
      f += amplitude * snoise(p);
      p *= lacunarity;
      amplitude *= 0.5;
    }
    return f;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    uv.x *= aspect;

    /* ── Breathing rhythm: 10-second period ── */
    float breath = sin(uTime * 0.628) * 0.5 + 0.5;       // 0 → 1 oscillation
    float breathScale = 1.0 + breath * 0.25;               // scale 1.0 – 1.25
    float breathAlpha = 0.80 + breath * 0.20;              // opacity 0.8 – 1.0

    /* ── Multi-layer volumetric fog ── */
    float t = uTime * 0.06;   // very slow drift

    // Primary fog layer
    float n1 = fbm(vec3(uv * 1.8 * breathScale, t));
    // Secondary layer — finer detail, different drift
    float n2 = fbm(vec3(uv * 3.5 * breathScale + 100.0, t * 1.4 + 50.0));
    // Tertiary layer — ultra-large cloud shapes
    float n3 = fbm(vec3(uv * 0.6 * breathScale - 40.0, t * 0.5 + 30.0));

    float fog = n1 * 0.5 + n2 * 0.25 + n3 * 0.25;
    fog = fog * 0.5 + 0.5;                                 // remap -1..1 → 0..1
    fog = smoothstep(0.35, 0.75, fog);                      // contrast push

    /* ── Base colour: #000000 → #050505 ── */
    vec3 baseDark  = vec3(0.0);
    vec3 baseLight = vec3(0.02);
    vec3 col = mix(baseDark, baseLight, fog);

    /* ── Teal glow in brighter bands (10-20 % opacity) ── */
    vec3 teal = vec3(0.0, 1.0, 1.0);
    float tealMask = smoothstep(0.5, 0.9, fog) * breathAlpha;
    col += teal * tealMask * 0.15;                          // ~15 % peak

    /* ── Vignette ── */
    vec2 vigUv = vUv * 2.0 - 1.0;
    float vig = 1.0 - dot(vigUv * 0.5, vigUv * 0.5);
    vig = smoothstep(0.0, 0.7, vig);
    col *= vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ────────────────────── React component ────────────────────── */

function FogPlane() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock, size }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
    matRef.current.uniforms.uResolution.value.set(size.width, size.height);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={fogVertex}
        fragmentShader={fogFragment}
        uniforms={{
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(1920, 1080) },
        }}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

export function VolumetricHaze() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        orthographic
        camera={{ zoom: 1, near: 0.01, far: 10, position: [0, 0, 1] }}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        style={{ width: "100%", height: "100%" }}
      >
        <FogPlane />

        {/* Bloom — high threshold so only the teal highlights glow */}
        <EffectComposer enableNormalPass={false}>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.9}
            blendFunction={BlendFunction.SCREEN}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
