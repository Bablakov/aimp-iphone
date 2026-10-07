import type { RepeatMode } from "./types";

/**
 * Очередь воспроизведения — чистые функции без DOM, чтобы их можно было тестировать.
 * `base` — исходный порядок списка, `order` — порядок проигрывания (перемешанный при shuffle).
 */
export interface Queue {
  base: string[];
  order: string[];
  pos: number;
  shuffle: boolean;
}

export type Rng = () => number;

export const emptyQueue = (): Queue => ({ base: [], order: [], pos: 0, shuffle: false });

/** Fisher–Yates; исходный массив не трогает. */
export function shuffled<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Перемешивает всё, кроме элемента `keepIndex`: он встаёт первым. */
function shuffledWithFirst(ids: string[], keepIndex: number, rng: Rng): string[] {
  if (keepIndex < 0 || keepIndex >= ids.length) return shuffled(ids, rng);
  const rest = ids.filter((_, i) => i !== keepIndex);
  return [ids[keepIndex], ...shuffled(rest, rng)];
}

export function createQueue(ids: string[], startId: string | null, shuffle: boolean, rng: Rng = Math.random): Queue {
  const base = ids.slice();
  const start = startId == null ? -1 : base.indexOf(startId);
  if (!shuffle) return { base, order: base.slice(), pos: Math.max(0, start), shuffle };
  return { base, order: shuffledWithFirst(base, start, rng), pos: 0, shuffle };
}

export function currentId(q: Queue): string | null {
  return q.order[q.pos] ?? null;
}

export function setShuffle(q: Queue, on: boolean, rng: Rng = Math.random): Queue {
  if (q.shuffle === on) return q;
  const cur = currentId(q);
  if (!on) {
    const i = cur == null ? -1 : q.base.indexOf(cur);
    return { ...q, shuffle: false, order: q.base.slice(), pos: Math.max(0, i) };
  }
  // Что уже сыграло, остаётся позади: перемешиваем только текущий и будущие треки.
  const played = q.order.slice(0, q.pos);
  const rest = q.order.slice(q.pos);
  return { ...q, shuffle: true, order: [...played, ...(rest.length ? shuffledWithFirst(rest, 0, rng) : [])] };
}

/** Следующая позиция или null, если очередь закончилась (и повтор выключен). */
export function advance(q: Queue, repeat: RepeatMode, rng: Rng = Math.random): Queue | null {
  if (q.order.length === 0) return null;
  if (q.pos + 1 < q.order.length) return { ...q, pos: q.pos + 1 };
  if (repeat === "off") return null;
  // Круг пройден: при shuffle — новый порядок, но не начинаем с только что сыгравшего.
  if (!q.shuffle || q.order.length < 2) return { ...q, pos: 0 };
  const order = shuffled(q.base, rng);
  const last = q.order[q.order.length - 1];
  if (order[0] === last) [order[0], order[1]] = [order[1], order[0]];
  return { ...q, order, pos: 0 };
}

export function retreat(q: Queue, repeat: RepeatMode): Queue {
  if (q.pos > 0) return { ...q, pos: q.pos - 1 };
  if (repeat === "all" && q.order.length > 1) return { ...q, pos: q.order.length - 1 };
  return q;
}

export function peekNextId(q: Queue): string | null {
  return q.order[q.pos + 1] ?? null;
}

export function jump(q: Queue, index: number): Queue {
  if (index < 0 || index >= q.order.length) return q;
  return { ...q, pos: index };
}

/** «Играть следом»: сразу после текущего (и в исходном порядке — тоже). */
export function playNext(q: Queue, id: string): Queue {
  const cur = currentId(q);
  const order = q.order.slice();
  order.splice(cur == null ? 0 : q.pos + 1, 0, id);
  const base = q.base.slice();
  const bi = cur == null ? -1 : base.indexOf(cur);
  base.splice(bi + 1, 0, id);
  return { ...q, base, order };
}

export function enqueue(q: Queue, id: string): Queue {
  return { ...q, base: [...q.base, id], order: [...q.order, id] };
}

/** Убирает элемент очереди по индексу. Если убран текущий — pos указывает на следующий. */
export function removeAt(q: Queue, index: number): Queue {
  if (index < 0 || index >= q.order.length) return q;
  const id = q.order[index];
  const order = q.order.filter((_, i) => i !== index);
  const bi = q.base.indexOf(id);
  const base = bi < 0 ? q.base : q.base.filter((_, i) => i !== bi);
  let pos = q.pos;
  if (index < pos) pos--;
  return { ...q, base, order, pos: Math.min(pos, Math.max(0, order.length - 1)) };
}

/** Выкидывает из очереди удалённые из библиотеки треки; позиция остаётся на том же треке. */
export function removeIds(q: Queue, ids: ReadonlySet<string>): Queue {
  const cur = currentId(q);
  const order = q.order.filter((id) => !ids.has(id));
  const base = q.base.filter((id) => !ids.has(id));
  const pos =
    cur != null && !ids.has(cur)
      ? order.indexOf(cur)
      : q.order.slice(0, q.pos).filter((id) => !ids.has(id)).length;
  return { ...q, base, order, pos: Math.min(Math.max(0, pos), Math.max(0, order.length - 1)) };
}
