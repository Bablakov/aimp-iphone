// Рисует иконки приложения из SVG: `npm run icons`.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const out = new URL("../public/icons/", import.meta.url);
mkdirSync(out, { recursive: true });

// Фон на весь холст: iOS сам скругляет углы, а maskable режется по центральному кругу.
const svg = (inset) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1b2a44"/><stop offset="1" stop-color="#0b0f17"/>
    </linearGradient>
    <linearGradient id="fg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5cc8ff"/><stop offset="1" stop-color="#2f7bff"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${inset}) translate(-256 -256)">
    <g fill="url(#fg)">
      <rect x="96"  y="236" width="44" height="40"  rx="22"/>
      <rect x="168" y="168" width="44" height="176" rx="22"/>
      <rect x="240" y="104" width="44" height="304" rx="22"/>
      <rect x="312" y="152" width="44" height="208" rx="22"/>
      <rect x="384" y="214" width="44" height="84"  rx="22"/>
    </g>
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
