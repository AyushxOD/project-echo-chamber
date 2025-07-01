import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Color, Vector3 } from 'three';
import './App.css';
import { AnalystSidebar } from './AnalystSidebar';

// --- STYLES (Includes new styles for the timeline) ---
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
  },
  timelineContainer: {
    position: 'absolute', bottom: '180px', left: '50%', transform: 'translateX(-50%)',
    zIndex: 100, display: 'flex', gap: '20px', alignItems: 'center',
    padding: '10px 20px', background: 'rgba(25, 30, 50, 0.5)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(0, 255, 255, 0.2)', borderRadius: '15px', color: 'white',
    fontFamily: 'Orbitron, sans-serif'
  },
  slider: {
    width: '300px',
  },
  liveButton: {
    padding: '8px 12px', border: '1px solid #ff4d4d', backgroundColor: 'rgba(255, 77, 77, 0.1)',
    color: '#ff4d4d', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Orbitron, sans-serif',
    fontSize: '14px', transition: 'all 0.2s ease',
  }
};


// --- NEW GOD-MODE ORB ---
function SentimentOrb({ liveData, ticker, onOrbClick }) {
  const groupRef = useRef();
  const innerCoreRef = useRef();
  const outerShieldRef = useRef();
  
  const negativeColor = useRef(new Color('#ff4d4d')).current;
  const neutralColor = useRef(new Color('#888')).current;
  const positiveColor = useRef(new Color('#4dff4d')).current;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Rotate the whole group for a cool effect
    groupRef.current.rotation.y += delta * 0.1;

    // Default to neutral if no data
    const score = liveData ? liveData.averageSentiment : 0;
    const articleCount = liveData ? liveData.articleCount : 0;

    const pulseSpeed = 1 + (articleCount / 100);
    const pulse = Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.05 + 1;
    groupRef.current.scale.set(pulse, pulse, pulse);
    
    const targetColor = new Color();
    if (score < 0) {
      targetColor.lerpColors(neutralColor, negativeColor, -score);
    } else {
      targetColor.lerpColors(neutralColor, positiveColor, score);
    }
    
    if(innerCoreRef.current && outerShieldRef.current) {
        innerCoreRef.current.color.lerp(targetColor, delta * 2);
        innerCoreRef.current.emissive.lerp(targetColor, delta * 2);
        outerShieldRef.current.color.lerp(targetColor, delta * 2);
    }
  });

  if (!ticker) return null;

  return (
    <group ref={groupRef} onClick={onOrbClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
      {!liveData ? (
        <Text font="/Orbitron-Bold.ttf" fontSize={0.2} color="#aaa" anchorX="center">ANALYZING {ticker}...</Text>
      ) : (
        <>
          {/* Outer Shield */}
          <mesh>
            <sphereGeometry args={[1, 64, 64]} />
            <meshStandardMaterial ref={outerShieldRef} transparent opacity={0.3} emissiveIntensity={0.2} toneMapped={false} />
          </mesh>
          {/* Inner Core */}
          <mesh scale={0.6}>
            <sphereGeometry args={[1, 64, 64]} />
            <meshStandardMaterial ref={innerCoreRef} emissiveIntensity={2.5} toneMapped={false} />
          </mesh>
          
          <Text font="/Orbitron-Bold.ttf" position={[0, 1.5, 0]} fontSize={0.35} color="white" anchorX="center">{ticker}</Text>
          <Text font="/Inter-Bold.ttf" position={[0, -1.5, 0]} fontSize={0.25} color="white" anchorX="center">{liveData.averageSentiment.toFixed(3)}</Text>
        </>
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
  const [liveData, setLiveData] = useState([null, null]);
  const [history, setHistory] = useState([[], []]);
  const [timeTravelData, setTimeTravelData] = useState([null, null]);
  const [isTimeTraveling, setIsTimeTraveling] = useState(false);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const handleAnalyze = async () => {
    if (!inputs[0] && !inputs[1]) return;
    
    const newTickers = [...inputs].map(t => t.toUpperCase());
    setIsTimeTraveling(false);
    setTimeTravelData([null, null]);
    setLiveData([null, null]);
    setHistory([[], []]);
    setTickers(newTickers);

    const historyPromises = newTickers.map(ticker => 
      ticker ? fetch(`http://localhost:8000/history/${ticker}`).then(res => res.json()) : Promise.resolve([])
    );
    try {
        const [history1, history2] = await Promise.all(historyPromises);
        setHistory([history1, history2]);
        const maxLen = Math.max(history1.length, history2.length) -1;
        setSliderIndex(maxLen >= 0 ? maxLen : 0);
    } catch(error) {
        console.error("Failed to fetch history:", error);
    }
  };
  
  const updateLiveData0 = useCallback((newData) => {
    setLiveData(currentData => [newData, currentData[1]]);
  }, []); 

  const updateLiveData1 = useCallback((newData) => {
    setLiveData(currentData => [currentData[0], newData]);
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

  const handleTimeTravel = (e) => {
    const newIndex = parseInt(e.target.value, 10);
    setSliderIndex(newIndex);
    setIsTimeTraveling(true);
    const newTimeData = [null, null];
    
    if (history[0][newIndex]) {
      newTimeData[0] = { averageSentiment: history[0][newIndex].sentiment_score, articleCount: 100 };
    }
    if (history[1][newIndex]) {
      newTimeData[1] = { averageSentiment: history[1][newIndex].sentiment_score, articleCount: 100 };
    }
    setTimeTravelData(newTimeData);
  };
  
  const returnToLive = () => {
    setIsTimeTraveling(false);
    const maxLen = Math.max(history[0].length, history[1].length) -1;
    setSliderIndex(maxLen >= 0 ? maxLen : 0);
  };
  
  const displayData = isTimeTraveling ? timeTravelData : liveData;
  const hasHistory = history[0].length > 0 || history[1].length > 0;
  const sliderMax = Math.max(history[0].length, history[1].length) - 1;
  const currentDate = hasHistory && isTimeTraveling && history[0][sliderIndex] ? history[0][sliderIndex].record_date : "LIVE";

  return (
    <>
      <AnalystSidebar isVisible={showSidebar} summary={summary} isLoading={isSummarizing} onClose={() => setShowSidebar(false)} />
      
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
      
      {hasHistory && sliderMax > 0 && (
        <div style={styles.timelineContainer}>
          <button onClick={returnToLive} style={styles.liveButton} disabled={!isTimeTraveling}>LIVE</button>
          <span>{currentDate}</span>
          <input 
            type="range"
            min="0"
            max={sliderMax}
            value={sliderIndex}
            onInput={handleTimeTravel}
            style={styles.slider}
          />
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.1} />
        <pointLight position={[0, 0, 5]} intensity={5} color="#00ffff" />
        
        <SocketConnection ticker={tickers[0]} onDataReceived={updateLiveData0} />
        <SocketConnection ticker={tickers[1]} onDataReceived={updateLiveData1} />

        <group position={[-2.5, 0, 0]}>
          <SentimentOrb liveData={displayData[0]} ticker={tickers[0]} onOrbClick={() => handleOrbClick(tickers[0])} />
        </group>
        <group position={[2.5, 0, 0]}>
          <SentimentOrb liveData={displayData[1]} ticker={tickers[1]} onOrbClick={() => handleOrbClick(tickers[1])} />
        </group>

        <TugOfWar data1={displayData[0]} data2={displayData[1]} />
        
        <OrbitControls enablePan={false} enableZoom={false} minAzimuthAngle={-Math.PI/8} maxAzimuthAngle={Math.PI/8} minPolarAngle={Math.PI/2.5} maxPolarAngle={Math.PI/1.5} />
        
        <EffectComposer>
            <Bloom intensity={0.5} kernelSize={3} luminanceThreshold={0.1} luminanceSmoothing={0.9} />
            <Vignette eskil={false} offset={0.1} darkness={0.5} />
        </EffectComposer>
      </Canvas>
    </>
  );
}