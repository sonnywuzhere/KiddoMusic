import LibraryView from "./components/Library/LibraryView";
import MiniPlayer from "./components/MiniPlayer/MiniPlayer";

/**
 * Phases 1–2: upload + a browsable, searchable, sortable library with a
 * persistent now-playing bar. Phase 3 adds the real playback engine; Phase 4
 * the full-screen Now Playing takeover.
 */
export default function App() {
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

      <MiniPlayer />
    </div>
  );
}
