import type { TimerState } from "./types";

export const POMO_MS = 25 * 60 * 1000;

export function elapsedMs(t: TimerState | null, now = Date.now()): number {
  if (!t) return 0;
  return t.acc_ms + (t.running && t.started_at ? now - new Date(t.started_at).getTime() : 0);
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(r)}` : `${p(m)}:${p(r)}`;
}

let ctx: AudioContext | null = null;
/** Kurzer Ton + Vibration (Handy), z. B. wenn 25 Min. vorbei sind. */
export function signal() {
  try {
    ctx = ctx ?? new AudioContext();
    [0, 0.35, 0.7].forEach((d) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx!.destination);
      g.gain.setValueAtTime(0.0001, ctx!.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.3, ctx!.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx!.currentTime + d + 0.25);
      o.start(ctx!.currentTime + d); o.stop(ctx!.currentTime + d + 0.3);
    });
  } catch { /* kein Ton möglich */ }
  try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch { /* egal */ }
}
