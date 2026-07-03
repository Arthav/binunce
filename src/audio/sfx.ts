type Tone = "click" | "cash" | "win" | "loss" | "liquidate" | "tick" | "shutter";

let audioContext: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(next: boolean): void {
  enabled = next;
}

export function primeAudio(): void {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
}

function oscillator(
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain: number,
): void {
  if (!audioContext || !enabled) return;
  const osc = audioContext.createOscillator();
  const amp = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(audioContext.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(start: number, duration: number, gain: number): void {
  if (!audioContext || !enabled) return;
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = audioContext.createBufferSource();
  const amp = audioContext.createGain();
  source.buffer = buffer;
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(amp);
  amp.connect(audioContext.destination);
  source.start(start);
}

export function playSfx(tone: Tone): void {
  if (!enabled) return;
  primeAudio();
  if (!audioContext) return;
  const now = audioContext.currentTime;

  if (tone === "click") {
    oscillator(520, now, 0.05, "triangle", 0.04);
  }
  if (tone === "tick") {
    oscillator(880, now, 0.025, "sine", 0.012);
  }
  if (tone === "cash") {
    oscillator(660, now, 0.08, "triangle", 0.05);
    oscillator(880, now + 0.08, 0.08, "triangle", 0.05);
    oscillator(1320, now + 0.16, 0.12, "triangle", 0.04);
  }
  if (tone === "win") {
    [523, 659, 784, 1046].forEach((freq, index) => {
      oscillator(freq, now + index * 0.07, 0.12, "triangle", 0.05);
    });
  }
  if (tone === "loss") {
    [392, 330, 262].forEach((freq, index) => {
      oscillator(freq, now + index * 0.12, 0.16, "sawtooth", 0.035);
    });
  }
  if (tone === "liquidate") {
    oscillator(82, now, 0.5, "sawtooth", 0.08);
    noise(now, 0.42, 0.05);
  }
  if (tone === "shutter") {
    noise(now, 0.08, 0.035);
    oscillator(1200, now + 0.04, 0.04, "square", 0.03);
  }
}
