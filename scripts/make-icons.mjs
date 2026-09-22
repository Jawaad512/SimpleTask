// Renders the 2x2 wordmark glyph to PNG at the sizes a manifest needs.
// Minimal hand-rolled encoder so the build keeps its dependency list short.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(here, '..', 'public')

const CANVAS = [0xfa, 0xf9, 0xf6]
const INK = [0x1a, 0x1a, 0x18]
const MUTED = [0x8e, 0x8c, 0x85]

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let offset = 0
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0 // filter: none
    offset += 1
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixel(x, y)
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
      offset += 3
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function glyph(size) {
  const pad = Math.round(size * 0.22)
  const gap = Math.max(2, Math.round(size * 0.045))
  const cell = Math.floor((size - pad * 2 - gap) / 2)

  return (x, y) => {
    const col = x < pad + cell ? 0 : x >= pad + cell + gap ? 1 : -1
    const row = y < pad + cell ? 0 : y >= pad + cell + gap ? 1 : -1
    const inX = x >= pad && x < size - pad
    const inY = y >= pad && y < size - pad

    if (!inX || !inY || col === -1 || row === -1) return CANVAS
    return col === 0 && row === 0 ? INK : MUTED
  }
}

mkdirSync(publicDir, { recursive: true })

for (const size of [192, 512]) {
  writeFileSync(resolve(publicDir, `icon-${size}.png`), png(size, glyph(size)))
  console.log(`wrote public/icon-${size}.png`)
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#FAF9F6"/>
  <rect x="7"  y="7"  width="8" height="8" fill="#1A1A18"/>
  <rect x="17" y="7"  width="8" height="8" fill="#8E8C85"/>
  <rect x="7"  y="17" width="8" height="8" fill="#8E8C85"/>
  <rect x="17" y="17" width="8" height="8" fill="#8E8C85"/>
</svg>
`

writeFileSync(resolve(publicDir, 'favicon.svg'), favicon)
console.log('wrote public/favicon.svg')
