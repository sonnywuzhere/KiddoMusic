import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  trackId: string;
  children: ReactNode;
};

/**
 * Crossfades its children whenever the track changes (PRD 6.4) — a designed
 * moment on skip or auto-advance rather than an instant cut. `popLayout` lets
 * the outgoing and incoming content overlap during the fade.
 */
export default function TrackTransition({ trackId, children }: Props) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={trackId}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
