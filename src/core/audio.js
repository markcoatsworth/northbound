// Procedural arcade-style sound effects synthesized with the Web Audio API
// (oscillator sweeps + noise bursts) instead of shipped audio files. Browsers
// block audio until a user gesture, so the AudioContext is created lazily on
// the first keydown/pointerdown and left alive for the rest of the session.
const UNLOCK_EVENTS = ["pointerdown", "keydown"];

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
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
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
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
    gain.connect(this.ctx.destination);
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
    gain.connect(this.ctx.destination);
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
}
