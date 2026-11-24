// Sums up the world news of Monday 23 November 2026 in one image (Node 22, standard library only).
// The picture is entry.png beside this file, rendered from design/poster.html (see design/render.sh).
// This program checks that the PNG is whole and within the contest's limits, then writes it to
// /output/entry.png (MAKEFUN_OUTPUT_DIR stands in for /output when run locally). No network, no
// clock, no randomness: two runs write the same bytes.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 1048576;
const MAX_SIDE = 1024;

const png = readFileSync(new URL('./entry.png', import.meta.url));
checkPng(png);
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
writeFileSync(join(outDir, 'entry.png'), png);
console.log(`entry.png: ${png.length} bytes`);

// CRC-32 (IEEE 802.3), the checksum every PNG chunk carries over its type and data.
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Throws unless buf is a whole PNG: the signature, an IHDR first, every chunk's CRC right, at least
// one IDAT, IEND last with nothing after it, at most MAX_BYTES and MAX_SIDE by MAX_SIDE pixels.
function checkPng(buf: Buffer): void {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length > MAX_BYTES) throw new Error(`entry.png is ${buf.length} bytes, over ${MAX_BYTES}`);
  if (!SIG.every((b, i) => buf[i] === b)) throw new Error('entry.png is not a PNG');
  let pos = 8;
  let first = true;
  let idat = 0;
  let ended = false;
  while (pos < buf.length) {
    if (pos + 12 > buf.length) throw new Error('entry.png ends inside a chunk header');
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const end = pos + 12 + len;
    if (end > buf.length) throw new Error(`chunk ${type} runs past the end of the file`);
    const want = buf.readUInt32BE(pos + 8 + len);
    if (crc32(buf.subarray(pos + 4, pos + 8 + len)) !== want) throw new Error(`chunk ${type} has a bad CRC`);
    if (first) {
      if (type !== 'IHDR') throw new Error('the first chunk is not IHDR');
      const w = buf.readUInt32BE(pos + 8);
      const h = buf.readUInt32BE(pos + 12);
      if (w < 1 || h < 1 || w > MAX_SIDE || h > MAX_SIDE) throw new Error(`entry.png is ${w}x${h}`);
      first = false;
    }
    if (type === 'IDAT') idat++;
    pos = end;
    if (type === 'IEND') { ended = true; break; }
  }
  if (!ended || pos !== buf.length) throw new Error('entry.png does not end with IEND');
  if (idat === 0) throw new Error('entry.png has no image data');
}
