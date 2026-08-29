/** Track as returned by the API (mirrors server ApiTrack). */
export type Track = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration: number | null;
  artworkUrl: string | null;
  streamUrl: string;
  dateAdded: number;
};

export type UploadError = { filename: string; error: string };

/** A user-created album (summary, for list/cards). */
export type Album = {
  id: string;
  name: string;
  createdAt: number;
  trackCount: number;
  coverUrl: string | null;
};

/** Album detail with its ordered tracks. */
export type AlbumDetail = {
  id: string;
  name: string;
  createdAt: number;
  tracks: Track[];
};
