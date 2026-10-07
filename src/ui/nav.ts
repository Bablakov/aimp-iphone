import { signal } from "@preact/signals";
import { clearSelection } from "./select";

export type TabName = "tracks" | "albums" | "artists" | "playlists" | "settings";

export type Layer =
  | { type: "album"; key: string }
  | { type: "artist"; key: string }
  | { type: "playlist"; key: string }
  | { type: "picker"; playlistId: string }
  | { type: "player" }
  | { type: "queue" }
  | { type: "eq" };

export const tab = signal<TabName>("tracks");
/** Стек экранов поверх вкладок. Каждый слой — запись в history, поэтому жест «назад» в iOS закрывает верхний. */
export const layers = signal<Layer[]>([]);

export function openLayer(layer: Layer): void {
  clearSelection();
  layers.value = [...layers.value, layer];
  history.pushState({ depth: layers.value.length }, "");
}

export function closeLayer(): void {
  if (layers.value.length) history.back();
}

/** Закрывает все слои сразу (например, при переключении вкладки). */
export function resetLayers(): void {
  const n = layers.value.length;
  if (n) history.go(-n);
}

export function selectTab(t: TabName): void {
  clearSelection();
  resetLayers();
  tab.value = t;
}

export function initNav(): void {
  window.addEventListener("popstate", (e) => {
    clearSelection();
    const depth: number = e.state?.depth ?? 0;
    if (depth < layers.value.length) layers.value = layers.value.slice(0, depth);
  });
}
