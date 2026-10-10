import type { Track } from "../types";

/**
 * Playback-order helpers for shuffle.
 *
 * `source` is the order the listener asked for (the library list, an album,
 * plus anything appended with "add to queue"). While shuffle is on, playback
 * walks a different order: the current track stays where it is, and only the
 * upcoming tracks are rearranged. Turning shuffle off snaps the index back
 * to that track's place in `source`.
 */

/** Unbiased Fisher–Yates. Does not mutate `items`. */
export function shuffleArray<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
  }
  return next;
}

/**
 * If `items[0]` is `avoid` and there is somewhere else to put it, swap it
 * out of the front. A shuffle that leaves the same song "up next" reads as
 * a no-op, which is the moment someone just turned shuffle on.
 */
function demoteFirst(items: Track[], avoidId: string | undefined, random: () => number): Track[] {
  if (!avoidId || items.length < 2 || items[0].id !== avoidId) return items;
  const swapWith = 1 + Math.floor(random() * (items.length - 1));
  const next = items.slice();
  const tmp = next[0];
  next[0] = next[swapWith];
  next[swapWith] = tmp;
  return next;
}

/** Shuffle the not-yet-played tail. The current track is not included. */
export function shuffleUpcoming(
  upcoming: readonly Track[],
  random: () => number = Math.random,
): Track[] {
  if (upcoming.length < 2) return upcoming.slice();
  return demoteFirst(shuffleArray(upcoming, random), upcoming[0]?.id, random);
}

/**
 * Queue to load for a freshly chosen track. Shuffle plays that track now
 * and randomizes every other track in the context after it. Otherwise the
 * source order is kept and playback starts at `startIndex`.
 */
export function buildPlaybackQueue(
  source: readonly Track[],
  startIndex: number,
  shuffle: boolean,
  random: () => number = Math.random,
): { queue: Track[]; index: number } {
  if (source.length === 0) return { queue: [], index: 0 };
  const start = Math.min(Math.max(startIndex, 0), source.length - 1);
  if (!shuffle || source.length < 2) {
    return { queue: source.slice(), index: start };
  }
  const rest = [...source.slice(0, start), ...source.slice(start + 1)];
  const shuffledRest = demoteFirst(shuffleArray(rest, random), source[start + 1]?.id, random);
  return { queue: [source[start], ...shuffledRest], index: 0 };
}

/**
 * Turn shuffle on without restarting the current track: history (everything
 * already played) stays in the order it was heard, and the tail is shuffled.
 * The current track remains at `index`.
 */
export function shuffleFromHere(
  queue: readonly Track[],
  index: number,
  random: () => number = Math.random,
): Track[] {
  if (index < 0 || index >= queue.length) return queue.slice();
  return [
    ...queue.slice(0, index),
    queue[index],
    ...shuffleUpcoming(queue.slice(index + 1), random),
  ];
}
