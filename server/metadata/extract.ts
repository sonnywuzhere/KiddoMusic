import { parseBuffer } from "music-metadata";

export type ExtractedMetadata = {
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null; // seconds
  picture: { data: Buffer; format: string } | null; // embedded artwork
};

/**
 * Read embedded tags (ID3, Vorbis, etc.) from an in-memory audio buffer.
 * Returns nulls for anything missing — the upload route decides fallbacks
 * (e.g. title → filename). Never throws for a merely tag-less file; only a
 * genuinely unreadable/corrupt file rejects.
 *
 * Takes a buffer (not a file path) because uploads now go straight to R2 —
 * multer buffers the file in memory rather than writing it to local disk
 * first, so there's no path to hand `parseFile`.
 */
export async function extractMetadata(
  buffer: Buffer,
  mimeType?: string,
): Promise<ExtractedMetadata> {
  const { common, format } = await parseBuffer(buffer, mimeType);

  const pic = common.picture?.[0] ?? null;

  return {
    title: common.title?.trim() || null,
    artist: common.artist?.trim() || null,
    album: common.album?.trim() || null,
    duration: format.duration ?? null,
    picture: pic
      ? { data: Buffer.from(pic.data), format: pic.format }
      : null,
  };
}

/** Map an image mime type to a file extension for saved artwork. */
export function imageExtension(format: string | undefined): string {
  switch ((format ?? "").toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "img";
  }
}
