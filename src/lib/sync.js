/* Estado global de sincronización con la base de datos (para los badges).
   La UI cambia al instante (optimistic) y aquí se cuenta lo que falta por llegar a la hoja. */
import { useSyncExternalStore } from "react";

let state = { pending: 0, queued: 0, online: typeof navigator === "undefined" ? true : navigator.onLine, error: "", last: 0 };
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const set = (p) => { state = { ...state, ...p }; emit(); };

if (typeof window !== "undefined") {
  window.addEventListener("online", () => set({ online: true }));
  window.addEventListener("offline", () => set({ online: false }));
}

export function track(promise) {
  set({ pending: state.pending + 1, error: "" });
  return promise.then(
    (r) => { set({ pending: Math.max(0, state.pending - 1), last: Date.now() }); return r; },
    (e) => { set({ pending: Math.max(0, state.pending - 1), error: e?.network ? "" : e?.message || "Error" }); throw e; },
  );
}
export const setQueued = (n) => set({ queued: n });
export const markSynced = () => set({ last: Date.now(), error: "" });

export function useSync() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
}
