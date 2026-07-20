import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import * as THREE from 'three';
import { useFBO } from '@react-three/drei';

const TEXTURE_SIZE = 128; // 128x128 = 16,384 particles
const PARTICLES_COUNT = 5000;

const computeVelocityShader = `
  uniform sampler2D tPosition;
  uniform sampler2D tVelocity;
  uniform vec3 uTarget;
  uniform float uTime;
  uniform float uDamping;
  varying vec2 vUv;

  void main() {
    vec3 pos = texture2D(tPosition, vUv).xyz;
    vec3 vel = texture2D(tVelocity, vUv).xyz;

    // Relevance weight (simulated)
    float relevance = texture2D(tVelocity, vUv).w;

    // Spring-Mass attraction
    vec3 dir = uTarget - pos;
    float dist = length(dir);
    
    // Add some noise/drift
    vec3 drift = vec3(
      sin(pos.y * 2.0 + uTime) * 0.1,
      cos(pos.x * 2.0 + uTime) * 0.1,
      sin(pos.z * 2.0 + uTime) * 0.1
    );

    vec3 force = normalize(dir) * (0.01 + relevance * 0.05) + drift * 0.01;
    
    vel += force;
    vel *= uDamping; // Damping

    gl_FragColor = vec4(vel, relevance);
  }
`;

const computePositionShader = `
  uniform sampler2D tPosition;
  uniform sampler2D tVelocity;
  varying vec2 vUv;

  void main() {
    vec4 posData = texture2D(tPosition, vUv);
    vec3 pos = posData.xyz;
    vec3 vel = texture2D(tVelocity, vUv).xyz;
    
    pos += vel * 0.016; // Time step

    gl_FragColor = vec4(pos, posData.w); // keep w for initial cluster ID or something
  }
`;

const particleVertexShader = `
  uniform sampler2D tPosition;
  varying vec2 vUv;
  varying float vRelevance;

  void main() {
    vUv = uv;
    // Calculate UV for texture lookup based on instance ID
    vec2 posUv = vec2(
      mod(float(gl_InstanceID), ${TEXTURE_SIZE}.0) / ${TEXTURE_SIZE}.0,
      floor(float(gl_InstanceID) / ${TEXTURE_SIZE}.0) / ${TEXTURE_SIZE}.0
    );

    vec4 posData = texture2D(tPosition, posUv);
    vec3 pos = posData.xyz;

    // Read relevance from position w or we could read velocity. 
    // We'll pass it simply through a varying or calculate visual effect
    vRelevance = sin(pos.x * 10.0 + pos.y * 10.0) * 0.5 + 0.5;

    // Instance matrix applies rotation/scale
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position + pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  varying vec2 vUv;
  varying float vRelevance;
  uniform vec3 uColor;

  void main() {
    // Stylized block-text fragment shader
    vec2 grid = fract(vUv * vec2(10.0, 20.0));
    float isText = step(0.2, grid.x) * step(0.2, grid.y);
    float linePattern = step(0.5, sin(vUv.y * 50.0));
    
    float alpha = isText * linePattern * (0.2 + vRelevance * 0.8);
    
    // Discard transparent pixels
    if (alpha < 0.01) discard;

    vec3 color = mix(uColor, vec3(1.0), vRelevance * 0.5);
    
    gl_FragColor = vec4(color, alpha * 0.6);
  }
`;

export function GravitationalParticles() {
  const { gl } = useThree();

  // FBOs for Ping-Pong
  const options = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType, // Needs floating point textures
  };

  const fboPos1 = useFBO(TEXTURE_SIZE, TEXTURE_SIZE, options);
  const fboPos2 = useFBO(TEXTURE_SIZE, TEXTURE_SIZE, options);
  const fboVel1 = useFBO(TEXTURE_SIZE, TEXTURE_SIZE, options);
  const fboVel2 = useFBO(TEXTURE_SIZE, TEXTURE_SIZE, options);

  const fboPosRef = useRef({ read: fboPos1, write: fboPos2 });
  const fboVelRef = useRef({ read: fboVel1, write: fboVel2 });

  // Initialization textures
  const { initPosTexture, initVelTexture } = useMemo(() => {
    const pData = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
    const vData = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

    for (let i = 0; i < PARTICLES_COUNT; i++) {
      const idx = i * 4;
      // PCA/t-SNE simulated cluster spread
      const cluster = Math.floor(Math.random() * 5);
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 10 + 5;

      pData[idx] = Math.cos(angle) * radius + (cluster * 10 - 20);
      pData[idx + 1] = (Math.random() - 0.5) * 15;
      pData[idx + 2] = Math.sin(angle) * radius + (cluster * 10 - 20);
      pData[idx + 3] = cluster;

      // Relevance weight (0 to 1)
      vData[idx + 3] = Math.random() > 0.8 ? 1.0 : 0.1;
    }

    const posTex = new THREE.DataTexture(pData, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat, THREE.FloatType);
    posTex.needsUpdate = true;
    const velTex = new THREE.DataTexture(vData, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat, THREE.FloatType);
    velTex.needsUpdate = true;

    return { initPosTexture: posTex, initVelTexture: velTex };
  }, []);

  // Compute Scene setup
  const computeScene = useMemo(() => new THREE.Scene(), []);
  const computeCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  const velMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      tPosition: { value: null },
      tVelocity: { value: null },
      uTarget: { value: new THREE.Vector3(0, 0, 0) },
      uTime: { value: 0 },
      uDamping: { value: 0.98 },
    },
    vertexShader: `varying vec2 vUv; void main() { gl_Position = vec4(position, 1.0); vUv = uv; }`,
    fragmentShader: computeVelocityShader,
  }), []);

  const posMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      tPosition: { value: null },
      tVelocity: { value: null },
    },
    vertexShader: `varying vec2 vUv; void main() { gl_Position = vec4(position, 1.0); vUv = uv; }`,
    fragmentShader: computePositionShader,
  }), []);

  const computeMesh = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(2, 2), velMat), [velMat]);
  
  useEffect(() => {
    computeScene.add(computeMesh);
    
    // Initial render to set up FBOs with initial textures
    velMat.uniforms.tPosition.value = initPosTexture;
    velMat.uniforms.tVelocity.value = initVelTexture;
    gl.setRenderTarget(fboVelRef.current.read);
    gl.render(computeScene, computeCamera);
    
    posMat.uniforms.tPosition.value = initPosTexture;
    posMat.uniforms.tVelocity.value = initVelTexture;
    computeMesh.material = posMat;
    gl.setRenderTarget(fboPosRef.current.read);
    gl.render(computeScene, computeCamera);
    
    gl.setRenderTarget(null);
  }, [gl, computeScene, computeCamera, computeMesh, initPosTexture, initVelTexture, velMat, posMat]);

  // Particle Material
  const particleMatRef = useRef<THREE.ShaderMaterial>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (instancedMeshRef.current) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < PARTICLES_COUNT; i++) {
        // Random slight rotation and scale for code cards
        dummy.position.set(0,0,0);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        dummy.scale.set(0.1 + Math.random()*0.2, 0.05 + Math.random()*0.1, 1);
        dummy.updateMatrix();
        instancedMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  useFrame((state) => {
    const { read: readPos, write: writePos } = fboPosRef.current;
    const { read: readVel, write: writeVel } = fboVelRef.current;

    // Move target based on mouse
    const targetX = (state.pointer.x * state.viewport.width) / 2;
    const targetY = (state.pointer.y * state.viewport.height) / 2;
    velMat.uniforms.uTarget.value.set(targetX, targetY, 0);
    velMat.uniforms.uTime.value = state.clock.elapsedTime;

    // 1. Compute Velocity
    computeMesh.material = velMat;
    velMat.uniforms.tPosition.value = readPos.texture;
    velMat.uniforms.tVelocity.value = readVel.texture;
    gl.setRenderTarget(writeVel);
    gl.render(computeScene, computeCamera);

    // 2. Compute Position
    computeMesh.material = posMat;
    posMat.uniforms.tPosition.value = readPos.texture;
    posMat.uniforms.tVelocity.value = writeVel.texture;
    gl.setRenderTarget(writePos);
    gl.render(computeScene, computeCamera);

    // Swap
    fboPosRef.current.read = writePos;
    fboPosRef.current.write = readPos;
    fboVelRef.current.read = writeVel;
    fboVelRef.current.write = readVel;

    // Update Particle Material
    if (particleMatRef.current) {
      particleMatRef.current.uniforms.tPosition.value = readPos.texture;
    }

    gl.setRenderTarget(null);
  });

  return (
    <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, PARTICLES_COUNT]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={particleMatRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          tPosition: { value: null },
          uColor: { value: new THREE.Color('#00E5A0') }
        }}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
      />
    </instancedMesh>
  );
}
