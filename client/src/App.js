import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

const MORSE = {
  '.-':'A','-.':'B','-.-.':'C','-..':'D','.':'E','..-.':'F',
  '--.':'G','....':'H','..':'I','.---':'J','-.-':'K','.-..':'L',
  '--':'M','-.':'N','---':'O','.--.':'P','--.-':'Q','.-.':'R',
  '...':'S','-':'T','..-':'U','...-':'V','.--':'W','-..-':'X',
  '-.--':'Y','--..':'Z','-----':'0','.----':'1','..---':'2',
  '...--':'3','....-':'4','.....':'5','-....':'6','--...':'7',
  '---..':'8','----.':'9'
};

const LEFT_EYE_TOP    = [386, 387, 388];
const LEFT_EYE_BOTTOM = [374, 373, 390];
const RIGHT_EYE_TOP    = [159, 160, 161];
const RIGHT_EYE_BOTTOM = [145, 144, 163];

function eyeOpenness(topPts, botPts) {
  let total = 0;
  for (let i = 0; i < topPts.length; i++) {
    total += Math.abs(topPts[i].y - botPts[i].y);
  }
  return total / topPts.length;
}

export default function App() {
  const [composed, setComposed]     = useState('');
  const [morse, setMorse]           = useState('');
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [status, setStatus]         = useState('Click "Start Camera" to begin');
  const [camActive, setCamActive]   = useState(false);
  const [earValue, setEarValue]     = useState(0);
  const [mode, setMode]             = useState('spacebar');

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const detectorRef = useRef(null);
  const blinkStart  = useRef(0);
  const wasBlinking = useRef(false);
  const letterTimer = useRef(null);
  const morseRef    = useRef('');
  const animFrame   = useRef(null);

  const DOT_MAX    = 200;
  const LETTER_GAP = 1500;
  const EYE_CLOSED = 8;

  useEffect(() => { morseRef.current = morse; }, [morse]);

  const onBlinkStart = useCallback(() => {
    if (wasBlinking.current) return;
    wasBlinking.current = true;
    blinkStart.current = Date.now();
    setIsBlinking(true);
    clearTimeout(letterTimer.current);
  }, []);

  const onBlinkEnd = useCallback(() => {
    if (!wasBlinking.current) return;
    wasBlinking.current = false;
    const dur = Date.now() - blinkStart.current;
    setIsBlinking(false);
    setBlinkCount(c => c + 1);

    const sym = dur <= DOT_MAX ? '.' : '-';

    setMorse(prev => {
      const next = prev + sym;
      morseRef.current = next;
      setStatus('Buffer: ' + next + '  →  ' + (MORSE[next] || '?'));
      return next;
    });

    letterTimer.current = setTimeout(() => {
      const current = morseRef.current;
      if (!current) return;
      const letter = MORSE[current];
      if (letter) {
        setComposed(c => c + letter);
        setStatus('✓ Letter: "' + letter + '"');
        axios.post('http://localhost:5000/api/messages', {
          message: letter,
          timestamp: new Date().toISOString()
        }).catch(() => {});
      } else {
        setStatus('Unknown: ' + current + ' — cleared');
      }
      setMorse('');
      morseRef.current = '';
    }, LETTER_GAP);
  }, []);

  const loadModel = async () => {
    setStatus('Loading AI model...');
    await tf.setBackend('webgl');
    await tf.ready();
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const detector = await faceLandmarksDetection.createDetector(model, {
      runtime: 'mediapipe',
      solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
      refineLandmarks: false,
      maxFaces: 1
    });
    detectorRef.current = detector;
    setStatus('Model ready — starting camera...');
    return detector;
  };

  const startCamera = async () => {
    try {
      const detector = await loadModel();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
        setCamActive(true);
        setMode('webcam');
        setStatus('Webcam active — blink to type!');
        runDetection(detector);
      };
    } catch (e) {
      console.error('Camera error:', e);
      setStatus('Camera error — using spacebar mode');
    }
  };

  const runDetection = (detector) => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');

    const detect = async () => {
      if (!video || video.readyState < 2) {
        animFrame.current = requestAnimationFrame(detect);
        return;
      }

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        const faces = await detector.estimateFaces(video, { flipHorizontal: false });

        if (faces.length > 0) {
          const kp = faces[0].keypoints;

          const leftOpen = eyeOpenness(
            LEFT_EYE_TOP.map(i => kp[i]),
            LEFT_EYE_BOTTOM.map(i => kp[i])
          );
          const rightOpen = eyeOpenness(
            RIGHT_EYE_TOP.map(i => kp[i]),
            RIGHT_EYE_BOTTOM.map(i => kp[i])
          );
          const avgOpen = (leftOpen + rightOpen) / 2;

          console.log('Eye openness:', avgOpen.toFixed(2));
          setEarValue(avgOpen.toFixed(2));

          // Draw green dots on eyelid points
          [...LEFT_EYE_TOP, ...LEFT_EYE_BOTTOM,
           ...RIGHT_EYE_TOP, ...RIGHT_EYE_BOTTOM].forEach(i => {
            const p = kp[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = avgOpen < EYE_CLOSED ? '#e74c3c' : '#00ffcc';
            ctx.fill();
          });

          if (avgOpen < EYE_CLOSED) {
            onBlinkStart();
          } else {
            onBlinkEnd();
          }

        } else {
          setStatus('No face detected — move closer');
        }
      } catch (e) {
        console.error('Detection error:', e);
      }

      animFrame.current = requestAnimationFrame(detect);
    };

    animFrame.current = requestAnimationFrame(detect);
  };

  const stopCamera = () => {
    cancelAnimationFrame(animFrame.current);
    const stream = videoRef.current?.srcObject;
    stream?.getTracks().forEach(t => t.stop());
    setCamActive(false);
    setMode('spacebar');
    setStatus('Camera stopped — spacebar mode active');
  };

  useEffect(() => {
    if (mode !== 'spacebar') return;
    const down = (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); onBlinkStart(); } };
    const up   = (e) => { if (e.code === 'Space') { e.preventDefault(); onBlinkEnd(); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [mode, onBlinkStart, onBlinkEnd]);

  const speakText = () => {
    const t = composed.trim();
    if (!t) return;
    const u = new SpeechSynthesisUtterance(t);
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0a', color:'#f0f0f0',
                  fontFamily:'monospace', display:'flex', flexDirection:'column',
                  alignItems:'center', padding:'32px 16px', gap:'20px' }}>

      <h1 style={{ fontSize:'2.2rem', color:'#00ffcc', letterSpacing:'0.1em', margin:0 }}>
        BlinkSpeak
      </h1>
      <p style={{ color:'#555', fontSize:'0.7rem', letterSpacing:'0.25em', margin:0 }}>
        MORSE CODE VIA EYE BLINK · ALS COMMUNICATION SYSTEM
      </p>

      {/* Camera feed */}
      <div style={{ position:'relative', width:'320px', height:'240px',
                    background:'#111', borderRadius:'8px', overflow:'hidden',
                    border:'2px solid ' + (camActive ? '#00ffcc' : '#222') }}>
        <video ref={videoRef}
          style={{ width:'100%', height:'100%', objectFit:'cover',
                   transform:'scaleX(-1)', display:'block' }}
          muted playsInline/>
        <canvas ref={canvasRef}
          style={{ position:'absolute', inset:0, width:'100%',
                   height:'100%', transform:'scaleX(-1)' }}/>
        {!camActive && (
          <div style={{ position:'absolute', inset:0, display:'flex',
                        alignItems:'center', justifyContent:'center' }}>
            <span style={{ color:'#444', fontSize:'0.75rem' }}>Camera off</span>
          </div>
        )}
        {camActive && (
          <div style={{ position:'absolute', top:8, right:8,
                        background:'rgba(0,0,0,0.7)', border:'1px solid #00ffcc',
                        borderRadius:'4px', padding:'3px 8px',
                        fontSize:'0.6rem', color:'#00ffcc' }}>
            Openness: {earValue}
          </div>
        )}
      </div>

      {/* Camera controls */}
      <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
        {!camActive ? (
          <button onClick={startCamera}
            style={{ background:'#00ffcc', border:'none', color:'#000',
                     padding:'10px 24px', cursor:'pointer', fontFamily:'monospace',
                     fontSize:'0.8rem', borderRadius:'4px', fontWeight:'bold' }}>
            Start Camera
          </button>
        ) : (
          <button onClick={stopCamera}
            style={{ background:'transparent', border:'1px solid #e74c3c',
                     color:'#e74c3c', padding:'10px 24px', cursor:'pointer',
                     fontFamily:'monospace', fontSize:'0.8rem', borderRadius:'4px' }}>
            Stop Camera
          </button>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:'8px',
                      background:'#1a1a1a', border:'1px solid #333',
                      borderRadius:'4px', padding:'8px 12px' }}>
          <div style={{ width:'8px', height:'8px', borderRadius:'50%',
                        background: camActive ? '#00ffcc' : '#e67e22' }}/>
          <span style={{ fontSize:'0.7rem', color:'#888' }}>
            {camActive ? 'Webcam mode' : 'Spacebar mode'}
          </span>
        </div>
      </div>

      {/* Blink lamp */}
      <div style={{ width:'100px', height:'100px', borderRadius:'50%',
                    background: isBlinking ? '#e74c3c' : '#1a1a1a',
                    border:'3px solid ' + (isBlinking ? '#e74c3c' : '#2a2a2a'),
                    boxShadow: isBlinking ? '0 0 40px rgba(231,76,60,0.7)' : 'none',
                    transition:'all 0.06s', display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:'0.6rem', color:'#444' }}>
        {isBlinking ? '●' : 'EYE'}
      </div>

      {/* Morse buffer */}
      <div style={{ fontSize:'2rem', letterSpacing:'0.4em',
                    color:'#00ffcc', minHeight:'48px' }}>
        {morse || '· · ·'}
      </div>

      {/* Status */}
      <div style={{ fontSize:'0.72rem', color:'#666',
                    letterSpacing:'0.08em', textAlign:'center' }}>
        {status}
      </div>

      {/* Composed text */}
      <div style={{ width:'100%', maxWidth:'600px', minHeight:'80px',
                    background:'#111', border:'1px solid #222', borderRadius:'8px',
                    padding:'20px', fontSize:'1.8rem', fontFamily:'Georgia, serif',
                    color:'white', wordBreak:'break-word', lineHeight:1.4 }}>
        {composed ||
          <span style={{ color:'#333', fontSize:'1rem' }}>
            Your message will appear here...
          </span>}
        <span style={{ borderRight:'3px solid #00ffcc', marginLeft:'2px',
                       animation:'blink 1s step-end infinite' }}/>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center' }}>
        <span style={{ color:'#444', fontSize:'0.72rem',
                       display:'flex', alignItems:'center' }}>
          Blinks: {blinkCount}
        </span>
        <button onClick={() => { setComposed(''); setMorse(''); }}
          style={{ background:'transparent', border:'1px solid #2a2a2a', color:'#777',
                   padding:'8px 16px', cursor:'pointer', fontFamily:'monospace',
                   fontSize:'0.72rem', borderRadius:'4px' }}>
          ✕ Clear
        </button>
        <button onClick={() => setComposed(c => c.trimEnd().slice(0, -1))}
          style={{ background:'transparent', border:'1px solid #2a2a2a', color:'#777',
                   padding:'8px 16px', cursor:'pointer', fontFamily:'monospace',
                   fontSize:'0.72rem', borderRadius:'4px' }}>
          ⌫ Delete
        </button>
        <button onClick={() => setComposed(c => c + ' ')}
          style={{ background:'transparent', border:'1px solid #2a2a2a', color:'#777',
                   padding:'8px 16px', cursor:'pointer', fontFamily:'monospace',
                   fontSize:'0.72rem', borderRadius:'4px' }}>
          Space
        </button>
        <button onClick={speakText}
          style={{ background:'#27ae60', border:'none', color:'white',
                   padding:'8px 20px', cursor:'pointer', fontFamily:'monospace',
                   fontSize:'0.72rem', borderRadius:'4px' }}>
          🔊 Speak
        </button>
      </div>

      {/* Morse reference */}
      <div style={{ width:'100%', maxWidth:'600px', background:'#111',
                    border:'1px solid #1a1a1a', borderRadius:'8px', padding:'16px' }}>
        <div style={{ fontSize:'0.6rem', letterSpacing:'0.2em', color:'#444',
                      marginBottom:'12px', textTransform:'uppercase' }}>
          Morse Reference
        </div>
        <div style={{ display:'grid',
                      gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))',
                      gap:'6px' }}>
          {Object.entries(MORSE).map(([code, char]) => (
            <div key={char}
              style={{ display:'flex', justifyContent:'space-between',
                       padding:'4px 8px', background:'#0f0f0f',
                       borderRadius:'3px', fontSize:'0.68rem' }}>
              <span style={{ color:'#00ffcc' }}>{char}</span>
              <span style={{ color:'#444', letterSpacing:'0.1em' }}>{code}</span>
            </div>
          ))}
        </div>
      </div>

      <p style={{ color:'#333', fontSize:'0.65rem', textAlign:'center' }}>
        Webcam: short blink = dot · long blink = dash · pause 1.5s = commit letter
        <br/>Spacebar mode: hold SPACE to simulate blink
      </p>

      <style>{'@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }'}</style>
    </div>
  );
}