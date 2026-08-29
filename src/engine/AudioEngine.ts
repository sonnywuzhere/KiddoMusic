/**
 * AudioEngine — a framework-agnostic wrapper around an HTMLAudioElement routed
 * through the Web Audio API.
 *
 * Why both: the <audio> element gives us native streaming, buffering, and HTTP
 * range-request seeking for free, while the Web Audio graph
 * (MediaElementSource → Analyser → destination) exposes frequency/waveform data
 * for the audio-reactive backdrop in Phase 4. The Web Audio graph is created
 * lazily on first play() so the AudioContext starts inside a user gesture
 * (browser autoplay policy).
 *
 * This lives outside React as a single instance, so playback survives component
 * unmounts/remounts and screen changes (Phase 3 "persist across navigation").
 */
export type AudioEngineEvents = {
  onTime?: (currentTime: number) => void;
  onDuration?: (duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
  onWaiting?: () => void;
  onCanPlay?: () => void;
};

export class AudioEngine {
  private audio: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private events: AudioEngineEvents = {};

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "auto";

    this.audio.addEventListener("timeupdate", () =>
      this.events.onTime?.(this.audio.currentTime),
    );
    this.audio.addEventListener("durationchange", () => {
      if (Number.isFinite(this.audio.duration))
        this.events.onDuration?.(this.audio.duration);
    });
    this.audio.addEventListener("play", () => this.events.onPlay?.());
    this.audio.addEventListener("pause", () => this.events.onPause?.());
    this.audio.addEventListener("ended", () => this.events.onEnded?.());
    this.audio.addEventListener("waiting", () => this.events.onWaiting?.());
    this.audio.addEventListener("canplay", () => this.events.onCanPlay?.());
    this.audio.addEventListener("error", () =>
      this.events.onError?.("Playback error — the file may be missing or unsupported."),
    );
  }

  setEvents(events: AudioEngineEvents) {
    this.events = events;
  }

  /** Build the Web Audio graph once, after a user gesture. Degrades gracefully. */
  private ensureGraph() {
    if (this.ctx) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      this.sourceNode = this.ctx.createMediaElementSource(this.audio);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    } catch {
      // Web Audio unavailable — the element still plays on its own.
      this.ctx = null;
      this.analyser = null;
    }
  }

  /** Point the engine at a new source. Does not auto-play. */
  load(url: string) {
    this.audio.src = url;
    this.audio.load();
  }

  async play() {
    this.ensureGraph();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
    try {
      await this.audio.play();
    } catch {
      // e.g. user gesture missing, or the source failed — surface via onError.
      this.events.onError?.("Couldn't start playback.");
    }
  }

  pause() {
    this.audio.pause();
  }

  seek(seconds: number) {
    if (Number.isFinite(seconds)) this.audio.currentTime = seconds;
  }

  setVolume(v: number) {
    this.audio.volume = Math.min(1, Math.max(0, v));
  }

  get currentTime() {
    return this.audio.currentTime;
  }

  get duration() {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
  }

  /** For Phase 4 audio-reactive visuals; null until the graph is built. */
  getAnalyser() {
    return this.analyser;
  }
}

// Single shared instance — the app's one source of playback truth.
export const audioEngine = new AudioEngine();
