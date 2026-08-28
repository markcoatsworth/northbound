// Procedural arcade-style sound effects synthesized with the Web Audio API
// (oscillator sweeps + noise bursts) instead of shipped audio files. Browsers
// block audio until a user gesture, so the AudioContext is created lazily on
// the first keydown/pointerdown and left alive for the rest of the session.
const UNLOCK_EVENTS = ["pointerdown", "keydown"];

// A four-part 8-bit-style composition (Intro -> Theme -> Bridge -> Climax,
// then back to Intro) instead of one short vamp on repeat. Every section
// layers bass, a thickened detuned-unison lead, a harmony pluck, a light
// arpeggio and a sustained pad chord; "heavy" sections (Theme, Climax) add
// a distorted power-chord chug, a driving kick, and a snare crack underneath
// the lead riff for a wall-of-sound, heavy-metal-adjacent backing. Notes are
// scheduled with a standard Web Audio lookahead scheduler (per Chris
// Wilson's "A Tale of Two Clocks") so tempo stays rock-solid even if the tab
// is briefly throttled in the background.
const NOTE = {
  E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0,
  A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
  A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
};

// Every chord used across the song, diatonic to A natural minor throughout
// (so nothing ever needs a raised leading tone): bass = [root, fifth] in a
// low octave for the bassline pulse, pad = [root, third, fifth] in a mid
// octave for the sustained chord/harmony/arpeggio layers.
const CHORDS = {
  Am: { bass: [NOTE.A2, NOTE.E3], pad: [NOTE.A3, NOTE.C4, NOTE.E4] },
  F: { bass: [NOTE.F2, NOTE.C3], pad: [NOTE.F3, NOTE.A3, NOTE.C4] },
  C: { bass: [NOTE.C3, NOTE.G3], pad: [NOTE.C4, NOTE.E4, NOTE.G4] },
  G: { bass: [NOTE.G2, NOTE.D3], pad: [NOTE.G3, NOTE.B3, NOTE.D4] },
  Em: { bass: [NOTE.E2, NOTE.B2], pad: [NOTE.E3, NOTE.G3, NOTE.B3] },
};

// A soft-clip waveshaper curve (the standard Web Audio distortion recipe),
// precomputed once — this is what turns the rhythm layer's power chords
// into a driven, heavy-metal-style "wall of sound" instead of a clean tone.
function makeDistortionCurve(amount) {
  const n = 4096;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}
const DISTORTION_CURVE = makeDistortionCurve(55);

// Bass plays this root/fifth pulse every bar, whatever the chord.
const BASS_STEP_PATTERN = ["root", null, "root", null, "fifth", null, "root", null];

const SONG = [
  {
    name: "intro",
    progression: ["Am", "Am", "F", "G"],
    lead: [NOTE.A4, null, NOTE.C5, null, NOTE.A4, null, NOTE.E4, null],
    harmony: false,
    arp: false,
    heavy: false,
    percussion: "sparse",
    volumeScale: 0.75,
  },
  {
    name: "theme",
    progression: ["Am", "F", "C", "G"],
    lead: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.C5, NOTE.D5, NOTE.C5, NOTE.B4, NOTE.A4],
    harmony: true,
    arp: true,
    heavy: true,
    percussion: "full",
    volumeScale: 1.0,
  },
  {
    name: "bridge",
    progression: ["C", "Em", "F", "G"],
    lead: [NOTE.C5, null, NOTE.G4, null, NOTE.E4, null, NOTE.G4, NOTE.B4],
    harmony: false,
    arp: true,
    heavy: false,
    percussion: "sparse",
    volumeScale: 0.85,
  },
  {
    name: "climax",
    progression: ["Am", "F", "C", "G"],
    lead: [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.B4, NOTE.A4],
    harmony: true,
    arp: true,
    heavy: true,
    percussion: "full",
    volumeScale: 1.0,
  },
];

// Flatten the song into one bar-per-entry sequence so a global step index
// can be mapped straight to (section, chord, position-in-bar) — each
// section repeats its 4-bar progression/lead for as many bars as it lists.
const BAR_SEQUENCE = SONG.flatMap((section) =>
  section.progression.map((chordName) => ({ section, chordName }))
);

const STEPS_PER_BAR = 8;
const TOTAL_BARS = BAR_SEQUENCE.length;
const TOTAL_STEPS = TOTAL_BARS * STEPS_PER_BAR;
const BPM = 150;
const STEP_DURATION = 60 / BPM / 2; // an eighth note at BPM
const SCHEDULE_AHEAD = 0.12; // seconds of lookahead per scheduler tick
const SCHEDULER_INTERVAL_MS = 25;

class ChiptuneLoop {
  constructor(ctx, destination, getVolume) {
    this.ctx = ctx;
    this.destination = destination;
    this._getVolume = getVolume;
    this.playing = false;
    this._stepIndex = 0;
    this._nextStepTime = 0;
    this._timerId = null;
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this._stepIndex = 0;
    this._nextStepTime = this.ctx.currentTime + 0.1;
    this._tick();
    this._timerId = setInterval(() => this._tick(), SCHEDULER_INTERVAL_MS);
  }

  stop() {
    this.playing = false;
    if (this._timerId !== null) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  }

  _tick() {
    while (this._nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      this._scheduleStep(this._stepIndex, this._nextStepTime);
      this._nextStepTime += STEP_DURATION;
      this._stepIndex = (this._stepIndex + 1) % TOTAL_STEPS;
    }
  }

  _scheduleStep(step, time) {
    const masterVolume = this._getVolume();
    if (masterVolume <= 0) return;

    const barGlobal = Math.floor(step / STEPS_PER_BAR) % TOTAL_BARS;
    const stepInBar = step % STEPS_PER_BAR;
    const { section, chordName } = BAR_SEQUENCE[barGlobal];
    const chord = CHORDS[chordName];
    const volume = masterVolume * (section.volumeScale ?? 1);

    const bassSlot = BASS_STEP_PATTERN[stepInBar];
    if (bassSlot) {
      const bassFreq = bassSlot === "root" ? chord.bass[0] : chord.bass[1];
      this._playNote(bassFreq, time, STEP_DURATION * 0.9, "triangle", volume * 0.85);
      // A sub-octave sine underneath for extra low-end weight.
      this._playNote(bassFreq / 2, time, STEP_DURATION * 0.9, "sine", volume * 0.75);
    }

    const leadFreq = section.lead[stepInBar];
    if (leadFreq) this._playLead(leadFreq, time, STEP_DURATION * 0.85, volume);

    // A soft off-beat pluck of the chord's third, filling out the harmony.
    if (section.harmony && stepInBar % 2 === 1) {
      this._playNote(chord.pad[1], time, STEP_DURATION * 0.7, "sawtooth", volume * 0.3);
    }

    // A light root-third-fifth-third arpeggio for shimmer/texture.
    if (section.arp) {
      const arpFreq = [chord.pad[0], chord.pad[1], chord.pad[2], chord.pad[1]][stepInBar % 4];
      this._playNote(arpFreq, time, STEP_DURATION * 0.4, "triangle", volume * 0.18);
    }

    // A sustained synth-pad chord, held under most of the bar.
    if (stepInBar === 0) {
      const padDuration = STEP_DURATION * 7.5;
      for (const padFreq of chord.pad) {
        this._playNote(padFreq, time, padDuration, "sine", volume * 0.14);
      }
    }

    // The heavy layer: a distorted power-chord chug driving every eighth
    // note (the "wall of sound" behind the lead riff), a kick on every
    // beat, and a snare crack on the backbeat.
    if (section.heavy) {
      this._playPowerChord(chord.bass[0] * 2, time, STEP_DURATION * 0.8, volume * 0.9);
      if (stepInBar % 2 === 0) this._playKick(time, volume);
      if (stepInBar === 2 || stepInBar === 6) this._playSnare(time, volume);
    }

    if (section.percussion === "full" && stepInBar % 2 === 1) {
      this._playHat(time, volume);
    } else if (section.percussion === "sparse" && (stepInBar === 3 || stepInBar === 7)) {
      this._playHat(time, volume * 0.85);
    }
  }

  _playNote(freq, time, duration, type, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  /** A detuned two-oscillator unison square lead — thicker than a single tone, like a doubled/chorused synth or guitar line. */
  _playLead(freq, time, duration, volume) {
    for (const detune of [-6, 6]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(detune, time);
      gain.gain.setValueAtTime(volume * 0.26, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      osc.connect(gain);
      gain.connect(this.destination);
      osc.start(time);
      osc.stop(time + duration + 0.02);
    }
  }

  /** A distorted root+fifth+octave power chord through a waveshaper and a lowpass filter — the classic heavy rhythm-guitar chug. */
  _playPowerChord(rootFreq, time, duration, volume) {
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = DISTORTION_CURVE;
    shaper.oversample = "2x";

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);

    for (const freq of [rootFreq, rootFreq * 1.4983, rootFreq * 2]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);
      osc.connect(shaper);
      osc.start(time);
      osc.stop(time + duration + 0.02);
    }
  }

  /** A bandpass-filtered noise crack for the backbeat snare. */
  _playSnare(time, volume) {
    const duration = 0.09;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, time);
    filter.Q.setValueAtTime(0.8, time);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.95, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.destination);
    source.start(time);
  }

  _playKick(time, volume) {
    const duration = 0.15;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + duration);
    gain.gain.setValueAtTime(volume * 0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(this.destination);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  _playHat(time, volume) {
    const duration = 0.03;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(gain);
    gain.connect(this.destination);
    source.start(time);
  }
}

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicVolume = 0.22;
    this.musicEnabled = true;
    this._music = null;
    this._unlock = this._unlock.bind(this);
    for (const evt of UNLOCK_EVENTS) {
      window.addEventListener(evt, this._unlock);
    }
  }

  _unlock() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      // A master limiter/compressor: this is what lets the wall-of-sound
      // layers sit loud and dense (the actual heavy-mix technique) without
      // the peaks of many simultaneous square/sawtooth voices hard-clipping.
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);
      this.compressor.connect(this.ctx.destination);
      this._music = new ChiptuneLoop(this.ctx, this.compressor, () => (this.muted || !this.musicEnabled ? 0 : this.musicVolume));
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    if (this._music && !this._music.playing) this._music.start();
  }

  /** Mutes/unmutes the background loop without tearing down the scheduler. */
  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
  }

  /** A single frequency-swept tone with an exponential decay envelope. */
  _tone({ freq, endFreq, type = "square", duration = 0.12, volume = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + duration);
    }
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** A short burst of decaying white noise, for punchy impacts. */
  _noise({ duration = 0.15, volume = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    source.connect(gain);
    gain.connect(this.compressor);
    source.start(t0);
  }

  /** A short ascending arpeggio, for the level-clear / victory fanfares. */
  _fanfare(freqs, { type = "square", duration = 0.18, volume = 0.18, step = 0.12 } = {}) {
    freqs.forEach((freq, i) => this._tone({ freq, type, duration, volume, delay: i * step }));
  }

  jump() {
    this._tone({ freq: 300, endFreq: 620, type: "square", duration: 0.12, volume: 0.14 });
  }

  shootZ() {
    this._tone({ freq: 900, endFreq: 500, type: "square", duration: 0.08, volume: 0.1 });
  }

  shootX() {
    for (let i = 0; i < 3; i++) {
      this._tone({ freq: 720 - i * 40, endFreq: 320 - i * 20, type: "sawtooth", duration: 0.1, volume: 0.08, delay: i * 0.02 });
    }
  }

  shootC() {
    this._tone({ freq: 200, endFreq: 70, type: "square", duration: 0.25, volume: 0.18 });
    this._noise({ duration: 0.12, volume: 0.07 });
  }

  hit() {
    this._tone({ freq: 500, endFreq: 150, type: "square", duration: 0.08, volume: 0.13 });
  }

  enemyDeath() {
    this._noise({ duration: 0.2, volume: 0.13 });
    this._tone({ freq: 220, endFreq: 60, type: "sawtooth", duration: 0.2, volume: 0.1 });
  }

  playerHurt() {
    this._tone({ freq: 180, endFreq: 90, type: "sawtooth", duration: 0.25, volume: 0.18 });
  }

  bossTelegraph() {
    this._tone({ freq: 110, endFreq: 260, type: "sawtooth", duration: 0.4, volume: 0.16 });
  }

  levelClear() {
    this._fanfare([523, 659, 784, 1046]);
  }

  gameOver() {
    this._fanfare([400, 340, 280, 200], { type: "sawtooth", duration: 0.3, volume: 0.16, step: 0.15 });
  }

  victory() {
    this._fanfare([523, 659, 784, 1046, 1318], { duration: 0.2, volume: 0.2 });
  }

  uiMove() {
    this._tone({ freq: 440, endFreq: 440, type: "square", duration: 0.05, volume: 0.08 });
  }

  uiConfirm() {
    this._fanfare([660, 990], { duration: 0.08, volume: 0.14, step: 0.06 });
  }

  heal() {
    this._fanfare([523, 784, 1046], { type: "sine", duration: 0.16, volume: 0.16, step: 0.07 });
  }
}
