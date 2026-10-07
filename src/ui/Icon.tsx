/** Простые контурные иконки (viewBox 24×24); заливка задаётся цветом текста. */
const PATHS = {
  play: "M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z",
  pause: "M7 5h3.2v14H7zM13.8 5H17v14h-3.2z",
  prev: "M6 5h2.4v14H6zM20 5.4v13.2a.8.8 0 0 1-1.25.66L9.6 12.66a.8.8 0 0 1 0-1.32l9.15-6.6A.8.8 0 0 1 20 5.4z",
  next: "M15.6 5H18v14h-2.4zM4 5.4v13.2a.8.8 0 0 0 1.25.66l9.15-6.6a.8.8 0 0 0 0-1.32L5.25 4.74A.8.8 0 0 0 4 5.4z",
  shuffle: "M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5",
  repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
  repeat1: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3M11 10l1.5-1v6",
  queue: "M3 6h12M3 12h12M3 18h8M17 14.5v5.2M17 14.5l4-1.3v5.2M15.7 19.7a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 0 0-2.6 0zM19.7 18.4a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 0 0-2.6 0z",
  eq: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  speed: "M12 14l4-4M3.3 17a10 10 0 1 1 17.4 0",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  back: "M15 5l-7 7 7 7",
  down: "M5 9l7 7 7-7",
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z",
  music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  album: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  artist: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  close: "M6 6l12 12M18 6L6 18",
  trash: "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6",
  up: "M5 15l7-7 7 7",
  check: "M5 12.5l4.5 4.5L19 7.5",
  sort: "M3 6h13M3 12h9M3 18h5M17 9v10M17 19l-3-3M17 19l3-3",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z",
  addlist: "M3 6h12M3 12h12M3 18h8M18 15v6M15 18h6",
  playnext: "M3 6h10M3 12h10M3 18h6M16 9l5 3.5-5 3.5z",
} as const;

export type IconName = keyof typeof PATHS;

/** Иконки, которые рисуются заливкой, а не обводкой. */
const FILLED = new Set<IconName>(["play", "pause", "prev", "next"]);

export function Icon({ name, size = 24, class: cls }: { name: IconName; size?: number; class?: string }) {
  const filled = FILLED.has(name);
  return (
    <svg
      class={`icon ${cls ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
