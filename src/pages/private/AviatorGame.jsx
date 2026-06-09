import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import propeller from '../../assets/images/propeller.png';
import rocketSprite from '../../assets/images/rocket2.png';
import rocketGif from '../../assets/images/rocket5.gif';

const MAX_MULTIPLIER = 50;
const FAKE_NAMES = [
  '1***4', '1***f', '1***5', '2***k', '8***p', '7***m',
  '3***r', '9***x', '4***z', '0***t', '5***h', '6***v',
  'k***7', 'x***2', 'j***9', 'p***3', 'm***8', 'n***1',
  'r***6', 't***0', 'v***4', 'w***5', 's***3', 'l***2',
  'h***7', 'b***9', 'g***0', 'd***5', 'f***1', 'c***6'
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function calcMultiplier(t) {
  return 1 + 0.06 * t + Math.pow(0.06 * t, 2) - Math.pow(0.04 * t, 3) + Math.pow(0.04 * t, 4);
}

class SoundManager {
  constructor() {
    this.enabled = true;
    this.audio = {};
  }
  init() {
    const files = {
      takeOff: '/sound/take_off.mp3',
      main: '/sound/main.wav',
      flewAway: '/sound/flew_away.mp3',
      cashout: '/sound/cashout.mp3',
    };
    for (const [key, src] of Object.entries(files)) {
      const el = new Audio(src);
      el.preload = 'auto';
      this.audio[key] = el;
    }
    this.audio.main.loop = true;
  }
  play(name) {
    if (!this.enabled) return;
    const el = this.audio[name];
    if (!el) return;
    try { el.currentTime = 0; el.play().catch(() => {}); } catch {}
  }
  stop(name) {
    const el = this.audio[name];
    if (!el) return;
    try { el.pause(); el.currentTime = 0; } catch {}
  }
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopAll();
    return this.enabled;
  }
  stopAll() {
    for (const el of Object.values(this.audio)) {
      try { el.pause(); el.currentTime = 0; } catch {}
    }
  }
  betPlaced() { this.play('takeOff'); }
  cashOut() { this.play('cashout'); }
  crash() { this.stop('main'); this.play('flewAway'); }
  engineHum() { this.play('main'); }
}

class ConfettiSystem {
  constructor(canvasRef) {
    this.canvasRef = canvasRef;
    this.particles = [];
    this.animId = null;
  }
  burst(count = 40) {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    const w = canvas.width;
    const colors = ['#39FF14', '#FFD700', '#FF4444', '#44AAFF', '#FF8800', '#FF44FF', '#44FF44', '#FFFFFF'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: w * 0.1 + Math.random() * w * 0.8, y: -10,
        w: 3 + Math.random() * 5, h: 3 + Math.random() * 5,
        vx: (Math.random() - 0.5) * 8, vy: 2 + Math.random() * 6,
        color: pick(colors), rot: Math.random() * 360, rotV: (Math.random() - 0.5) * 12, life: 1
      });
    }
    if (!this.animId) this.animate();
  }
  animate() {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    this.particles = this.particles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.rot += p.rotV; p.life -= 0.01;
      if (p.life <= 0) return false;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      return p.y < h + 30;
    });
    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this.animate());
    } else {
      this.animId = null;
      ctx.clearRect(0, 0, w, h);
    }
  }
  destroy() { if (this.animId) cancelAnimationFrame(this.animId); this.particles = []; }
}

function getColor(m) {
  if (m >= 20) return '#FF0040';
  if (m >= 10) return '#FF4400';
  if (m >= 5) return '#FF8800';
  if (m >= 2) return '#FFD700';
  if (m >= 1.5) return '#AAFF44';
  return '#88FF88';
}

function drawJet(ctx, x, y, angle, scale, thrust) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const s = scale || 1;
  const t = thrust || 1;

  const nose = 20 * s;
  const tail = -16 * s;
  const bodyW = 3.5 * s;

  const flameLen = 18 * s * t;
  ctx.shadowColor = '#ff6600';
  ctx.shadowBlur = 25 * s;
  const fGrad = ctx.createRadialGradient(tail, 0, 0, tail, 0, flameLen);
  fGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
  fGrad.addColorStop(0.2, 'rgba(255,220,60,0.7)');
  fGrad.addColorStop(0.5, 'rgba(255,140,20,0.35)');
  fGrad.addColorStop(1, 'rgba(200,40,0,0)');
  ctx.fillStyle = fGrad;
  ctx.beginPath();
  ctx.moveTo(tail, -bodyW * 0.2);
  ctx.quadraticCurveTo(tail - flameLen * 0.3, -bodyW * 0.4, tail - flameLen, 0);
  ctx.quadraticCurveTo(tail - flameLen * 0.3, bodyW * 0.4, tail, bodyW * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 12 * s;
  const fGrad2 = ctx.createRadialGradient(tail, 0, 0, tail, 0, flameLen * 0.5);
  fGrad2.addColorStop(0, 'rgba(255,180,40,0.3)');
  fGrad2.addColorStop(1, 'rgba(180,40,0,0)');
  ctx.fillStyle = fGrad2;
  ctx.beginPath();
  ctx.moveTo(tail, -bodyW * 0.4);
  ctx.quadraticCurveTo(tail - flameLen * 0.2, -bodyW * 0.6, tail - flameLen * 0.5, 0);
  ctx.quadraticCurveTo(tail - flameLen * 0.2, bodyW * 0.6, tail, bodyW * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  for (let i = 0; i < 5; i++) {
    const sx = tail - Math.random() * flameLen * 0.6;
    const sy = (Math.random() - 0.5) * bodyW * 1.2;
    ctx.beginPath();
    ctx.arc(sx, sy, (0.3 + Math.random() * 1) * s, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,${180 + Math.floor(Math.random() * 75)},40,${0.2 + Math.random() * 0.5})`;
    ctx.fill();
  }

  const hStabGrad = ctx.createLinearGradient(0, 0, 0, bodyW * 2.5);
  hStabGrad.addColorStop(0, '#c0c0c0');
  hStabGrad.addColorStop(0.5, '#e8e8e8');
  hStabGrad.addColorStop(1, '#a0a0a0');
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(tail + 4 * s, side * bodyW * 0.3);
    ctx.lineTo(tail - 2 * s, side * bodyW * 2.2);
    ctx.lineTo(tail + 2 * s, side * bodyW * 2.0);
    ctx.lineTo(tail + 6 * s, side * bodyW * 0.4);
    ctx.closePath();
    ctx.fillStyle = hStabGrad;
    ctx.fill();
  }

  const vTailGrad = ctx.createLinearGradient(0, -bodyW, 0, -bodyW * 3);
  vTailGrad.addColorStop(0, '#cc2222');
  vTailGrad.addColorStop(0.5, '#ee4444');
  vTailGrad.addColorStop(1, '#ff6666');
  ctx.beginPath();
  ctx.moveTo(tail + 5 * s, -bodyW * 0.3);
  ctx.lineTo(tail - 1 * s, -bodyW * 2.8);
  ctx.lineTo(tail + 3 * s, -bodyW * 2.6);
  ctx.lineTo(tail + 7 * s, -bodyW * 0.5);
  ctx.closePath();
  ctx.fillStyle = vTailGrad;
  ctx.fill();

  const wingGrad = ctx.createLinearGradient(0, 0, 0, bodyW * 3.5);
  wingGrad.addColorStop(0, '#d0d0d0');
  wingGrad.addColorStop(0.3, '#f0f0f0');
  wingGrad.addColorStop(0.7, '#e0e0e0');
  wingGrad.addColorStop(1, '#b0b0b0');
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(nose * 0.5, side * bodyW * 0.4);
    ctx.lineTo(-2 * s, side * bodyW * 3.5);
    ctx.lineTo(-6 * s, side * bodyW * 3.2);
    ctx.lineTo(nose * 0.3, side * bodyW * 0.5);
    ctx.closePath();
    ctx.fillStyle = wingGrad;
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(200,30,30,0.3)';
  ctx.lineWidth = 0.5 * s;
  for (let side = -1; side <= 1; side += 2) {
    ctx.beginPath();
    ctx.moveTo(nose * 0.4, side * bodyW * 0.5);
    ctx.lineTo(-3 * s, side * bodyW * 3.3);
    ctx.stroke();
  }

  const bodyGrad = ctx.createLinearGradient(0, -bodyW, 0, bodyW);
  bodyGrad.addColorStop(0, '#cc2222');
  bodyGrad.addColorStop(0.2, '#dd3333');
  bodyGrad.addColorStop(0.35, '#ee4444');
  bodyGrad.addColorStop(0.5, '#dd3333');
  bodyGrad.addColorStop(0.65, '#ee4444');
  bodyGrad.addColorStop(0.8, '#dd3333');
  bodyGrad.addColorStop(1, '#cc2222');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(nose, 0);
  ctx.quadraticCurveTo(nose * 0.85, -bodyW * 0.5, nose * 0.55, -bodyW);
  ctx.lineTo(tail + 4 * s, -bodyW);
  ctx.quadraticCurveTo(tail + 1 * s, -bodyW * 0.8, tail, 0);
  ctx.quadraticCurveTo(tail + 1 * s, bodyW * 0.8, tail + 4 * s, bodyW);
  ctx.lineTo(nose * 0.55, bodyW);
  ctx.quadraticCurveTo(nose * 0.85, bodyW * 0.5, nose, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(nose * 0.6, -bodyW * 0.3);
  ctx.lineTo(tail + 5 * s, -bodyW * 0.3);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1 * s;
  ctx.stroke();

  const cockpitGrad = ctx.createLinearGradient(0, -bodyW * 1.2, 0, -bodyW * 0.3);
  cockpitGrad.addColorStop(0, '#1a2a4a');
  cockpitGrad.addColorStop(0.4, '#2a4a7a');
  cockpitGrad.addColorStop(0.7, '#4a7aba');
  cockpitGrad.addColorStop(1, '#1a2a4a');
  ctx.fillStyle = cockpitGrad;
  ctx.beginPath();
  ctx.moveTo(nose * 0.55, -bodyW * 0.4);
  ctx.quadraticCurveTo(nose * 0.45, -bodyW * 1.1, nose * 0.25, -bodyW);
  ctx.lineTo(tail + 6 * s, -bodyW * 0.85);
  ctx.quadraticCurveTo(tail + 5 * s, -bodyW * 0.5, tail + 6 * s, -bodyW * 0.35);
  ctx.lineTo(nose * 0.3, -bodyW * 0.3);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(nose * 0.45, -bodyW * 0.65);
  ctx.quadraticCurveTo(nose * 0.35, -bodyW * 0.9, nose * 0.2, -bodyW * 0.8);
  ctx.lineTo(nose * 0.2, -bodyW * 0.5);
  ctx.quadraticCurveTo(nose * 0.35, -bodyW * 0.5, nose * 0.45, -bodyW * 0.65);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();

  const noseGrad = ctx.createLinearGradient(nose * 0.3, -bodyW * 0.4, nose * 0.3, bodyW * 0.4);
  noseGrad.addColorStop(0, '#bb1111');
  noseGrad.addColorStop(0.5, '#dd2222');
  noseGrad.addColorStop(1, '#aa1111');
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.moveTo(nose, 0);
  ctx.quadraticCurveTo(nose * 0.9, -bodyW * 0.35, nose * 0.6, -bodyW * 0.45);
  ctx.lineTo(nose * 0.6, bodyW * 0.45);
  ctx.quadraticCurveTo(nose * 0.9, bodyW * 0.35, nose, 0);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(nose, 0);
  ctx.quadraticCurveTo(nose * 0.92, -bodyW * 0.2, nose * 0.75, -bodyW * 0.25);
  ctx.lineTo(nose * 0.75, -bodyW * 0.05);
  ctx.quadraticCurveTo(nose * 0.92, -bodyW * 0.05, nose, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fill();

  ctx.restore();
}

function drawCrashExplosion(ctx, x, y, progress) {
  ctx.save();
  ctx.translate(x, y);
  const p = progress;

  ctx.strokeStyle = `rgba(255,200,50,${Math.max(0, 0.5 * (1 - p))})`;
  ctx.lineWidth = 2 * (1 - p);
  ctx.beginPath();
  ctx.arc(0, 0, p * 60, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 / 16) * i + p * 0.5;
    const dist = p * (20 + Math.random() * 40);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 1 + Math.random() * 2.5 * (1 - p * 0.5), 0, Math.PI * 2);
    ctx.fillStyle = pick(['#ff4444', '#ff8800', '#ffcc00', '#ff6600', '#ffffff']);
    ctx.fill();
  }

  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = p * (10 + Math.random() * 30);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 1 + Math.random() * 4 * (1 - p * 0.3), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,${100 + Math.floor(Math.random() * 100)},0,${Math.max(0, 0.7 * (1 - p * 0.3))})`;
    ctx.fill();
  }

  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = p * (15 + Math.random() * 25);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 3 + Math.random() * 8 * p, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(80,80,80,${Math.max(0, 0.2 * (1 - p * 0.5))})`;
    ctx.fill();
  }

  const flash = ctx.createRadialGradient(0, 0, 0, 0, 0, 25 * (1 - p * 0.5));
  flash.addColorStop(0, `rgba(255,255,255,${Math.max(0, 0.4 * (1 - p))})`);
  flash.addColorStop(0.4, `rgba(255,200,50,${Math.max(0, 0.3 * (1 - p * 0.5))})`);
  flash.addColorStop(0.7, `rgba(255,100,0,${Math.max(0, 0.15 * (1 - p * 0.3))})`);
  flash.addColorStop(1, 'rgba(255,50,0,0)');
  ctx.fillStyle = flash;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

const QUICK_AMOUNTS = [20, 50, 100, 1000];

export default function AviatorGame() {
  const { user: authUser, setUser } = useAuth();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const confettiCanvasRef = useRef(null);
  const animRef = useRef(null);
  const crashAnimRef = useRef(null);
  const soundRef = useRef(new SoundManager());
  const confettiRef = useRef(null);

  const [gameState, setGameState] = useState('BET');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [endMultiplier, setEndMultiplier] = useState(null);
  const [roundHistory, setRoundHistory] = useState([]);
  const [points, setPoints] = useState([]);
  const [displayedMultiplier, setDisplayedMultiplier] = useState(1.0);
  const [crashProgress, setCrashProgress] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ w: 700, h: 400 });
  const [thrust, setThrust] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [screenShake, setScreenShake] = useState(false);
  const [balance, setBalance] = useState(0);
  const [userName, setUserName] = useState('');
  const [bettedUsers, setBettedUsers] = useState([]);
  const [previousHand, setPreviousHand] = useState([]);
  const [fakeActivity, setFakeActivity] = useState([]);
  const [bigWins, setBigWins] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [fBet, setFBet] = useState({ amount: 20, target: 2, status: 'idle', betted: false, cashouted: false, cashAmount: 0, betId: null });
  const [fGameType, setFGameType] = useState('manual');
  const [fAutoCashout, setFAutoCashout] = useState(false);
  const [fAutoActive, setFAutoActive] = useState(false);
  const [fAutoRounds, setFAutoRounds] = useState(0);
  const [fAutoModalOpen, setFAutoModalOpen] = useState(false);
  const [fAutoStopDec, setFAutoStopDec] = useState(false);
  const [fAutoStopDecAmt, setFAutoStopDecAmt] = useState(0);
  const [fAutoStopInc, setFAutoStopInc] = useState(false);
  const [fAutoStopIncAmt, setFAutoStopIncAmt] = useState(0);
  const [fAutoStopWin, setFAutoStopWin] = useState(false);
  const [fAutoStopWinAmt, setFAutoStopWinAmt] = useState(0);
  const [fAutoCount, setFAutoCount] = useState(0);
  const fIncreaseTotal = useRef(0);
  const fDecreaseTotal = useRef(0);

  const [sPanel, setSPanel] = useState(false);
  const [sBet, setSBet] = useState({ amount: 20, target: 2, status: 'idle', betted: false, cashouted: false, cashAmount: 0, betId: null });
  const [sGameType, setSGameType] = useState('manual');
  const [sAutoCashout, setSAutoCashout] = useState(false);
  const [sAutoActive, setSAutoActive] = useState(false);
  const [sAutoRounds, setSAutoRounds] = useState(0);
  const [sAutoModalOpen, setSAutoModalOpen] = useState(false);
  const [sAutoStopDec, setSAutoStopDec] = useState(false);
  const [sAutoStopDecAmt, setSAutoStopDecAmt] = useState(0);
  const [sAutoStopInc, setSAutoStopInc] = useState(false);
  const [sAutoStopIncAmt, setSAutoStopIncAmt] = useState(0);
  const [sAutoStopWin, setSAutoStopWin] = useState(false);
  const [sAutoStopWinAmt, setSAutoStopWinAmt] = useState(0);
  const [sAutoCount, setSAutoCount] = useState(0);
  const sIncreaseTotal = useRef(0);
  const sDecreaseTotal = useRef(0);

  const [fbetState, setFBetState] = useState(false);
  const [sbetState, setSBetState] = useState(false);

  const [headerType, setHeaderType] = useState('all');
  const [myBets, setMyBets] = useState([]);
  const [betLimits, setBetLimits] = useState({ min: 10, max: 100000 });
  const [rechargeState, setRechargeState] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const gameStateRef = useRef(gameState);
  const pointsRef = useRef(points);
  const crashProgressRef = useRef(0);
  const displayedMultiplierRef = useRef(1.0);
  const thrustRef = useRef(1);
  const soundRef2 = useRef(soundEnabled);
  const socketRef = useRef(null);
  const gameStartTimeRef = useRef(0);
  const curMultiplierRef = useRef(1.0);
  const endMultiplierRef = useRef(null);
  const fbetStateRef = useRef(false);
  const sbetStateRef = useRef(false);
  const dataPointsRef = useRef([]);
  const rocketImgRef = useRef(null);
  const rocketGifRef = useRef(null);
  const cashoutingRef = useRef(false);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { pointsRef.current = points; }, [points]);
  useEffect(() => { soundRef2.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { fbetStateRef.current = fbetState; }, [fbetState]);
  useEffect(() => { sbetStateRef.current = sbetState; }, [sbetState]);

  useEffect(() => {
    soundRef.current.init();
    confettiRef.current = new ConfettiSystem(confettiCanvasRef);
    const img = new Image();
    img.src = rocketSprite;
    img.onload = () => { rocketImgRef.current = img; };
    const gif = new Image();
    gif.src = rocketGif;
    gif.onload = () => { rocketGifRef.current = gif; };
    return () => { confettiRef.current?.destroy(); };
  }, []);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    let socketBase;
    if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
      try {
        socketBase = new URL(apiUrl).origin;
      } catch {
        console.warn(`[Aviator] Invalid VITE_API_URL: "${apiUrl}". Falling back to page origin for socket.`);
        socketBase = window.location.origin;
      }
    } else {
      if (!apiUrl.startsWith('/')) {
        console.warn(`[Aviator] VITE_API_URL "${apiUrl}" does not look like a URL or path. Using page origin for socket.`);
      }
      socketBase = window.location.origin;
    }
    console.log(`[Aviator] Socket connecting to: ${socketBase} with path /api/socket.io`);
    const socket = io(socketBase, { path: '/api/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    let mounted = true;

    const fetchInitialState = async () => {
      try {
        const res = await api.get('/game/state');
        if (res.data?.success && res.data?.data) {
          const d = res.data.data;
          if (!mounted) return;
          setBalance(0);
          if (d.state === 'waiting') {
            setGameState('BET');
            setCountdown(d.countdown || 0);
          } else if (d.state === 'flying') {
            setGameState('PLAYING');
            curMultiplierRef.current = d.multiplier || 1;
            setCurrentMultiplier(d.multiplier || 1);
            gameStartTimeRef.current = Date.now();
          } else if (d.state === 'crashed') {
            setGameState('GAMEEND');
            setEndMultiplier(d.crashMultiplier || d.multiplier || 1);
            endMultiplierRef.current = d.crashMultiplier || d.multiplier || 1;
          }
          if (d.history) setRoundHistory(d.history.map(h => h.crashMultiplier).filter(Boolean));
        }
        const profileRes = await api.get('/user/profile');
        if (profileRes.data?.success && profileRes.data?.data) {
          if (!mounted) return;
          setBalance(parseFloat(profileRes.data.data.balance) || 0);
          setUserName(profileRes.data.data.full_name || profileRes.data.data.username || '');
        }
      } catch (err) {
        console.error('Failed to fetch initial state:', err);
      }
    };
    fetchInitialState();

    socket.on('connect', () => {
      socket.emit('game:join');
    });
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    socket.on('game:state', (gs) => {
      if (!gs || !mounted) return;
      if (gs.state === 'waiting') {
        setGameState('BET');
        dataPointsRef.current = [];
        setPoints([]);
        setEndMultiplier(null);
        endMultiplierRef.current = null;
        setCurrentMultiplier(1.0);
        curMultiplierRef.current = 1.0;
        setCrashProgress(0);
        crashProgressRef.current = 0;
        setCountdown(gs.countdown || 0);
      } else if (gs.state === 'flying') {
        setGameState('PLAYING');
        dataPointsRef.current = [{ t: Date.now(), m: gs.multiplier || 1.0 }];
        setPoints([{ t: Date.now(), m: gs.multiplier || 1.0 }]);
        setEndMultiplier(null);
        endMultiplierRef.current = null;
        curMultiplierRef.current = gs.multiplier || 1.0;
        gameStartTimeRef.current = Date.now();
        if (soundRef2.current) soundRef.current.play('takeOff');
      } else if (gs.state === 'crashed') {
        const cm = gs.crashMultiplier || gs.multiplier || 1.0;
        setGameState('GAMEEND');
        setEndMultiplier(cm);
        endMultiplierRef.current = cm;
        setCurrentMultiplier(cm);
        curMultiplierRef.current = cm;
      }
      if (gs.history) setRoundHistory(gs.history.map(h => h.crashMultiplier).filter(Boolean));
    });

    socket.on('game:waiting', (data) => {
      if (!mounted) return;
      if (gameStateRef.current !== 'BET') {
        setGameState('BET');
        dataPointsRef.current = [];
        setPoints([]);
        setEndMultiplier(null);
        endMultiplierRef.current = null;
        setCurrentMultiplier(1.0);
        curMultiplierRef.current = 1.0;
        setCrashProgress(0);
        crashProgressRef.current = 0;
        setFBet(prev => ({ ...prev, betted: false, cashouted: false, cashAmount: 0, betId: null }));
        setSBet(prev => ({ ...prev, betted: false, cashouted: false, cashAmount: 0, betId: null }));
      }
      setCountdown(data.countdown || 0);
    });

    socket.on('game:started', (data) => {
      if (!mounted) return;
      setGameState('PLAYING');
      dataPointsRef.current = [{ t: Date.now(), m: 1.0 }];
      setPoints([{ t: Date.now(), m: 1.0 }]);
      setEndMultiplier(null);
      endMultiplierRef.current = null;
      curMultiplierRef.current = 1.0;
      gameStartTimeRef.current = Date.now();
      if (soundRef2.current) soundRef.current.play('takeOff');
    });

    socket.on('game:tick', (data) => {
      if (!mounted) return;
      if (gameStateRef.current === 'PLAYING') {
        const m = data.multiplier || 1.0;
        curMultiplierRef.current = m;
        dataPointsRef.current.push({ t: Date.now(), m });
        const cutoff = Date.now() - 20000;
        dataPointsRef.current = dataPointsRef.current.filter(p => p.t >= cutoff);
        setPoints(dataPointsRef.current.slice());
      }
    });

    socket.on('game:crashed', (data) => {
      if (!mounted) return;
      const cm = data.crashMultiplier || 1.0;
      setGameState('GAMEEND');
      setEndMultiplier(cm);
      endMultiplierRef.current = cm;
      setCurrentMultiplier(cm);
      curMultiplierRef.current = cm;
      setFBet(prev => ({ ...prev, betted: false, cashouted: false, cashAmount: 0, betId: null }));
      setSBet(prev => ({ ...prev, betted: false, cashouted: false, cashAmount: 0, betId: null }));
      setFBetState(false);
      setSBetState(false);
    });

    socket.on('game:bet', (data) => {
      if (!mounted) return;
      setBettedUsers(prev => {
        const exists = prev.some(u => u.name === data.userId || u.betId === data.betId);
        if (exists) return prev;
        return [...prev, { name: data.userId?.toString().slice(0, 4) + '***', betAmount: data.amount, betId: data.betId, cashouted: false, cashOut: 0, target: 0, img: '' }];
      });
    });

    socket.on('game:cashout', (data) => {
      if (!mounted) return;
      setBettedUsers(prev => prev.map(u =>
        u.betId === data.betId || u.name === data.userId?.toString().slice(0, 4) + '***'
          ? { ...u, cashouted: true, cashOut: data.multiplier || 0 }
          : u
      ));
    });

    return () => {
      mounted = false;
      socket.disconnect();
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (crashAnimRef.current) cancelAnimationFrame(crashAnimRef.current);
    };
  }, []);

  useEffect(() => {
    const betAmounts = [10, 20, 50, 100, 200, 500, 1000, 2500, 5000];
    const fakeTimer = setInterval(() => {
      if (gameStateRef.current === 'BET') {
        setBettedUsers([]);
        return;
      }
      if (gameStateRef.current === 'GAMEEND') {
        setBettedUsers(prev => prev.map(u =>
          u.cashouted ? u : { ...u, crashed: true }
        ));
        return;
      }
      const currentMax = curMultiplierRef.current;
      setBettedUsers(prev => {
        let updated = prev.filter(u => u.maintained);
        updated = updated.map(u => ({ ...u, maintained: false }));
        const toAdd = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < toAdd; i++) {
          const name = pick(FAKE_NAMES);
          if (updated.length < 50 && !updated.some(u => u.name === name)) {
            updated.unshift({
              name,
              betAmount: pick(betAmounts),
              cashouted: false,
              cashOut: 0,
              target: 0,
              img: '',
              maintained: true,
              betId: Date.now() + '_' + i
            });
          }
        }
        if (updated.length > 35) updated = updated.slice(0, 35);
        return updated.map(u => {
          if (!u.cashouted && !u.crashed && Math.random() < 0.15) {
            const maxCo = Math.max(1.01, currentMax - 0.01);
            const coMult = 1 + Math.random() * (maxCo - 1);
            return { ...u, cashouted: true, cashOut: parseFloat(coMult.toFixed(2)), maintained: true };
          }
          return { ...u, maintained: true };
        });
      });
    }, 1800);
    return () => clearInterval(fakeTimer);
  }, []);

  useEffect(() => {
    const fetchMyBets = async () => {
      try {
        const res = await api.get('/game/history');
        if (res.data?.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map(b => ({
            _id: b.id,
            date: b.created_at,
            betAmount: parseFloat(b.amount) || 0,
            cashoutAt: b.cash_out_at ? parseFloat(b.cash_out_at) : 0,
            status: b.status,
            payout: b.payout ? parseFloat(b.payout) : 0
          }));
          setMyBets(mapped);
        }
      } catch {}
    };
    if (gameState === 'BET') fetchMyBets();
  }, [gameState]);

  useEffect(() => {
    const topNames = ['R***y', 'V***t', 'S***h', 'A***k', 'M***l', 'K***n', 'D***j', 'P***l', 'J***s', 'L***i'];
    const topData = [];
    for (let i = 0; i < 12; i++) {
      topData.push({
        userName: topNames[i] || 'u***r',
        f: {
          cashAmount: parseFloat((5000 + Math.random() * 95000).toFixed(2)),
          target: parseFloat((3 + Math.random() * 45).toFixed(2))
        }
      });
    }
    topData.sort((a, b) => b.f.cashAmount - a.f.cashAmount);
    setPreviousHand(topData);
  }, []);

  useEffect(() => {
    if (gameState !== 'BET') return;
    const doBet = async (idx) => {
      const isF = idx === 'f';
      const bet = isF ? fBet : sBet;
      const amt = parseFloat(bet.amount) || 10;
      if (amt < betLimits.min) {
        toast.error(`Minimum bet is ${betLimits.min}`);
        isF ? setFBetState(false) : setSBetState(false);
        return;
      }
      if (balance - amt < 0) {
        toast.error('Insufficient balance');
        isF ? setFBetState(false) : setSBetState(false);
        return;
      }
      try {
        const autoCashoutAt = (isF ? fAutoCashout : sAutoCashout) ? (isF ? fBet.target : sBet.target) : null;
        const res = await api.post('/game/bet', { amount: amt, autoCashoutAt });
        if (res.data?.success) {
          const newBal = typeof res.data.data?.balance === 'number' ? res.data.data.balance : parseFloat(((authUser?.balance || 0) - amt).toFixed(2));
          setBalance(newBal);
          setUser(prev => prev ? { ...prev, balance: newBal } : prev);
          if (isF) {
            const bid = res.data.data?.betId;
            setFBet(prev => ({ ...prev, betted: true, betId: bid }));
            setFBetState(false);
          } else {
            const bid = res.data.data?.betId;
            setSBet(prev => ({ ...prev, betted: true, betId: bid }));
            setSBetState(false);
          }
          soundRef.current.betPlaced();
        } else {
          toast.error(res.data?.message || 'Bet failed');
          isF ? setFBetState(false) : setSBetState(false);
        }
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Bet failed';
        toast.error(msg);
        isF ? setFBetState(false) : setSBetState(false);
      }
    };
    if (fbetState) {
      if (fAutoActive) {
        if (fAutoCount <= 0) { setFBetState(false); setFAutoActive(false); return; }
        setFAutoCount(prev => prev - 1);
      }
      doBet('f');
    }
    if (sbetState) {
      if (sAutoActive) {
        if (sAutoCount <= 0) { setSBetState(false); setSAutoActive(false); return; }
        setSAutoCount(prev => prev - 1);
      }
      doBet('s');
    }
  }, [gameState, fbetState, sbetState]);

  const placeBetSocket = (idx) => {
    if (idx === 'f') {
      if (fbetState || fBet.betted) return;
      const amt = parseFloat(fBet.amount) || 100;
      if (amt < betLimits.min) return toast.error(`Minimum bet is ${betLimits.min}`);
      if (amt > balance) return toast.error('Insufficient balance');
      setFBetState(true);
    } else {
      if (sbetState || sBet.betted) return;
      const amt = parseFloat(sBet.amount) || 100;
      if (amt < betLimits.min) return toast.error(`Minimum bet is ${betLimits.min}`);
      if (amt > balance) return toast.error('Insufficient balance');
      setSBetState(true);
    }
  };

  const cashOutSocket = async (idx) => {
    const isF = idx === 'f';
    const bet = isF ? fBet : sBet;
    if (gameState !== 'PLAYING' || !bet.betted || bet.cashouted) return;
    if (cashoutingRef.current) return;
    cashoutingRef.current = true;
    try {
      const res = await api.post('/game/cashout', { betId: bet.betId || null });
      if (res.data?.success) {
        const payout = parseFloat(res.data.data?.payout || 0);
        const newBal = typeof res.data.data?.balance === 'number' ? res.data.data.balance : parseFloat((balance + payout).toFixed(2));
        if (isF) {
          setFBet(prev => ({ ...prev, cashouted: true, cashAmount: payout }));
        } else {
          setSBet(prev => ({ ...prev, cashouted: true, cashAmount: payout }));
        }
        setBalance(newBal);
        setUser(prev => prev ? { ...prev, balance: newBal } : prev);
        soundRef.current.cashOut();
        confettiRef.current?.burst(50);
        toast.success(`Cashed out ${payout.toFixed(2)} INR @ ${(res.data.data?.cashoutMultiplier || 1).toFixed(2)}x`);
      } else {
        toast.error(res.data?.message || 'Cashout failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Cashout failed');
    } finally {
      cashoutingRef.current = false;
    }
  };



  useEffect(() => {
    if (gameState === 'BET') {
      setCurrentMultiplier(1.0);
      curMultiplierRef.current = 1.0;
      setDisplayedMultiplier(1.0);
      displayedMultiplierRef.current = 1.0;
    } else if (gameState === 'GAMEEND' && endMultiplier) {
      setCurrentMultiplier(endMultiplier);
      curMultiplierRef.current = endMultiplier;
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      let animating = true;
      const animate = () => {
        if (!animating) return;
        const target = curMultiplierRef.current;
        const current = displayedMultiplierRef.current;
        const diff = target - current;
        if (Math.abs(diff) > 0.001) {
          displayedMultiplierRef.current += diff * Math.min(1, 0.3 + Math.abs(diff) * 0.1);
          setDisplayedMultiplier(displayedMultiplierRef.current);
        } else {
          displayedMultiplierRef.current = target;
        }
        animRef.current = requestAnimationFrame(animate);
      };
      animRef.current = requestAnimationFrame(animate);
      return () => { animating = false; if (animRef.current) cancelAnimationFrame(animRef.current); };
    } else if (gameState === 'BET') {
      setDisplayedMultiplier(1.0);
      displayedMultiplierRef.current = 1.0;
    } else if (gameState === 'GAMEEND' && endMultiplierRef.current) {
      setDisplayedMultiplier(endMultiplierRef.current);
      displayedMultiplierRef.current = endMultiplierRef.current;
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'PLAYING' && crashProgress === 0) {
      let running = true;
      const flicker = () => {
        if (!running) return;
        const m = displayedMultiplierRef.current || 1;
        const base = Math.min(1.5, 0.7 + m * 0.15);
        const val = base + Math.random() * 0.3;
        setThrust(val);
        thrustRef.current = val;
        setTimeout(flicker, Math.max(25, 60 - m * 3) + Math.random() * 40);
      };
      flicker();
      return () => { running = false; };
    } else {
      setThrust(1);
      thrustRef.current = 1;
    }
  }, [gameState, crashProgress]);

  useEffect(() => {
    if (gameState === 'GAMEEND') {
      crashProgressRef.current = 0;
      const start = Date.now();
      const animate = () => {
        const elapsed = Date.now() - start;
        const prog = Math.min(1, elapsed / 1200);
        crashProgressRef.current = prog;
        setCrashProgress(prog);
        if (prog < 1) crashAnimRef.current = requestAnimationFrame(animate);
      };
      crashAnimRef.current = requestAnimationFrame(animate);
    } else {
      setCrashProgress(0);
      crashProgressRef.current = 0;
    }
    return () => { if (crashAnimRef.current) cancelAnimationFrame(crashAnimRef.current); };
  }, [gameState]);

  useEffect(() => { drawCanvas(); }, [displayedMultiplier, gameState, endMultiplier, points, crashProgress, canvasSize, thrust]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ w: rect.width, h: rect.height });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { window.removeEventListener('resize', handleResize); ro.disconnect(); };
  }, []);

  useEffect(() => {
    if (gameState === 'GAMEEND') {
      setScreenShake(true);
      soundRef.current.crash();
    }
  }, [gameState]);

  useEffect(() => {
    if (screenShake) {
      const t = setTimeout(() => setScreenShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [screenShake]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      if (soundEnabled) soundRef.current.engineHum();
      return () => soundRef.current.stop('main');
    }
    if (gameState === 'BET' || gameState === 'GAMEEND') {
      soundRef.current.stop('main');
    }
  }, [gameState, soundEnabled]);

  useEffect(() => {
    if (gameState === 'BET') {
      if (fAutoActive && !fBet.betted && !fbetState) {
        setFBetState(true);
      }
      if (sAutoActive && !sBet.betted && !sbetState) {
        setSBetState(true);
      }
    }
  }, [gameState, fAutoActive, sAutoActive, fBet.betted, sBet.betted, fbetState, sbetState]);

  const toggleSound = () => {
    const enabled = soundRef.current.toggle();
    setSoundEnabled(enabled);
  };

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 30, right: 24, bottom: 36, left: 52 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    ctx.clearRect(0, 0, w, h);

    const isCrash = gameState === 'GAMEEND';

    // Deep atmospheric background
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    bgGrad.addColorStop(0, isCrash ? '#140a0a' : '#0f0f14');
    bgGrad.addColorStop(0.5, isCrash ? '#0d0606' : '#0a0a0e');
    bgGrad.addColorStop(1, '#050508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Twinkling stars
    const now = Date.now();
    const starSeed = isCrash ? 54321 : 12345;
    for (let i = 0; i < 80; i++) {
      const sx = ((starSeed * (i + 1) * 7) % w);
      const sy = ((starSeed * (i + 1) * 13) % h);
      const sb = ((starSeed * (i + 1) * 17) % 10);
      const sr = 0.3 + sb * 0.15;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(now / 2000 + i * 1.7));
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${(0.03 + sb * 0.03) * twinkle})`;
      ctx.fill();
    }

    // Vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.7, 'rgba(0,0,0,0.1)');
    vig.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Grid with glow
    const gridColor = isCrash ? 'rgba(255,50,50,0.06)' : 'rgba(100,100,140,0.05)';
    const gridGlow = isCrash ? 'rgba(255,50,50,0.02)' : 'rgba(80,80,180,0.02)';
    ctx.shadowColor = gridGlow;
    ctx.shadowBlur = 4;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const x = pad.left + (plotW / 5) * i;
      const y = pad.top + (plotH / 5) * i;
      ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + plotH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + plotW, y); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = '8px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (plotH / 5) * i;
      ctx.fillText((MAX_MULTIPLIER - (MAX_MULTIPLIER / 5) * i).toFixed(1) + 'x', pad.left - 6, y);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i <= 5; i++) {
      ctx.fillText((i * 2) + 's', pad.left + (plotW / 5) * i, pad.top + plotH + 6);
    }

    const isPlayingOrEnd = gameState === 'PLAYING' || isCrash;
    const pts = pointsRef.current;
    const pp = crashProgressRef.current;

    if (isPlayingOrEnd && pts.length > 1) {
      const mapX = (mVal) => {
        const ratio = Math.max(0, (Math.min(mVal, MAX_MULTIPLIER) - 1) / (MAX_MULTIPLIER - 1));
        const curved = Math.pow(ratio, 0.15);
        return pad.left + 2 + curved * (plotW - 4);
      };
      const mapY = (m) => pad.top + plotH - (Math.min(m, MAX_MULTIPLIER) / MAX_MULTIPLIER) * plotH;

      const m = displayedMultiplierRef.current;
      const lineColor = isCrash ? '#ff3333' : m >= 50 ? '#FFD700' : m >= 25 ? '#6BCBFF' : m >= 10 ? '#FFD700' : getColor(m);

      // Clip everything to plot area so line/glow/trail never go outside
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad.left, pad.top, plotW, plotH);
      ctx.clip();

      // --- Gradient fill under curve ---
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      if (isCrash) {
        grad.addColorStop(0, 'rgba(255,50,50,0.10)');
        grad.addColorStop(0.3, 'rgba(255,50,50,0.04)');
        grad.addColorStop(1, 'rgba(255,50,50,0)');
      } else if (m >= 10) {
        grad.addColorStop(0, hexToRgba(lineColor, 0.09));
        grad.addColorStop(0.3, hexToRgba(lineColor, 0.04));
        grad.addColorStop(1, hexToRgba(lineColor, 0));
      } else {
        grad.addColorStop(0, hexToRgba(lineColor, 0.08));
        grad.addColorStop(0.3, hexToRgba(lineColor, 0.03));
        grad.addColorStop(1, hexToRgba(lineColor, 0));
      }

      if (pts.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(mapX(pts[0].m), pad.top + plotH);
        ctx.lineTo(mapX(pts[0].m), mapY(pts[0].m));
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (mapX(pts[i].m) + mapX(pts[i + 1].m)) / 2;
          const yc = (mapY(pts[i].m) + mapY(pts[i + 1].m)) / 2;
          ctx.quadraticCurveTo(mapX(pts[i].m), mapY(pts[i].m), xc, yc);
        }
        ctx.lineTo(mapX(pts[pts.length - 1].m), mapY(pts[pts.length - 1].m));
        ctx.lineTo(mapX(pts[pts.length - 1].m), pad.top + plotH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(pad.left, pad.top + plotH);
        for (let i = 0; i < pts.length; i++) ctx.lineTo(mapX(pts[i].m), mapY(pts[i].m));
        ctx.lineTo(mapX(pts[pts.length - 1].m), pad.top + plotH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();

      // --- 3-layer neon glow curve ---
      const glowSize = isCrash ? 6 : m >= 50 ? 35 : m >= 25 ? 28 : m >= 10 ? 22 : m >= 5 ? 18 : 14;
      const lineW = isCrash ? 2 : m >= 25 ? 3.5 : m >= 10 ? 3 : 2.5;

      const drawCurve = (width, blur, alpha) => {
        ctx.beginPath();
        ctx.moveTo(mapX(pts[0].m), mapY(pts[0].m));
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (mapX(pts[i].m) + mapX(pts[i + 1].m)) / 2;
          const yc = (mapY(pts[i].m) + mapY(pts[i + 1].m)) / 2;
          ctx.quadraticCurveTo(mapX(pts[i].m), mapY(pts[i].m), xc, yc);
        }
        ctx.lineTo(mapX(pts[pts.length - 1].m), mapY(pts[pts.length - 1].m));
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = width;
        ctx.globalAlpha = alpha;
        if (blur > 0) {
          ctx.shadowColor = lineColor;
          ctx.shadowBlur = blur;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      };

      // Layer 1: Wide outer glow
      drawCurve(lineW + 8, glowSize * 1.5, 0.15);
      // Layer 2: Medium glow
      drawCurve(lineW + 4, glowSize * 0.8, 0.4);
      // Layer 3: Inner bright core
      drawCurve(lineW, 0, 1);

      // --- Trail particles (scatter glow) ---
      const trailCount = Math.min(30, pts.length - 1);
      for (let i = 0; i < trailCount; i++) {
        const idx = pts.length - 1 - i;
        const alpha = 0.5 * (1 - i / trailCount);
        const spread = (1 - i / trailCount) * 1.2 + 0.3;
        const sz = (2 + Math.random() * 2.5) * (1 - i / trailCount * 0.5);
        ctx.beginPath();
        ctx.arc(
          mapX(pts[idx].m) + (Math.random() - 0.5) * 6 * spread,
          mapY(pts[idx].m) + (Math.random() - 0.5) * 6 * spread,
          Math.max(0.3, sz), 0, Math.PI * 2
        );
        ctx.fillStyle = `rgba(255,${Math.max(40, 100 - i * 4)},40,${alpha * (m >= 5 ? 0.7 : 0.5)})`;
        ctx.fill();
      }

      // --- Core trail (following curve exactly) ---
      for (let i = 0; i < trailCount; i++) {
        const idx = pts.length - 1 - i;
        const alpha = 0.7 * (1 - i / trailCount);
        const sz = 3 * (1 - i / trailCount * 0.5);
        ctx.beginPath();
        ctx.arc(mapX(pts[idx].m), mapY(pts[idx].m), Math.max(0.5, sz), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(lineColor, alpha);
        ctx.fill();
      }

      // --- Rocket exhaust contrail ---
      if (m > 1.1) {
        const contrailScale = Math.min(w, h) / 300;
        ctx.globalAlpha = 0.12;
        const contrailLen = Math.min(8, Math.max(3, Math.floor(m / 2) + 2));
        for (let ci = 0; ci < contrailLen; ci++) {
          const idx = Math.max(0, pts.length - 1 - Math.floor(ci * 2));
          const wx = mapX(pts[idx].m);
          const wy = mapY(pts[idx].m);
          const age = ci / contrailLen;
          const puffSize = (1.5 + Math.random() * 3) * contrailScale * (1 - age * 0.4);
          ctx.beginPath();
          ctx.arc(
            wx + (Math.random() - 0.5) * 8 * (1 - age * 0.3),
            wy + (Math.random() - 0.5) * 8 * contrailScale * (1 - age * 0.3),
            puffSize, 0, Math.PI * 2
          );
          ctx.fillStyle = `rgba(180,200,255,${(0.08 + Math.random() * 0.12) * (1 - age * 0.6)})`;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // --- Plane + Multiplier label ---
      if (gameState === 'PLAYING') {
        const lp = pts[pts.length - 1];
        const lx = mapX(lp.m);
        const ly = mapY(lp.m);

        let angle = -Math.PI / 4;
        if (pts.length > 3) {
          const lookback = Math.min(3, pts.length - 1);
          const p2 = pts[pts.length - 1 - lookback];
          const p3 = pts[pts.length - 1];
          const dx = mapX(p3.m) - mapX(p2.m);
          const dy = mapY(p3.m) - mapY(p2.m);
          angle = Math.atan2(dy, dx);
        }

        // Speed-based shake at high multipliers
        const speedShake = m > 3 ? Math.min(0.8, (m - 3) * 0.06) : 0;
        const shakeX = (Math.random() - 0.5) * speedShake * 2;
        const shakeY = (Math.random() - 0.5) * speedShake * 2;

        const planeScale = Math.min(w, h) / 260;

        // Multiplier label above plane
        const labelSize = Math.min(16, 12 + m * 0.3);
        const labelY = Math.max(pad.top + labelSize + 4, ly - 22 * planeScale - 4);
        const labelX = Math.max(pad.left + 10, Math.min(pad.left + plotW - 10, lx + shakeX));
        ctx.save();
        ctx.font = `bold ${labelSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = lineColor;
        ctx.fillText(m.toFixed(2) + 'x', labelX, labelY);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(m.toFixed(2) + 'x', labelX, labelY);
        ctx.restore();

        // Rocket sprite (prefer animated GIF during flight)
        const rocketGif = rocketGifRef.current;
        const rocketImg = rocketImgRef.current;
        const activeSprite = rocketGif || rocketImg;
        if (activeSprite) {
          const rSize = 52 * planeScale;
          const half = rSize / 2;
          const cx = Math.max(pad.left + half + 4, Math.min(pad.left + plotW - half - 4, lx + shakeX));
          const cy = Math.max(pad.top + half + 4, Math.min(pad.top + plotH - half - 4, ly + shakeY));
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.drawImage(activeSprite, -half, -half, rSize, rSize);
          ctx.restore();
        } else {
          const half = 26 * planeScale;
          const cx = Math.max(pad.left + half + 4, Math.min(pad.left + plotW - half - 4, lx + shakeX));
          const cy = Math.max(pad.top + half + 4, Math.min(pad.top + plotH - half - 4, ly + shakeY));
          drawJet(ctx, cx, cy, angle, planeScale, thrustRef.current);
        }
      }

      // --- GAMEEND effects ---
      if (isCrash && endMultiplier) {
        const cm = endMultiplierRef.current;
        const cy = mapY(cm);

        // Red flash overlay
        ctx.fillStyle = `rgba(255,0,0,${0.08 * (1 - pp)})`;
        ctx.fillRect(0, 0, w, h);

        // Dashed line at crash point
        ctx.strokeStyle = `rgba(255,50,50,${0.4 * (1 - pp * 0.5)})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(pad.left, cy);
        ctx.lineTo(pad.left + plotW, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        // "FLEW AWAY!" text with glow
        const crashTextY = Math.max(pad.top + 20, cy - 4);
        ctx.save();
        ctx.fillStyle = `rgba(255,255,255,${0.95 * (1 - pp * 0.3)})`;
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 15;
        ctx.fillText('FLEW AWAY!', pad.left + 8, crashTextY);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Crash multiplier
        const crashMultY = Math.min(pad.top + plotH - 6, cy + 4);
        ctx.save();
        ctx.fillStyle = `rgba(255,200,50,${0.9 * (1 - pp * 0.3)})`;
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 10;
        ctx.fillText('@ ' + cm.toFixed(2) + 'x', pad.left + 8, crashMultY);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Explosion
        const crashX = mapX(pts.length > 0 ? pts[pts.length - 1].m : 1);
        drawCrashExplosion(ctx, crashX, cy, pp);
      }
      ctx.restore();
    } else if (gameState === 'BET') {
      // Ambient floating orbs
      const t = Date.now() / 1000;
      const orbCount = 12;
      for (let i = 0; i < orbCount; i++) {
        const phase = i / orbCount;
        const x = pad.left + Math.sin(t * 0.5 + phase * Math.PI * 2) * plotW * 0.35 + plotW * 0.5;
        const y = pad.top + Math.cos(t * 0.35 + phase * Math.PI * 2 + 1) * plotH * 0.3 + plotH * 0.5;
        const orbSize = 1.5 + Math.sin(t + i) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, orbSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.sin(t * 0.7 + i * 1.3) * 0.015})`;
        ctx.fill();
      }
    }
  }, [gameState, endMultiplier, points, displayedMultiplier, crashProgress, canvasSize]);

  const getMultiplierColor = (m) => {
    if (m < 2) return 'blue';
    if (m < 10) return 'purple';
    return 'big';
  };

  const getMultiplierStyle = (m) => {
    if (m < 2) return { color: 'rgb(52, 180, 255)' };
    if (m < 10) return { color: 'rgb(145, 62, 248)' };
    return { color: 'rgb(192, 23, 180)' };
  };

  const multiplierDisplay = (() => {
    if (gameState === 'BET') return '1.00';
    const val = displayedMultiplier - 0.01;
    return val >= 1 ? val.toFixed(2) : '1.00';
  })();

  const waitingBarWidth = (() => {
    if (gameState !== 'BET') return 0;
    return Math.max(0, Math.min(100, (countdown / 20) * 100));
  })();

  function renderBetPanel(idx) {
    const isF = idx === 'f';
    const bet = isF ? fBet : sBet;
    const gameType = isF ? fGameType : sGameType;
    const setGameType = isF ? setFGameType : setSGameType;
    const autoCashout = isF ? fAutoCashout : sAutoCashout;
    const setAutoCashout = isF ? setFAutoCashout : setSAutoCashout;
    const autoActive = isF ? fAutoActive : sAutoActive;
    const setAutoActive = isF ? setFAutoActive : setSAutoActive;
    const autoRounds = isF ? fAutoRounds : sAutoRounds;
    const setAutoRounds = isF ? setFAutoRounds : setSAutoRounds;
    const autoModalOpen = isF ? fAutoModalOpen : sAutoModalOpen;
    const setAutoModalOpen = isF ? setFAutoModalOpen : setSAutoModalOpen;
    const autoStopDec = isF ? fAutoStopDec : sAutoStopDec;
    const setAutoStopDec = isF ? setFAutoStopDec : setSAutoStopDec;
    const autoStopDecAmt = isF ? fAutoStopDecAmt : sAutoStopDecAmt;
    const setAutoStopDecAmt = isF ? setFAutoStopDecAmt : setSAutoStopDecAmt;
    const autoStopInc = isF ? fAutoStopInc : sAutoStopInc;
    const setAutoStopInc = isF ? setFAutoStopInc : setSAutoStopInc;
    const autoStopIncAmt = isF ? fAutoStopIncAmt : sAutoStopIncAmt;
    const setAutoStopIncAmt = isF ? setFAutoStopIncAmt : setSAutoStopIncAmt;
    const autoStopWin = isF ? fAutoStopWin : sAutoStopWin;
    const setAutoStopWin = isF ? setFAutoStopWin : setSAutoStopWin;
    const autoStopWinAmt = isF ? fAutoStopWinAmt : sAutoStopWinAmt;
    const setAutoStopWinAmt = isF ? setFAutoStopWinAmt : setSAutoStopWinAmt;
    const autoCount = isF ? fAutoCount : sAutoCount;
    const setAutoCount = isF ? setFAutoCount : setSAutoCount;
    const betted = bet.betted;
    const betState = isF ? fbetState : sbetState;
    const setBetStateFlag = isF ? setFBetState : setSBetState;

    const setBetState = (updates) => {
      if (isF) setFBet(prev => ({ ...prev, ...updates }));
      else setSBet(prev => ({ ...prev, ...updates }));
    };

    return (
      <div className="bet-control" key={idx}>
        <div className="controls">
          {isF ? !sPanel && (
            <div className="sec-hand-btn add" onClick={() => setSPanel(true)}></div>
          ) : sPanel && (
            <div className="sec-hand-btn minus" onClick={() => setSPanel(false)}></div>
          )}
          <div className="navigation">
            <div className="navigation-switcher">
              <button
                className={gameType === 'manual' ? 'active' : ''}
                onClick={() => { if (!betted) setGameType('manual'); }}
              >Bet</button>
              <button
                className={gameType === 'auto' ? 'active' : ''}
                onClick={() => { if (!betted) setGameType('auto'); }}
              >Auto</button>
            </div>
          </div>
          <div className="first-row">
            <div className="bet-block">
              <div className="bet-spinner">
                <div className={`spinner ${betted ? 'disabled' : ''}`}>
                  <div className="buttons">
                    <button className="minus" onClick={() => {
                      if (betted) return;
                      setBetState({ amount: Math.max(betLimits.min, (parseFloat(bet.amount) || 20) - 1) });
                    }}></button>
                  </div>
                  <div className="input">
                    <input
                      type="number"
                      value={bet.amount}
                      readOnly={betted}
                      onChange={e => {
                        if (betted) return;
                        const v = Number(e.target.value);
                        setBetState({ amount: v > betLimits.max ? betLimits.max : v < 0 ? 0 : v });
                      }}
                    />
                  </div>
                  <div className="buttons">
                    <button className="plus" onClick={() => {
                      if (betted) return;
                      setBetState({ amount: Math.min(betLimits.max, (parseFloat(bet.amount) || 20) + 1) });
                    }}></button>
                  </div>
                </div>
              </div>
              <div className="bet-opt-list">
                {QUICK_AMOUNTS.map(a => (
                  <button
                    key={a}
                    className={`bet-opt ${betted ? 'disabled' : ''}`}
                    onClick={() => { if (!betted) setBetState({ amount: a }); }}
                  ><span>{a}</span></button>
                ))}
              </div>
            </div>
            <div className="buttons-block">
              {betted && gameState === 'PLAYING' ? (
                <button className="btn-waiting" onClick={() => cashOutSocket(idx)}>
                  <span>
                    <label>CASHOUT</label>
                    <label className="amount">
                      <span>{Number(bet.amount * curMultiplierRef.current).toFixed(2)}</span>
                      <span className="currency">&nbsp;INR</span>
                    </label>
                  </span>
                </button>
              ) : betted ? (
                <button className="btn-danger">
                  <span><label>WAITING</label></span>
                </button>
              ) : betState ? (
                <>
                  <div className="btn-tooltip">Waiting for next round</div>
                  <button className="btn-danger" onClick={() => { setBetStateFlag(false); setAutoActive(false); }}>
                    <span><label>CANCEL</label></span>
                  </button>
                </>
              ) : gameState !== 'BET' ? (
                <button className="btn-waiting" style={{ opacity: 0.6 }}>
                  <span>
                    <label>WAITING</label>
                    <label className="amount"><span>0.00</span><span className="currency">&nbsp;INR</span></label>
                  </span>
                </button>
              ) : (
                <button className="btn-success" onClick={() => placeBetSocket(idx)}>
                  <span>
                    <label>BET</label>
                    <label className="amount">
                      <span>{Number(bet.amount).toFixed(2)}</span>
                      <span className="currency">&nbsp;INR</span>
                    </label>
                  </span>
                </button>
              )}
            </div>
          </div>
          {gameType === 'auto' && (
            <>
              <div className="border-line"></div>
              <div className="second-row">
                <div className="auto-bet-wrapper">
                  <div className="auto-bet">
                    {autoActive ? (
                      <button onClick={() => { setAutoActive(false); setBetStateFlag(false); }} className="auto-play-btn btn-danger">
                        {autoCount || 'STOP'}
                      </button>
                    ) : (
                      <button onClick={() => setAutoModalOpen(true)} className="auto-play-btn btn-primary">
                        AUTO PLAY
                      </button>
                    )}
                  </div>
                </div>
                <div className="cashout-block">
                  <div className="cashout-switcher">
                    <label className="label">Auto Cash Out</label>
                    <div
                      className={`input-switch ${autoCashout ? '' : 'off'}`}
                      onClick={() => { if (!betted) setAutoCashout(!autoCashout); }}
                    >
                      <span className="oval"></span>
                    </div>
                  </div>
                  <div className="cashout-snipper-wrapper">
                    <div className="cashout-snipper">
                      <div className={`snipper small ${autoCashout && !betted ? '' : 'disabled'}`}>
                        <div className="input">
                          {autoCashout && !betted ? (
                            <input type="number" value={bet.target} onChange={e => setBetState({ target: Number(e.target.value) })} onBlur={e => { const v = Number(e.target.value); setBetState({ target: v < 1.01 ? 1.01 : Math.round(v * 100) / 100 }); }} />
                          ) : (
                            <input type="number" value={bet.target.toFixed(2)} readOnly />
                          )}
                        </div>
                        <span className="text">x</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {autoModalOpen && (
          <div className="modal-overlay">
            <div className="modal-backdrop" onClick={() => setAutoModalOpen(false)}></div>
            <div className="modal-dialog">
              <div className="modal-header">
                <span>Auto play options</span>
                <button className="close" onClick={() => setAutoModalOpen(false)}>x</button>
              </div>
              <div className="modal-body">
                <div className="content-part content-part-1">
                  <span>Number of Rounds:</span>
                  <div className="rounds-wrap">
                    {[10, 20, 50, 100].map(n => (
                      <button key={n} className={`btn-secondary ${autoRounds === n ? 'onClick' : ''}`} onClick={() => setAutoRounds(n)}>{n}</button>
                    ))}
                  </div>
                </div>
                <div className="content-part">
                  <div className={`input-switch ${autoStopDec ? '' : 'off'}`} onClick={() => setAutoStopDec(!autoStopDec)}>
                    <span className="oval"></span>
                  </div>
                  <span className="title">Stop if cash decreases by</span>
                  <div className="spinner">
                    {autoStopDec ? (
                      <div className="m-spinner">
                        <div className="buttons"><button className="minus" onClick={() => setAutoStopDecAmt(prev => Math.max(0, prev - 1))}></button></div>
                        <div className="input"><input type="number" value={autoStopDecAmt} onChange={e => setAutoStopDecAmt(Number(e.target.value))} /></div>
                        <div className="buttons"><button className="plus" onClick={() => setAutoStopDecAmt(prev => prev + 1)}></button></div>
                      </div>
                    ) : (
                      <div className="m-spinner disabled"><div className="buttons"><button disabled className="minus"></button></div><div className="input"><input type="number" value="0.00" readOnly /></div><div className="buttons"><button disabled className="plus"></button></div></div>
                    )}
                  </div>
                  <span>INR</span>
                </div>
                <div className="content-part">
                  <div className={`input-switch ${autoStopInc ? '' : 'off'}`} onClick={() => setAutoStopInc(!autoStopInc)}>
                    <span className="oval"></span>
                  </div>
                  <span className="title">Stop if cash increases by</span>
                  <div className="spinner">
                    {autoStopInc ? (
                      <div className="m-spinner">
                        <div className="buttons"><button className="minus" onClick={() => setAutoStopIncAmt(prev => Math.max(0, prev - 1))}></button></div>
                        <div className="input"><input type="number" value={autoStopIncAmt} onChange={e => setAutoStopIncAmt(Number(e.target.value))} /></div>
                        <div className="buttons"><button className="plus" onClick={() => setAutoStopIncAmt(prev => prev + 1)}></button></div>
                      </div>
                    ) : (
                      <div className="m-spinner disabled"><div className="buttons"><button disabled className="minus"></button></div><div className="input"><input type="number" value="0.00" readOnly /></div><div className="buttons"><button disabled className="plus"></button></div></div>
                    )}
                  </div>
                  <span>INR</span>
                </div>
                <div className="content-part">
                  <div className={`input-switch ${autoStopWin ? '' : 'off'}`} onClick={() => setAutoStopWin(!autoStopWin)}>
                    <span className="oval"></span>
                  </div>
                  <span className="title">Stop if single win exceeds</span>
                  <div className="spinner">
                    {autoStopWin ? (
                      <div className="m-spinner">
                        <div className="buttons"><button className="minus" onClick={() => setAutoStopWinAmt(prev => Math.max(0, prev - 1))}></button></div>
                        <div className="input"><input type="number" value={autoStopWinAmt} onChange={e => setAutoStopWinAmt(Number(e.target.value))} /></div>
                        <div className="buttons"><button className="plus" onClick={() => setAutoStopWinAmt(prev => prev + 1)}></button></div>
                      </div>
                    ) : (
                      <div className="m-spinner disabled"><div className="buttons"><button disabled className="minus"></button></div><div className="input"><input type="number" value="0.00" readOnly /></div><div className="buttons"><button disabled className="plus"></button></div></div>
                    )}
                  </div>
                  <span>INR</span>
                </div>
              </div>
              <div className="modal-footer">
                <div className="btns-wrapper">
                  <button className="reset-btn btn-waiting" onClick={() => {
                    setAutoRounds(10);
                    setAutoStopDec(false); setAutoStopDecAmt(0);
                    setAutoStopInc(false); setAutoStopIncAmt(0);
                    setAutoStopWin(false); setAutoStopWinAmt(0);
                  }}>Reset</button>
                  <button className="start-btn btn-success" onClick={() => {
                    if (autoRounds > 0) {
                      setAutoActive(true);
                      setAutoCount(autoRounds);
                      setAutoModalOpen(false);
                      setBetStateFlag(true);
                    }
                  }}>Start</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <><div className="game-container">
      <div className="game-play">
        <div className="result-history">
          <div className="stats">
            <div className="payouts-wrapper">
              <div className="payouts-block">
                {roundHistory.slice(0, 12).map((r, i) => {
                  const m = typeof r === 'number' ? r : parseFloat(r?.crashMultiplier || r);
                  const opacityClass = `opacity-${Math.min(100, Math.max(32, 100 - 2 * i))}`;
                  return (
                    <div key={i} className="payout">
                      <div className={`item ${opacityClass} ${getMultiplierColor(m)}`}>{m.toFixed(2)}x</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="button-block">
              <div className="button dropdown-toggle" onClick={() => setShowHistory(!showHistory)}>
                <div className="trigger">
                <div className="history-icon"></div>
                        <div className={`dd-icon ${showHistory ? 'up' : ''}`}></div>
                </div>
              </div>
            </div>
            {showHistory && (
              <div className="dropdown-menu" style={{ display: 'block' }}>
                <div className="wrapper">
                  <div className="header-2"><div>Round history</div></div>
                  <div className="payouts-block">
                    {roundHistory.map((r, i) => {
                      const m = typeof r === 'number' ? r : parseFloat(r?.crashMultiplier || r);
                      return <div key={i} className="payout"><div className={`bubble-multiplier ${getMultiplierColor(m)}`}>{m.toFixed(2)}x</div></div>;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="stage-board">
          <div className="play-board-wrapper">
            <div className="stage-canvas">
              <div className="crash-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
                <div className="canvas" style={{ width: '100%', height: '100%' }}>
                  <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
                </div>
                <canvas ref={confettiCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }} />
                <div className="crash-text-container">
                  {gameState === 'BET' ? (
                    <div className="crashtext wait" style={{ fontSize: '40px' }}>
                      <div className="rotate">
                        <img width={100} height={100} src={propeller} alt="propeller" style={{ width: '100%', height: '100%' }} />
                      </div>
                      <div className="waiting-font">WAITING FOR NEXT ROUND</div>
                      <div className="waiting">
                        <div style={{ width: `${waitingBarWidth}%` }}></div>
                      </div>
                    </div>
                  ) : (
                    <div className={`crashtext ${gameState === 'GAMEEND' ? 'red' : ''}`}>
                      {gameState === 'GAMEEND' && <div className="flew-away">FLEW AWAY!</div>}
                      <div>{multiplierDisplay} <span style={{ fontWeight: 900 }}>x</span></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="dom-container">
              <div className="fun-mode">FUN MODE</div>
              <button className="sound-toggle" onClick={toggleSound} title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}>
                {soundEnabled ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="bet-controls">
          <div className="controls">
            {renderBetPanel('f')}
            {sPanel && renderBetPanel('s')}
          </div>
        </div>
      </div>

      <div className="info-board">
        <div className="bets-block">
          <div className="bet-block-nav">
            <div style={{ height: '24px' }}>
              <div className="navigation-switcher">
                {[{ type: 'all', value: 'All Bets' }, { type: 'my', value: 'My Bets' }, { type: 'top', value: 'Top' }].map(item => (
                  <button key={item.type} className={`tab ${headerType === item.type ? 'click' : ''}`} onClick={() => setHeaderType(item.type)}>{item.value}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="data-list">
            {headerType === 'all' && (
              <>
                <div>
                  <div className="all-bets-block">
                    <div><div className="uppercase">ALL BETS</div><div>{bettedUsers.length}</div></div>
                  </div>
                  <div className="spacer"></div>
                  <div className="legend">
                    <span className="user">User</span>
                    <span className="bet">Bet, INR</span>
                    <span style={{ minWidth: '20%', textAlign: 'center' }}>X</span>
                    <span className="cash-out">Cash out, INR</span>
                  </div>
                </div>
                <div className="bets-scroll">
                  {bettedUsers.map((u, i) => (
                    <div key={i} className={`bet-item ${u.cashouted ? 'celebrated' : u.crashed ? 'crashed' : ''}`}>
                      <div className="user">
                        <img className="avatar" src={`https://api.dicebear.com/7.x/identicon/png?seed=${u.name || 'user'}&size=16`} alt="" />
                        <div className="username">{u.name || 'u***r'}</div>
                      </div>
                      <div className="bet-amount">{(u.betAmount || 0).toFixed(2)}</div>
                      {u.cashouted && (
                        <div className="multiplier-block">
                          <div className="bubble">{(u.cashOut || 0).toFixed(2)}</div>
                        </div>
                      )}
                      {u.crashed && (
                        <div className="multiplier-block">
                          <div className="bubble crashed-bubble">X</div>
                        </div>
                      )}
                      <div className="cash-out-amount">{u.cashouted ? (u.betAmount * u.cashOut || 0).toFixed(2) : ''}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {headerType === 'my' && (
              <>
                <div className="legend" style={{ padding: '0 10px' }}>
                  <div className="date" style={{ minWidth: '25%' }}>Date</div>
                  <div className="bet-100" style={{ display: 'flex', flex: 1, justifyContent: 'space-around' }}>
                    <span className="bet">Bet, INR</span><span>X</span><span className="cash-out">Cash out, INR</span>
                  </div>
                  <div className="tools" style={{ width: 30 }}></div>
                </div>
                <div className="bets-scroll">
                  {myBets.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#7b7b7b', padding: 20, fontSize: 12 }}>No bets yet</div>
                  ) : (
                    myBets.map((b, i) => {
                      const won = parseFloat(b.cashoutAt) > 0;
                      return (
                        <div key={b._id || i} className={`bet-item ${won ? 'celebrated' : ''}`}>
                          <div className="user" style={{ width: 'auto', minWidth: '25%' }}>
                            <div className="username" style={{ fontSize: 11 }}>
                              {b.date ? new Date(b.date).getHours() + ':' + String(new Date(b.date).getMinutes()).padStart(2, '0') : '--:--'}
                            </div>
                          </div>
                          <div className="bet-amount">{(b.betAmount || 0).toFixed(2)}</div>
                          {won && <div className="multiplier-block"><div className="bubble">{(b.cashoutAt || 0).toFixed(2)}</div></div>}
                          <div className="cash-out-amount">{won ? (b.betAmount * b.cashoutAt || 0).toFixed(2) : ''}</div>
                          <div className="tools" style={{ width: 30, display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <div className="fairness-i" style={{ width: 12, height: 12, background: 'rgba(255,255,255,0.2)', borderRadius: '50%' }}></div>
                            <div className="share-i" style={{ width: 12, height: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
            {headerType === 'top' && (
              <>
                <div className="navigation-switcher-wrapper" style={{ padding: '5px 10px' }}>
                  <div className="navigation-switcher" style={{ display: 'flex', background: '#141516', borderRadius: 10, border: 'solid 1px #141516', height: 24 }}>
                    {['Day', 'Month', 'Year'].map(t => (
                      <button key={t} className="tab click" style={{ width: 70, height: '100%', textAlign: 'center', background: 'rgb(44, 45, 48)', border: 'none', color: 'white', cursor: 'pointer', fontSize: 11, borderRadius: t === 'Day' ? '10px 0 0 10px' : t === 'Year' ? '0 10px 10px 0' : 0 }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="top-list-wrapper" style={{ flex: 1, overflow: 'auto' }}>
                  {previousHand.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#7b7b7b', padding: 20, fontSize: 12 }}>No top wins yet</div>
                  ) : (
                    previousHand.slice(0, 20).map((u, i) => (
                      <div key={i} className="bet-item" style={{ flexDirection: 'column', height: 'auto', padding: '8px 10px', alignItems: 'flex-start' }}>
                        <div className="main" style={{ display: 'flex', width: '100%', gap: 8 }}>
                          <div className="icon" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <img className="avatar" alt="avatar" src={`https://api.dicebear.com/7.x/identicon/png?seed=${u.userName || 'user'}&size=16`} style={{ width: 16, height: 16, borderRadius: '50%' }} />
                            <div className="username" style={{ fontSize: 12, color: '#9ea0a3' }}>{u.userName || 'u***r'}</div>
                          </div>
                          <div className="score" style={{ fontSize: 11, marginLeft: 'auto' }}>
                            <div><span>Win: </span><span style={{ color: '#28a909' }}>{(u.f?.cashAmount || 0).toFixed(2)}</span></div>
                            <div><span>@ </span><span style={{ color: 'rgb(52, 180, 255)' }}>{(u.f?.target || 1).toFixed(2)}x</span></div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div></>
  );
}