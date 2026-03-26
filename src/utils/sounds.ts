// Simple Web Audio API sound effects - no external dependencies
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.1) {
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

export function soundCatch() {
  playTone(600, 0.1, 'sine', 0.25);
  setTimeout(() => playTone(900, 0.15, 'sine', 0.2), 80);
}

export function soundDeposit() {
  playTone(500, 0.08, 'sine', 0.2);
  setTimeout(() => playTone(700, 0.08, 'sine', 0.2), 60);
  setTimeout(() => playTone(1000, 0.2, 'sine', 0.25), 120);
}

export function soundSteal() {
  playTone(300, 0.15, 'sawtooth', 0.15);
  setTimeout(() => playTone(400, 0.15, 'sawtooth', 0.15), 100);
}

export function soundLoseChicken() {
  playTone(500, 0.1, 'square', 0.15);
  setTimeout(() => playTone(300, 0.2, 'square', 0.15), 80);
}

export function soundFreeze() {
  playTone(1200, 0.3, 'sine', 0.15);
  playTone(1500, 0.4, 'sine', 0.1);
}

export function soundVolcano() {
  playNoise(0.5, 0.2);
  playTone(80, 0.4, 'sawtooth', 0.2);
}

export function soundLuckBox() {
  playTone(800, 0.05, 'sine', 0.2);
  setTimeout(() => playTone(1000, 0.05, 'sine', 0.2), 50);
  setTimeout(() => playTone(1200, 0.1, 'sine', 0.2), 100);
}

export function soundGameOver() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.3, 'sine', 0.2), i * 150);
  });
}

export function soundAbility() {
  playTone(400, 0.1, 'square', 0.15);
  setTimeout(() => playTone(600, 0.1, 'square', 0.15), 50);
  setTimeout(() => playTone(800, 0.15, 'triangle', 0.2), 100);
}

export function soundObstacleHit() {
  playNoise(0.2, 0.15);
  playTone(150, 0.2, 'sawtooth', 0.15);
}

export function soundDarkness() {
  playTone(200, 0.5, 'sine', 0.1);
  playTone(150, 0.6, 'sine', 0.08);
}

export function resumeAudio() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
