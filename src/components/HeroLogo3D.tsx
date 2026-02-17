'use client';

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

function LogoModel() {
  const { scene } = useGLTF('/models/3D-logo-color.glb');
  const groupRef = useRef<THREE.Group>(null);
  const hoveredRef = useRef(false);

  const model = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        obj.frustumCulled = false;
        obj.material = obj.material.clone();
        obj.material.userData.baseMetalness = obj.material.metalness;
        obj.material.userData.baseRoughness = obj.material.roughness;
      }
    });

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const hasFiniteCenter =
      Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(center.z);
    if (hasFiniteCenter) {
      cloned.position.sub(center);
    }

    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 2.75;
    const scaleFactor = maxDim > 0 ? targetSize / maxDim : 1;
    cloned.scale.setScalar(scaleFactor);
    return cloned;
  }, [scene]);

  useFrame(() => {
    if (!groupRef.current) return;

    groupRef.current.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        const mat = obj.material;
        if (hoveredRef.current) {
          mat.metalness = Math.min(1, (mat.userData.baseMetalness ?? mat.metalness) + 0.2);
          mat.roughness = Math.max(0, (mat.userData.baseRoughness ?? mat.roughness) - 0.15);
        } else {
          if (mat.userData.baseMetalness !== undefined) {
            mat.metalness = mat.userData.baseMetalness;
          }
          if (mat.userData.baseRoughness !== undefined) {
            mat.roughness = mat.userData.baseRoughness;
          }
        }
      }
    });
  });

  return (
    <group
      ref={groupRef}
      rotation={[0, 0, 0]}
      onPointerOver={() => {
        hoveredRef.current = true;
      }}
      onPointerOut={() => {
        hoveredRef.current = false;
      }}
    >
      <primitive object={model} />
    </group>
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
        camera={{ position: [0, 0, 6], fov: 28 }}
        gl={{ antialias: true, alpha: true }}
        style={{ cursor: 'pointer' }}
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

        <Environment preset='city' />

        <LogoModel />
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/3D-logo-color.glb');
