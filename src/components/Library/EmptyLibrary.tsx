type Props = {
  /** When set, the empty state reflects a search with no matches. */
  searchTerm?: string;
};

/** Friendly empty state for the library — no tracks yet, or no search matches. */
export default function EmptyLibrary({ searchTerm }: Props) {
  const searching = !!searchTerm?.trim();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] text-3xl text-white/30">
        {searching ? "🔍" : "♪"}
      </div>
      {searching ? (
        <>
          <p className="text-sm font-medium text-white/70">
            No tracks match “{searchTerm}”
          </p>
          <p className="text-xs text-white/40">Try a different title, artist, or album.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-white/70">Your library is empty</p>
          <p className="max-w-xs text-xs text-white/40">
            Drag audio files onto the box above, or browse to upload — they'll
            appear here, ready to play.
          </p>
        </>
      )}
    </div>
  );
}
