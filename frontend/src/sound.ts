/**
 * The game's sound effects, played here on the page rather than inside the game's iframe: on a
 * phone only the page that was tapped may make sound, and the taps land on the Game Boy's
 * buttons. The game asks for a sound by name (a message { kind: 'sound', sound }), and the
 * recipes are the same as the game's own (pokemon-website/src/sound.ts): keep the two in step.
 */
export type Sound = 'bump' | 'door' | 'blip' | 'item';

let context: AudioContext | undefined;
let master: GainNode | undefined;

/** Browsers only allow sound after the first press or tap, so start it then. */
export function unlockSound() {
  if (!context) {
    const Context = window.AudioContext || (window as any).webkitAudioContext;
    context = new Context();
    master = context.createGain();
    master.gain.value = 0.35;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') void context.resume();
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
