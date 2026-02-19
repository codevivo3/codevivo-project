'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { useMemo, useRef, Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function LogoModel() {
  const { scene } = useGLTF('/models/3D-logo-color.glb');

  console.log('Raw scene:', scene);

  return (
    <primitive
      object={scene}
      scale={[0.01, 0.01, 0.01]} // force shrink
      position={[0, -1.7, 0]} // fine-tuned vertical centering
    />
  );
}

function TransparentBackground() {
  const { gl } = useThree();
  gl.setClearColor(0x000000, 0);
  return null;
}

export default function HeroLogo3D() {
  return (
    <div className='aspect-square w-[320px] md:w-[420px]'>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6], fov: 35, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <TransparentBackground />

        <ambientLight intensity={0.8} />
        <spotLight
          position={[0, 0, 8]}
          angle={0.4}
          penumbra={0.6}
          intensity={2.5}
        />
        <directionalLight position={[4, 4, 4]} intensity={1.8} />

        <Suspense fallback={null}>
          <LogoModel />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/3D-logo-color.glb');
