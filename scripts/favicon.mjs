// Makes app/favicon.ico from app/icon.svg before `next build`: the same drawing at 16, 32 and 48 pixels,
// stored as PNGs inside an ICO. Browsers and other services ask for /favicon.ico by name; pages also point
// at icon.svg itself. Usage: node scripts/favicon.mjs [source.svg] [output.ico]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const [source = 'app/icon.svg', output = 'app/favicon.ico'] = process.argv.slice(2)
const SIZES = [16, 32, 48]

if (existsSync(source)) {
  const svg = readFileSync(source)
  const pngs = await Promise.all(SIZES.map((size) => sharp(svg).resize(size, size).png().toBuffer()))

  // ICO layout: a 6-byte header, a 16-byte entry for each picture, then the pictures themselves.
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length + 16 * pngs.length
  const entries = pngs.map((png, i) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(SIZES[i], 0) // width
    entry.writeUInt8(SIZES[i], 1) // height
    entry.writeUInt8(0, 2) // no palette
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // colour planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    return entry
  })
  const ico = Buffer.concat([header, ...entries, ...pngs])
  writeFileSync(output, ico)
  console.log(`Made ${output} (${SIZES.join(', ')} px, ${ico.length} bytes) from ${source}`)
}
