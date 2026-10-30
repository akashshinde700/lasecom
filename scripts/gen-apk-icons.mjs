import sharp from 'sharp'
import { mkdirSync } from 'fs'

// Generates Android launcher icons from the same brand mark used for the PWA.
// ic_launcher / ic_launcher_round: legacy square+round PNGs (all densities)
// ic_launcher_foreground: transparent PNG for adaptive icons (108dp grid)

const monogram = (scale = 1) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <rect x="158" y="118" width="82" height="264" rx="26" fill="#ffffff"/>
    <rect x="158" y="300" width="196" height="82" rx="26" fill="#ffffff"/>
    <path d="M366 130 a26 26 0 0 1 26 26 c0 22-26 38-62 57 c-36-19-62-35-62-57 a26 26 0 0 1 26-26 c15 0 28 9 36 22 c8-13 21-22 36-22 z" fill="#ffffff"/>
  </g>`

const gradient = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#c2410c"/>
  </linearGradient></defs>`

const legacySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${gradient}<rect width="512" height="512" rx="112" fill="url(#bg)"/>${monogram(0.82)}</svg>`
const roundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${gradient}<rect width="512" height="512" rx="256" fill="url(#bg)"/>${monogram(0.82)}</svg>`
// adaptive foreground: transparent background, art inside the 66% safe zone
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${monogram(0.56)}</svg>`

const RES = 'android-app/res'
const densities = [
  ['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192],
]
const fgDensities = [
  ['mdpi', 108], ['hdpi', 162], ['xhdpi', 216], ['xxhdpi', 324], ['xxxhdpi', 432],
]

for (const [dpi, size] of densities) {
  const dir = `${RES}/mipmap-${dpi}`
  mkdirSync(dir, { recursive: true })
  await sharp(Buffer.from(legacySvg)).resize(size, size).png().toFile(`${dir}/ic_launcher.png`)
  await sharp(Buffer.from(roundSvg)).resize(size, size).png().toFile(`${dir}/ic_launcher_round.png`)
}

for (const [dpi, size] of fgDensities) {
  const dir = `${RES}/mipmap-${dpi}`
  mkdirSync(dir, { recursive: true })
  await sharp(Buffer.from(foregroundSvg)).resize(size, size).png().toFile(`${dir}/ic_launcher_foreground.png`)
}

console.log('Android launcher icons generated')
