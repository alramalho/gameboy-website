/**
 * The game's sound effects, played here on the page rather than inside the game's iframe: on a
 * phone only the page that was tapped may make sound, and the taps land on the Game Boy's
 * buttons. The game asks for a sound by name (a message { kind: 'sound', sound }), and the
 * recipes are the same as the game's own (pokemon-website/src/sound.ts): keep the two in step.
 */
export type Sound = 'bump' | 'door' | 'blip' | 'item';

let context: AudioContext | undefined;
let master: GainNode | undefined;

let silence: HTMLAudioElement | undefined;

/**
 * Browsers only allow sound after the first press or tap, so start it then. On an iPhone in
 * silent mode Web Audio is muted as well, unless the page counts as playing media: ask for that
 * directly where Safari can (audioSession, 17.4+), and elsewhere play a moment of silence as an
 * ordinary audio file, which puts the page in the same mode. A silent sample through Web Audio
 * wakes it fully on older WebKit.
 */
export function unlockSound() {
  const session = (navigator as any).audioSession;
  if (session && session.type !== 'playback') session.type = 'playback';
  if (!silence) {
    silence = new Audio(silentWav());
    silence.setAttribute('playsinline', '');
    silence.play().catch(() => { silence = undefined; }); // try again on the next tap
  }
  if (!context) {
    const Context = window.AudioContext || (window as any).webkitAudioContext;
    context = new Context();
    master = context.createGain();
    master.gain.value = 0.35;
    master.connect(context.destination);
    const blank = context.createBufferSource();
    blank.buffer = context.createBuffer(1, 1, 22050);
    blank.connect(context.destination);
    blank.start(0);
  }
  if (context.state === 'suspended') void context.resume();
}

/** A tenth of a second of silence, as a WAV file in a data URL. */
function silentWav() {
  const rate = 8000, samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)) };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, 'data'); view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit silence sits at the middle value
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return 'data:audio/wav;base64,' + btoa(binary);
}

export function playSound(sound: Sound) {
  if (!context || !master || context.state !== 'running' || !(sound in RECIPES)) return;
  RECIPES[sound](context, master);
}

/** A note: a wave sliding from one pitch to another, with a quick attack and a decay. */
export function tone(ac: AudioContext, out: AudioNode, wave: OscillatorType, from: number, to: number,
  start: number, length: number, volume: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t = ac.currentTime + start;
  osc.type = wave;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + length);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

/** A burst of noise through a band-pass filter sweeping from one frequency to another. */
export function noise(ac: AudioContext, out: AudioNode, from: number, to: number, start: number,
  length: number, volume: number) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * length), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  const gain = ac.createGain();
  const t = ac.currentTime + start;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + length);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  source.connect(filter).connect(gain).connect(out);
  source.start(t);
}

export const RECIPES: Record<Sound, (ac: AudioContext, out: AudioNode) => void> = {
  bump: (ac, out) => {
    tone(ac, out, 'triangle', 140, 60, 0, 0.09, 0.9);
    noise(ac, out, 400, 120, 0, 0.06, 0.35);
  },
  door: (ac, out) => {
    noise(ac, out, 1800, 300, 0, 0.22, 0.4);
    tone(ac, out, 'square', 220, 110, 0.12, 0.12, 0.18);
  },
  blip: (ac, out) => {
    tone(ac, out, 'square', 1320, 1320, 0, 0.045, 0.12);
  },
  item: (ac, out) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, out, 'square', f, f, i * 0.09, 0.09, 0.14));
    tone(ac, out, 'square', 1046.5, 1046.5, 0.36, 0.4, 0.14);
    tone(ac, out, 'triangle', 261.63, 261.63, 0, 0.76, 0.3);
  },
};
