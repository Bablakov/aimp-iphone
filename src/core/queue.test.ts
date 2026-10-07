import { describe, expect, it } from "vitest";
import { advance, createQueue, currentId, enqueue, jump, playNext, removeAt, removeIds, retreat, setShuffle, shuffled } from "./queue";

const ids = ["a", "b", "c", "d"];
// Детерминированный генератор, чтобы тесты не мигали.
const seeded = (seed = 1): (() => number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

describe("queue", () => {
  it("стартует с выбранного трека без shuffle", () => {
    const q = createQueue(ids, "c", false);
    expect(q.order).toEqual(ids);
    expect(currentId(q)).toBe("c");
  });

  it("при shuffle выбранный трек играет первым, ничего не теряется", () => {
    const q = createQueue(ids, "c", true, seeded());
    expect(currentId(q)).toBe("c");
    expect(q.pos).toBe(0);
    expect([...q.order].sort()).toEqual(ids);
  });

  it("shuffled не меняет исходный массив", () => {
    const src = [1, 2, 3, 4, 5];
    shuffled(src, seeded());
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });

  it("advance: идёт вперёд, на конце останавливается или зацикливается", () => {
    let q = createQueue(ids, "c", false);
    q = advance(q, "off")!;
    expect(currentId(q)).toBe("d");
    expect(advance(q, "off")).toBeNull();
    expect(currentId(advance(q, "all")!)).toBe("a");
  });

  it("новый круг при shuffle не начинается с только что сыгравшего", () => {
    for (let s = 1; s < 40; s++) {
      let q = createQueue(ids, "a", true, seeded(s));
      q = { ...q, pos: q.order.length - 1 };
      const last = currentId(q);
      expect(currentId(advance(q, "all", seeded(s + 100))!)).not.toBe(last);
    }
  });

  it("retreat: назад, на начале остаётся (или переходит в конец при repeat all)", () => {
    const q = createQueue(ids, "a", false);
    expect(retreat(q, "off")).toBe(q);
    expect(currentId(retreat(q, "all"))).toBe("d");
    expect(currentId(retreat(jump(q, 2), "off"))).toBe("b");
  });

  it("выключение shuffle возвращает исходный порядок и остаётся на текущем", () => {
    let q = createQueue(ids, "b", true, seeded());
    q = advance(q, "off")!;
    const cur = currentId(q);
    const off = setShuffle(q, false);
    expect(off.order).toEqual(ids);
    expect(currentId(off)).toBe(cur);
  });

  it("включение shuffle не трогает уже сыгранное и текущий трек", () => {
    let q = createQueue(ids, "a", false);
    q = jump(q, 2);
    const on = setShuffle(q, true, seeded());
    expect(on.order.slice(0, 3)).toEqual(["a", "b", "c"]);
    expect(currentId(on)).toBe("c");
    expect([...on.order].sort()).toEqual(ids);
  });

  it("playNext вставляет сразу после текущего, enqueue — в конец", () => {
    let q = createQueue(ids, "b", false);
    q = playNext(q, "x");
    expect(q.order).toEqual(["a", "b", "x", "c", "d"]);
    q = enqueue(q, "y");
    expect(q.order.at(-1)).toBe("y");
    expect(q.base.at(-1)).toBe("y");
  });

  it("removeAt: позиция сохраняется на том же треке", () => {
    const q = jump(createQueue(ids, "a", false), 2);
    const r = removeAt(q, 0);
    expect(currentId(r)).toBe("c");
    expect(r.order).toEqual(["b", "c", "d"]);
  });

  it("removeAt текущего последнего не уводит pos за границу", () => {
    const q = jump(createQueue(ids, "a", false), 3);
    const r = removeAt(q, 3);
    expect(r.pos).toBe(2);
    expect(r.order).toEqual(["a", "b", "c"]);
  });

  it("removeIds: текущий трек остаётся текущим, пока он не удалён", () => {
    const q = jump(createQueue(ids, "a", false), 2);
    expect(currentId(removeIds(q, new Set(["a", "d"])))).toBe("c");
    const gone = removeIds(q, new Set(["c"]));
    expect(currentId(gone)).toBe("d");
  });
});
