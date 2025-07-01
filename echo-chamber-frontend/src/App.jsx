// src/App.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Color, Vector3 } from 'three';
import './App.css';
import { AnalystSidebar } from './AnalystSidebar';

// --- STYLES ---
const styles = {
  inputContainer: {
    position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
    zIndex: 100, display: 'flex', gap: '15px', flexDirection: 'column', alignItems: 'center',
    padding: '15px 25px', background: 'rgba(25, 30, 50, 0.5)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 255, 255, 0.2)', borderRadius: '15px',
  },
  inputGroup: { display: 'flex', gap: '15px' },
  input: {
    padding: '12px 18px', border: '1px solid rgba(0, 255, 255, 0.2)', backgroundColor: 'transparent',
    color: '#e0e0e0', borderRadius: '8px', textAlign: 'center',
    fontFamily: 'Orbitron, sans-serif', fontSize: '16px', width: '180px',
  },
  button: {
    padding: '12px 30px', border: '1px solid #00ffff', backgroundColor: 'rgba(0, 255, 255, 0.1)',
    color: '#00ffff', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif',
    fontSize: '16px', letterSpacing: '1px', transition: 'all 0.2s ease',
  }
};

// --- CHILD COMPONENTS ---

function SentimentOrb({ liveData, ticker, onOrbClick }) {
  const meshRef = useRef();
  const materialRef = useRef();
  const negativeColor = useRef(new Color('#ff4d4d')).current;
  const neutralColor = useRef(new Color('#666666')).current;
  const positiveColor = useRef(new Color('#4dff4d')).current;

  useFrame((state, delta) => {
    if (!materialRef.current) return;
    
    // Default to neutral if no data
    const score = liveData ? liveData.averageSentiment : 0;
    const articleCount = liveData ? liveData.articleCount : 0;

    const pulseSpeed = 1 + (articleCount / 100);
    const pulse = Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.05 + 1;
    meshRef.current.scale.set(pulse, pulse, pulse);
    
    const targetColor = new Color();
    if (score < 0) {
      targetColor.lerpColors(neutralColor, negativeColor, -score);
    } else {
      targetColor.lerpColors(neutralColor, positiveColor, score);
    }
    materialRef.current.color.lerp(targetColor, delta * 2);
    materialRef.current.emissive.lerp(targetColor, delta * 2);
  });

  return (
    <group onClick={onOrbClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial ref={materialRef} color="grey" emissive="grey" emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      <Text font="/Orbitron-Bold.ttf" position={[0, 1.5, 0]} fontSize={0.35} color="white" anchorX="center">{ticker}</Text>
      {!liveData ? (
        <Text font="/Inter-Bold.ttf" position={[0, 0, 0]} fontSize={0.2} color="#aaa" anchorX="center">
          Analyzing...
        </Text>
      ) : (
        <Text font="/Inter-Bold.ttf" position={[0, -1.5, 0]} fontSize={0.25} color="white" anchorX="center">{liveData.averageSentiment.toFixed(3)}</Text>
      )}
    </group>
  );
}

function TugOfWar({ data1, data2 }) {
  const markerRef = useRef();
  const maxDistance = 2.5;

  useFrame(() => {
    if (!markerRef.current || !data1 || !data2) return;
    const sentimentDifference = data1.averageSentiment - data2.averageSentiment;
    const winPercentage = sentimentDifference / 2.0;
    const markerPositionX = winPercentage * -maxDistance;
    const targetPosition = new Vector3(markerPositionX, 0, 0);
    markerRef.current.position.lerp(targetPosition, 0.05);
  });

  if (!data1 || !data2) return null;

  return (
    <group>
      <mesh position={[0, 0, 0]} rotation-z={Math.PI / 2}>
         <cylinderGeometry args={[0.02, 0.02, 5]} />
         <meshStandardMaterial color="#666" emissive="#00ffff" emissiveIntensity={0.25} toneMapped={false} />
      </mesh>
      <mesh ref={markerRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="white" emissive="#00ffff" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

function SocketConnection({ ticker, onDataReceived }) {
  useEffect(() => {
    if (!ticker) return;
    const socket = new WebSocket(`ws://localhost:8000/ws/sentiment/${ticker}`);
    socket.onopen = () => console.log(`Connection opened for ${ticker}`);
    socket.onmessage = (event) => onDataReceived(JSON.parse(event.data));
    socket.onerror = (err) => console.error(`WebSocket error for ${ticker}:`, err);
    return () => {
      console.log(`Closing connection for ${ticker}`);
      socket.close();
    };
  }, [ticker, onDataReceived]);

  return null;
}

// --- MAIN APP COMPONENT ---

export default function App() {
  const [tickers, setTickers] = useState(['', '']);
  const [inputs, setInputs] = useState(['', '']);
  const [data, setData] = useState([null, null]);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const handleAnalyze = () => {
    // Only set tickers if the input is different, to avoid unnecessary re-renders
    if (inputs[0] !== tickers[0] || inputs[1] !== tickers[1]) {
      setData([null, null]); 
      setTickers([...inputs].map(t => t.toUpperCase()));
    }
  };
  
  // Using useCallback ensures that these functions have a stable reference across re-renders,
  // which is the key to preventing the infinite loop in the SocketConnection component.
  const updateDataSlot0 = useCallback((newData) => {
    setData(currentData => [newData, currentData[1]]);
  }, []); 

  const updateDataSlot1 = useCallback((newData) => {
    setData(currentData => [currentData[0], newData]);
  }, []);

  const handleOrbClick = async (ticker) => {
    if (!ticker || isSummarizing) return;
    setShowSidebar(true);
    setIsSummarizing(true);
    try {
      const response = await fetch(`http://localhost:8000/summarize/${ticker}`);
      const result = await response.json();
      setSummary(result.summary);
    } catch (error) {
      console.error("Failed to fetch summary:", error);
      setSummary("Could not retrieve analysis.");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <>
      <AnalystSidebar 
        isVisible={showSidebar}
        summary={summary} 
        isLoading={isSummarizing}
        onClose={() => setShowSidebar(false)}
      />
      <div style={styles.inputContainer}>
        <div style={styles.inputGroup}>
          <input type="text" value={inputs[0]} onChange={(e) => setInputs([e.target.value, inputs[1]])} placeholder="Ticker 1" style={styles.input} />
          <input type="text" value={inputs[1]} onChange={(e) => setInputs([inputs[0], e.target.value])} placeholder="Ticker 2" style={styles.input} />
        </div>
        <button 
          onClick={handleAnalyze} 
          style={styles.button}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 255, 255, 0.2)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.5)'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 255, 255, 0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          ANALYZE BATTLE
        </button>
      </div>

      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.1} />
        <pointLight position={[0, 0, 5]} intensity={5} color="#00ffff" />
        
        <SocketConnection ticker={tickers[0]} onDataReceived={updateDataSlot0} />
        <SocketConnection ticker={tickers[1]} onDataReceived={updateDataSlot1} />

        <group position={[-2.5, 0, 0]}>
          <SentimentOrb liveData={data[0]} ticker={tickers[0]} onOrbClick={() => handleOrbClick(tickers[0])} />
        </group>
        <group position={[2.5, 0, 0]}>
          <SentimentOrb liveData={data[1]} ticker={tickers[1]} onOrbClick={() => handleOrbClick(tickers[1])} />
        </group>

        <TugOfWar data1={data[0]} data2={data[1]} />
        
        <OrbitControls enablePan={false} enableZoom={false} minAzimuthAngle={-Math.PI/8} maxAzimuthAngle={Math.PI/8} minPolarAngle={Math.PI/2.5} maxPolarAngle={Math.PI/1.5} />
        
        <EffectComposer>
            <Bloom intensity={0.5} kernelSize={3} luminanceThreshold={0.1} luminanceSmoothing={0.9} />
            <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </EffectComposer>
      </Canvas>
    </>
  );
}