import { Canvas } from '@react-three/fiber';
import { StarryBackground } from './webgl/starry-background';
import { GravitationalParticles } from './webgl/gravitational-particles';
import { CinematicLens } from './webgl/cinematic-lens';

export function SemanticLatentSpace() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, 50], fov: 45 }}
        gl={{ antialias: false, alpha: true }}
      >
        <color attach="background" args={['#0d1117']} />
        
        <StarryBackground />
        <GravitationalParticles />
        <CinematicLens />
        
      </Canvas>
    </div>
  );
}
