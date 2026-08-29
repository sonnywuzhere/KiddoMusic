import { motion } from "framer-motion";
import type { Palette, RGB } from "../../engine/colorExtraction";
import { rgbString } from "../../engine/colorExtraction";

type Props = {
  artworkUrl: string | null;
  palette: Palette;
};

// Fixed drift paths so blobs move slowly and ambiently (never distracting).
const BLOB_LAYOUTS = [
  { top: "-10%", left: "-5%", size: "70vmax", x: [0, 60, -30, 0], y: [0, -40, 40, 0] },
  { top: "30%", left: "50%", size: "60vmax", x: [0, -50, 40, 0], y: [0, 50, -30, 0] },
  { top: "50%", left: "-10%", size: "55vmax", x: [0, 40, -20, 0], y: [0, -30, 20, 0] },
  { top: "-15%", left: "45%", size: "50vmax", x: [0, -30, 50, 0], y: [0, 40, -40, 0] },
];

/**
 * Ambient backdrop for the Now Playing takeover (PRD 6.2). Two layers:
 *  1. the album art itself, scaled up and heavily blurred into a full-bleed
 *     color field (the "art blurs into the backdrop" effect);
 *  2. slow-drifting blurred blobs colored from the extracted palette.
 * A dark gradient overlay keeps foreground text legible.
 */
export default function Backdrop({ artworkUrl, palette }: Props) {
  const colors: RGB[] =
    palette.colors.length >= 3
      ? palette.colors
      : [palette.dominant, palette.accent, palette.dominant];

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: rgbString(palette.dominant) }}
    >
      {/* Layer 1: blurred album art */}
      {artworkUrl && (
        <img
          src={artworkUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60"
          style={{ filter: "blur(60px)" }}
        />
      )}

      {/* Layer 2: drifting palette blobs */}
      {BLOB_LAYOUTS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            background: `radial-gradient(circle at center, ${rgbString(
              colors[i % colors.length],
              0.55,
            )} 0%, transparent 65%)`,
            mixBlendMode: "screen",
          }}
          animate={{ x: b.x, y: b.y }}
          transition={{
            duration: 22 + i * 5,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Layer 3: contrast overlay — darker toward the bottom for controls/text */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.65) 100%)",
        }}
      />
    </div>
  );
}
