import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import LibraryView from "./components/Library/LibraryView";
import MiniPlayer from "./components/MiniPlayer/MiniPlayer";
import NowPlayingTakeover from "./components/NowPlaying/NowPlayingTakeover";
import { usePlaybackStore } from "./store/playbackStore";

/**
 * Phases 1–4: upload + browsable library + real playback + the full-screen
 * Now Playing takeover. The takeover overlays everything; the mini-player is
 * the entry point.
 */
export default function App() {
  const [takeoverOpen, setTakeoverOpen] = useState(false);
  const currentTrack = usePlaybackStore((s) => s.currentTrack);

  // If playback stops entirely (no current track), leave the takeover.
  useEffect(() => {
    if (!currentTrack) setTakeoverOpen(false);
  }, [currentTrack]);

  return (
    <div className="min-h-full pb-24">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-10">
        <header>
          <h1 className="bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            KiddoMusic
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Your library — upload, browse, and play your own music.
          </p>
        </header>

        <LibraryView />
      </div>

      <MiniPlayer onExpand={() => setTakeoverOpen(true)} />

      <AnimatePresence>
        {takeoverOpen && currentTrack && (
          <NowPlayingTakeover onClose={() => setTakeoverOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
