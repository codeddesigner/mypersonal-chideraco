// Rebuilds the heading font from the parts in fonts-src/ before `next build`.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const dir = 'fonts-src'
const out = 'app/fonts/ChideraSpar-Regular.woff'
const expected = '3cd55125a2cca17cf3035a2b1646dfdfaca6f2f3'

if (existsSync(dir)) {
  const parts = readdirSync(dir)
    .filter((f) => /^spar\.part\d+$/.test(f))
    .sort((a, b) => Number(a.slice(9)) - Number(b.slice(9)))
  const data = Buffer.concat(parts.map((f) => readFileSync(`${dir}/${f}`)))
  const sha = createHash('sha1').update(data).digest('hex')
  if (sha !== expected) throw new Error(`Heading font parts are incomplete (sha1 ${sha})`)
  mkdirSync('app/fonts', { recursive: true })
  writeFileSync(out, data)
  // A plain copy at /fonts/… for the "not available" page, which the middleware sends without Next's font loader.
  mkdirSync('public/fonts', { recursive: true })
  writeFileSync('public/fonts/ChideraSpar-Regular.woff', data)
  console.log(`Joined ${parts.length} parts into ${out} and public/fonts (${data.length} bytes)`)
}
