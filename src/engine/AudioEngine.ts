/**
 * AudioEngine — a framework-agnostic wrapper around an HTMLAudioElement routed
 * through the Web Audio API.
 *
 * Why both: the <audio> element gives us native streaming, buffering, and HTTP
 * range-request seeking for free, while the Web Audio graph
 * (MediaElementSource → Analyser → destination) exposes frequency/waveform data
 * for the (currently unused) audio-reactive backdrop. The graph is built
 * lazily on first getAnalyser() call, NOT on play() — once built, it captures
 * all of the element's output, and mobile browsers suspend AudioContexts in
 * the background/on lock, which would otherwise silently kill background
 * playback. Until something actually calls getAnalyser(), playback stays on
 * the element's native output path, which backgrounds far more reliably.
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

    // Mobile browsers can suspend the AudioContext when the tab backgrounds
    // (screen lock, app switch) even while the <audio> element itself keeps
    // reporting "playing" — since Web Audio reroutes all its output through
    // the context, that leaves playback silently stuck: no error, no sound.
    // Re-resume once we're back in the foreground, but only if we actually
    // intend to be playing (audio.paused is the same signal onPlay/onPause
    // already derive from) — never resume a context for a genuinely paused
    // track. Both events call the same handler, idempotent, as belt-and-
    // suspenders for inconsistent iOS Safari foregrounding events.
    document.addEventListener("visibilitychange", this.handleForeground);
    window.addEventListener("focus", this.handleForeground);
  }

  private handleForeground = () => {
    if (
      document.visibilityState === "visible" &&
      this.ctx?.state === "suspended" &&
      !this.audio.paused
    ) {
      void this.ctx.resume();
    }
  };

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
    // Deliberately does NOT build the Web Audio graph here. Once
    // createMediaElementSource() taps this.audio, all of its output is
    // rerouted through the AudioContext — and mobile Safari/Chrome routinely
    // suspend that context when the tab backgrounds or the screen locks,
    // which silences playback even though the <audio> element itself keeps
    // reporting paused=false (so Media Session still shows "playing" with no
    // sound reaching the speaker). The analyser this graph exists for
    // (getAnalyser(), for a future audio-reactive backdrop) has no callers
    // anywhere in the app yet, so for now playback stays on the element's
    // native output path, which mobile OSes handle far more reliably in the
    // background. The graph is still built lazily — see getAnalyser() — for
    // whenever that feature is actually implemented; revisit this trade-off
    // then (e.g. only building the graph while the tab is foregrounded).
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

  /**
   * For Phase 4 audio-reactive visuals. Builds the Web Audio graph on first
   * call (not on play()) — see the comment in play() for why. Null if Web
   * Audio itself is unavailable.
   */
  getAnalyser() {
    this.ensureGraph();
    return this.analyser;
  }
}

// Single shared instance — the app's one source of playback truth.
export const audioEngine = new AudioEngine();
