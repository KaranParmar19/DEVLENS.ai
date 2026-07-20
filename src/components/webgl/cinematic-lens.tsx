import React, { forwardRef, useMemo } from 'react';
import { EffectComposer, ChromaticAberration, Bloom } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';

export function CinematicLens() {
  return (
    <EffectComposer disableNormalPass>
      <Bloom 
        intensity={1.5} 
        luminanceThreshold={0.8} 
        luminanceSmoothing={0.9} 
        blendFunction={BlendFunction.SCREEN} 
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.002, 0.002)}
        radialModulation={true}
        modulationOffset={0.5}
      />
    </EffectComposer>
  );
}
