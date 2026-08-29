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
