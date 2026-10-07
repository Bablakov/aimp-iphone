// Рисует иконки приложения из SVG: `npm run icons`.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const out = new URL("../public/icons/", import.meta.url);
mkdirSync(out, { recursive: true });

// Янтарный фон на весь холст (iOS сам скругляет углы), чёрное кольцо и треугольник-«A» —
// та же гамма и композиция, что у AIMP, но рисунок свой. Maskable режется по центральному кругу,
// поэтому для него содержимое уменьшается (inset < 1).
const svg = (inset) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffb52e"/><stop offset="1" stop-color="#ff9a00"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${inset}) translate(-256 -256)">
    <circle cx="256" cy="256" r="176" fill="none" stroke="#111" stroke-width="40"/>
    <path d="M256 150 L350 332 L162 332 Z" fill="#111" stroke="#111" stroke-width="28" stroke-linejoin="round"/>
    <path d="M256 238 L292 306 L220 306 Z" fill="#ffa90f" stroke="#ffa90f" stroke-width="10" stroke-linejoin="round"/>
  </g>
</svg>`;

const jobs = [
  ["icon-512.png", 512, 1],
  ["icon-512-maskable.png", 512, 0.72],
  ["icon-192.png", 192, 1],
  ["apple-touch-icon.png", 180, 1],
];
for (const [name, size, inset] of jobs) {
  await sharp(Buffer.from(svg(inset))).resize(size, size).png().toFile(new URL(name, out).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  console.log("ok", name);
}
