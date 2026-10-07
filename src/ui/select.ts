import { signal } from "@preact/signals";

/**
 * Режим выбора нескольких треков. `null` — обычный режим, иначе набор id выбранных.
 * Выбор общий для всех списков: при смене экрана он сбрасывается (см. nav.ts).
 */
export const selection = signal<ReadonlySet<string> | null>(null);

export function startSelect(id?: string): void {
  selection.value = new Set(id ? [id] : []);
}

export function toggleSelect(id: string): void {
  const cur = selection.value;
  if (!cur) return;
  const next = new Set(cur);
  if (!next.delete(id)) next.add(id);
  selection.value = next;
}

export function selectAll(ids: readonly string[]): void {
  selection.value = new Set(ids);
}

export function clearSelection(): void {
  if (selection.value) selection.value = null;
}

/** Выбранные id в том порядке, в каком они показаны в списке. */
export function selectedInOrder(order: readonly string[]): string[] {
  const sel = selection.value;
  return sel ? order.filter((id) => sel.has(id)) : [];
}
