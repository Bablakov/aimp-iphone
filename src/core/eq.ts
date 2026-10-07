import { signal } from "@preact/signals";
import { kvGet, kvSet } from "./db";
import type { EqState } from "./types";

/** Классические 10 октавных полос. */
export const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_RANGE = 15; // ±дБ

export const EQ_PRESETS: Record<string, number[]> = {
  "Плоский": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Бас": [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  "Вокал": [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1],
  "Рок": [5, 4, 2, -1, -2, -1, 2, 4, 5, 5],
  "Поп": [-1, 2, 4, 5, 3, 0, -1, -1, -1, -1],
  "Джаз": [3, 2, 1, 2, -2, -2, 0, 1, 2, 3],
  "Классика": [0, 0, 0, 0, 0, 0, -2, -3, -3, -5],
  "Танцы": [6, 5, 2, 0, 0, -3, -4, -4, 0, 0],
  "Высокие": [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
};

const DEFAULT: EqState = { enabled: false, preamp: 0, gains: EQ_PRESETS["Плоский"].slice(), preset: "Плоский" };

export const eq = signal<EqState>(DEFAULT);

// Граф Web Audio создаётся лениво — только когда эквалайзер реально включили. Пока он не создан,
// звук идёт напрямую через <audio>: это самый надёжный путь для фонового воспроизведения на iOS.
let ctx: AudioContext | null = null;
let preGain: GainNode | null = null;
let filters: BiquadFilterNode[] = [];

export const eqSupported = typeof window !== "undefined" && !!(window.AudioContext || (window as any).webkitAudioContext);

export async function loadEq(): Promise<void> {
  const saved = await kvGet<EqState>("eq");
  if (saved && Array.isArray(saved.gains) && saved.gains.length === EQ_FREQS.length) eq.value = saved;
}

function persist(): void {
  void kvSet("eq", eq.value);
}

function applyParams(): void {
  if (!ctx || !preGain) return;
  const { enabled, preamp, gains } = eq.value;
  const t = ctx.currentTime;
  preGain.gain.setTargetAtTime(enabled ? Math.pow(10, preamp / 20) : 1, t, 0.015);
  filters.forEach((f, i) => f.gain.setTargetAtTime(enabled ? gains[i] : 0, t, 0.015));
}

/**
 * Подключает <audio> к графу. Вызывать из обработчика нажатия (iOS не даёт запускать
 * AudioContext без жеста). Подключение необратимо: «выключить» — значит обнулить фильтры.
 */
export function ensureGraph(audio: HTMLMediaElement): void {
  if (!eqSupported || !eq.value.enabled) return;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new Ctor() as AudioContext;
    const src = ctx.createMediaElementSource(audio);
    preGain = ctx.createGain();
    filters = EQ_FREQS.map((f, i) => {
      const b = ctx!.createBiquadFilter();
      b.type = i === 0 ? "lowshelf" : i === EQ_FREQS.length - 1 ? "highshelf" : "peaking";
      b.frequency.value = f;
      b.Q.value = 1.1;
      return b;
    });
    src.connect(preGain);
    [preGain, ...filters].reduce((a, b) => (a.connect(b), b)).connect(ctx.destination);
    ctx.addEventListener("statechange", () => {
      // iOS приостанавливает контекст при прерываниях (звонок, Siri) — возвращаем звук.
      if (ctx?.state === "interrupted" || ctx?.state === "suspended") void ctx.resume().catch(() => {});
    });
  }
  if (ctx.state !== "running") void ctx.resume().catch(() => {});
  applyParams();
}

export function setEnabled(on: boolean, audio: HTMLMediaElement): void {
  eq.value = { ...eq.value, enabled: on };
  if (on) ensureGraph(audio);
  applyParams();
  persist();
}

export function setBand(i: number, db: number): void {
  const gains = eq.value.gains.slice();
  gains[i] = Math.max(-EQ_RANGE, Math.min(EQ_RANGE, Math.round(db * 2) / 2));
  eq.value = { ...eq.value, gains, preset: "Свой" };
  applyParams();
  persist();
}

export function setPreamp(db: number): void {
  eq.value = { ...eq.value, preamp: Math.max(-EQ_RANGE, Math.min(EQ_RANGE, Math.round(db * 2) / 2)) };
  applyParams();
  persist();
}

export function applyPreset(name: string): void {
  const g = EQ_PRESETS[name];
  if (!g) return;
  eq.value = { ...eq.value, gains: g.slice(), preset: name };
  applyParams();
  persist();
}
