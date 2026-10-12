import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
const svg = readFileSync('static/favicon.svg');
mkdirSync('static/icons', { recursive: true });
const out = (s, name, mask = false) =>
  sharp(svg, { density: 300 }).resize(s, s, { fit: 'contain', background: mask ? { r: 111, g: 78, b: 55, alpha: 1 } : undefined }).png().toFile(`static/icons/${name}`);
await out(192, 'icon-192.png');
await out(512, 'icon-512.png');
await out(512, 'icon-512-maskable.png', true);
await out(180, 'apple-touch-icon.png');
console.log('icons written');
