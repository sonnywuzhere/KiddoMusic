type Props = { view: "grid" | "list" };

/** Placeholder shimmer while the library loads, matching the active view. */
export default function LibrarySkeleton({ view }: Props) {
  const items = Array.from({ length: 8 });

  if (view === "grid") {
    return (
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {items.map((_, i) => (
          <li key={i} className="animate-pulse">
            <div className="aspect-square w-full rounded-xl bg-white/[0.06]" />
            <div className="mt-2 h-3 w-3/4 rounded bg-white/[0.06]" />
            <div className="mt-1.5 h-2.5 w-1/2 rounded bg-white/[0.04]" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-white/5">
      {items.map((_, i) => (
        <li key={i} className="flex animate-pulse items-center gap-4 py-3">
          <div className="h-12 w-12 flex-none rounded-md bg-white/[0.06]" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-1/3 rounded bg-white/[0.06]" />
            <div className="mt-1.5 h-2.5 w-1/4 rounded bg-white/[0.04]" />
          </div>
        </li>
      ))}
    </ul>
  );
}
