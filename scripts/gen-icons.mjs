// Writes the PWA icons under public/icons as plain PNGs with no dependency:
// a Nocturne-ink ground with a mark-coloured check glyph drawn in pixels.
// Run once: `node scripts/gen-icons.mjs`. Committed output; rerun to change.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const BG = [0x16, 0x18, 0x26]
const MARK = [0xd2, 0xce, 0xfd]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n += 1) {
    c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// A check mark: two strokes in a square, in unit coordinates.
function isMark(x, y, size, pad) {
  const u = (x - pad) / (size - 2 * pad)
  const v = (y - pad) / (size - 2 * pad)
  if (u < 0 || u > 1 || v < 0 || v > 1) return false
  const w = 0.11
  const near = (ax, ay, bx, by) => {
    const dx = bx - ax
    const dy = by - ay
    const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)))
    const px = ax + t * dx
    const py = ay + t * dy
    return Math.hypot(u - px, v - py) < w
  }
  return near(0.2, 0.55, 0.42, 0.78) || near(0.42, 0.78, 0.82, 0.25)
}

function png(size, pad) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x += 1) {
      const px = isMark(x, y, size, pad) ? MARK : BG
      const i = y * (size * 3 + 1) + 1 + x * 3
      raw[i] = px[0]
      raw[i + 1] = px[1]
      raw[i + 2] = px[2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', png(192, 24))
writeFileSync('public/icons/icon-512.png', png(512, 64))
// Maskable: the safe zone is the inner 80%, so pad the glyph further.
writeFileSync('public/icons/icon-512-maskable.png', png(512, 128))
console.log('wrote public/icons/icon-192.png, icon-512.png, icon-512-maskable.png')
