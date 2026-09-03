import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import LibraryView from "./components/Library/LibraryView";
import AlbumsView from "./components/Albums/AlbumsView";
import UploadZone from "./components/Upload/UploadZone";
import MiniPlayer from "./components/MiniPlayer/MiniPlayer";
import NowPlayingTakeover from "./components/NowPlaying/NowPlayingTakeover";
import { usePlaybackStore } from "./store/playbackStore";

type Tab = "library" | "albums" | "addSong";

const TABS: { id: Tab; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "albums", label: "Albums" },
  { id: "addSong", label: "Add song" },
];

/**
 * Upload + browsable library + custom albums + real playback + the full-screen
 * Now Playing takeover. The takeover overlays everything; the mini-player is
 * the entry point.
 */
export default function App() {
  const [tab, setTab] = useState<Tab>("library");
  const [takeoverOpen, setTakeoverOpen] = useState(false);
  const currentTrack = usePlaybackStore((s) => s.currentTrack);

  // If playback stops entirely (no current track), leave the takeover.
  useEffect(() => {
    if (!currentTrack) setTakeoverOpen(false);
  }, [currentTrack]);

  return (
    <div className="min-h-full pb-24">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-10">
        <header>
          <h1 className="bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            KiddoMusic
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Your library — upload, browse, and play your own music.
          </p>
        </header>

        {/* Tabs */}
        <nav className="flex gap-1 border-b border-white/10">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors " +
                (tab === id
                  ? "border-indigo-400 text-white"
                  : "border-transparent text-white/50 hover:text-white/80")
              }
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "library" ? (
          <LibraryView />
        ) : tab === "albums" ? (
          <AlbumsView />
        ) : (
          <UploadZone onUploaded={() => setTab("library")} />
        )}
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
