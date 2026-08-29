import { useEffect, useState } from "react";

type HealthState =
  | { status: "loading" }
  | { status: "ok"; time: string }
  | { status: "error"; message: string };

/**
 * Phase 0 shell. Its only real job right now is to prove the client can reach
 * the Express API through the Vite proxy via GET /api/health. Real screens
 * (Library, Upload, NowPlaying) arrive in later phases.
 */
export default function App() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { status: string; time: string }) => {
        if (!cancelled) setHealth({ status: "ok", time: data.time });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setHealth({
            status: "error",
            message: err instanceof Error ? err.message : "unknown error",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <div>
        <h1 className="bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-5xl font-semibold tracking-tight text-transparent">
          KiddoMusic
        </h1>
        <p className="mt-3 text-sm text-white/50">
          Immersive music player — Phase 0 scaffold
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
        <span
          className={
            "inline-block h-2.5 w-2.5 rounded-full " +
            (health.status === "ok"
              ? "bg-emerald-400"
              : health.status === "error"
                ? "bg-red-400"
                : "animate-pulse bg-amber-400")
          }
        />
        {health.status === "loading" && <span>Checking API…</span>}
        {health.status === "ok" && (
          <span>
            API healthy ·{" "}
            <span className="text-white/50">
              {new Date(health.time).toLocaleTimeString()}
            </span>
          </span>
        )}
        {health.status === "error" && (
          <span className="text-red-300">API unreachable: {health.message}</span>
        )}
      </div>
    </main>
  );
}
