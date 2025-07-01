// src/TugOfWar.jsx

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Cylinder, Sphere } from '@drei';
import { Vector3 } from 'three';

export function TugOfWar({ data1, data2 }) {
  const markerRef = useRef();
  
  // The maximum distance the marker can move from the center
  const maxDistance = 2.5; 

  useFrame(() => {
    if (!markerRef.current || !data1 || !data2) return;

    // --- THE NEW, CORRECTED LOGIC ---

    // 1. Calculate the difference. A positive value means data1 (left orb) is winning.
    const sentimentDifference = data1.averageSentiment - data2.averageSentiment;
    
    // 2. Normalize the difference to a "win percentage" between -1.0 and 1.0
    const winPercentage = sentimentDifference / 2.0;

    // 3. Calculate the marker's target position.
    // We multiply by -maxDistance because a positive win for the left orb
    // needs to move the marker in the negative X direction.
    const markerPositionX = winPercentage * -maxDistance;

    // --- END NEW LOGIC ---

    const targetPosition = new Vector3(markerPositionX, 0, 0);
    markerRef.current.position.lerp(targetPosition, 0.05);
  });

  if (!data1 || !data2) return null;

  return (
    <group>
      <mesh position={[0, 0, 0]} rotation-z={Math.PI / 2}>
         <cylinderGeometry args={[0.02, 0.02, 5]} />
         <meshStandardMaterial color="#666" emissive="#fff" emissiveIntensity={0.1} toneMapped={false} />
      </mesh>
      <mesh ref={markerRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  );
}