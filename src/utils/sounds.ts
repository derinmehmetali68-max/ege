// Web Audio API sound effects for Kahoot-like experience

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.3) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not supported - silently fail
  }
}

export function playCorrectSound() {
  // Happy ascending notes
  playTone(523, 0.15, "sine", 0.25); // C5
  setTimeout(() => playTone(659, 0.15, "sine", 0.25), 100); // E5
  setTimeout(() => playTone(784, 0.3, "sine", 0.3), 200); // G5
}

export function playWrongSound() {
  // Descending buzz
  playTone(300, 0.2, "sawtooth", 0.15);
  setTimeout(() => playTone(200, 0.3, "sawtooth", 0.15), 150);
}

export function playTickSound() {
  playTone(800, 0.05, "sine", 0.1);
}

export function playCountdownTickSound() {
  playTone(440, 0.08, "square", 0.15);
}

export function playCountdownUrgentSound() {
  // Last 5 seconds - higher pitch
  playTone(880, 0.1, "square", 0.2);
}

export function playStartSound() {
  // Fanfare-like start
  playTone(523, 0.15, "sine", 0.2);
  setTimeout(() => playTone(659, 0.15, "sine", 0.2), 120);
  setTimeout(() => playTone(784, 0.15, "sine", 0.2), 240);
  setTimeout(() => playTone(1047, 0.4, "sine", 0.3), 360);
}

export function playStreakSound(streak: number) {
  // Higher pitch for longer streaks
  const baseFreq = 600 + streak * 50;
  playTone(baseFreq, 0.1, "sine", 0.2);
  setTimeout(() => playTone(baseFreq * 1.25, 0.1, "sine", 0.2), 80);
  setTimeout(() => playTone(baseFreq * 1.5, 0.2, "sine", 0.25), 160);
}

export function playPowerUpSound() {
  playTone(400, 0.1, "sine", 0.2);
  setTimeout(() => playTone(600, 0.1, "sine", 0.2), 80);
  setTimeout(() => playTone(800, 0.1, "sine", 0.2), 160);
  setTimeout(() => playTone(1200, 0.2, "sine", 0.25), 240);
}

export function playPodiumSound() {
  // Victory fanfare
  const notes = [523, 659, 784, 1047, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.2, "sine", 0.25), i * 150);
  });
}

export function playLobbyTickSound() {
  playTone(600, 0.15, "triangle", 0.2);
}

export function playTimeUpSound() {
  playTone(200, 0.5, "sawtooth", 0.2);
}
