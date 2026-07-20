import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const StarryShaderMaterial = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#0d1117") },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;

    // Pseudo-random function
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    // Smooth noise
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

    // Fractional Brownian Motion
    float fbm(vec2 p) {
      float f = 0.0;
      float w = 0.5;
      for (int i = 0; i < 5; i++) {
        f += w * noise(p);
        p *= 2.0;
        w *= 0.5;
      }
      return f;
    }

    void main() {
      vec2 uv = vUv * 3.0; // Scale
      uv.y -= uTime * 0.02; // Slow drift

      float n = fbm(uv + fbm(uv * 2.0 - uTime * 0.05));
      
      // Starry dust
      float stars = hash(vUv * 100.0);
      stars = smoothstep(0.98, 1.0, stars) * sin(uTime * 2.0 + hash(vUv)*10.0) * 0.5 + 0.5;
      stars *= smoothstep(0.98, 1.0, hash(vUv * 100.0));

      vec3 finalColor = mix(uColor, vec3(0.0, 0.8, 0.6), n * 0.15); // Add faint green tint
      finalColor += vec3(stars) * 0.5;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

export function StarryBackground() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, 0, -50]}>
      <planeGeometry args={[200, 200]} />
      <shaderMaterial 
        ref={materialRef} 
        attach="material" 
        args={[StarryShaderMaterial]} 
        depthWrite={false}
      />
    </mesh>
  );
}
