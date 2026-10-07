import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

interface Props {
  count: number;
  rowHeight: number;
  row: (index: number) => ComponentChildren;
  /** Блок над списком (шапка альбома и т.п.) — прокручивается вместе с ним. */
  header?: ComponentChildren;
  /** Показывается вместо списка, когда строк нет. */
  empty?: ComponentChildren;
  /** Строка, к которой нужно прокрутить при открытии. */
  initialIndex?: number;
}

const OVERSCAN = 6;

/**
 * Список с фиксированной высотой строки: в DOM только видимые строки. Тысячи треков
 * в обычном списке заметно тормозят прокрутку на iPhone.
 */
export function VirtualList({ count, rowHeight, row, header, empty, initialIndex }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<[number, number]>([0, 30]);

  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    const headH = headRef.current?.offsetHeight ?? 0;
    const first = Math.max(0, Math.floor((el.scrollTop - headH) / rowHeight) - OVERSCAN);
    const last = Math.min(count, Math.ceil((el.scrollTop + el.clientHeight - headH) / rowHeight) + OVERSCAN);
    setRange((r) => (r[0] === first && r[1] === last ? r : [first, last]));
  };

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && initialIndex != null && initialIndex > 0) {
      el.scrollTop = Math.max(0, (headRef.current?.offsetHeight ?? 0) + initialIndex * rowHeight - el.clientHeight / 3);
    }
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (headRef.current) ro.observe(headRef.current);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  });

  useEffect(measure, [count, rowHeight]);

  const rows: ComponentChildren[] = [];
  for (let i = range[0]; i < Math.min(range[1], count); i++) {
    rows.push(
      <div key={i} class="vrow" style={{ top: `${i * rowHeight}px`, height: `${rowHeight}px` }}>
        {row(i)}
      </div>,
    );
  }

  return (
    <div class="scroll" ref={scroller}>
      {header != null && <div ref={headRef}>{header}</div>}
      {count === 0 ? (
        empty
      ) : (
        <div class="vspace" style={{ height: `${count * rowHeight}px` }}>
          {rows}
        </div>
      )}
    </div>
  );
}
