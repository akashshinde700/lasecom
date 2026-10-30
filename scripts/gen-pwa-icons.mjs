import sharp from 'sharp'

// Brand mark: bold white "L" monogram + heart accent on orange gradient.
// Drawn with pure paths (no font dependency) so it renders identically everywhere.

const monogram = (scale = 1) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
    <rect x="158" y="118" width="82" height="264" rx="26" fill="#ffffff"/>
    <rect x="158" y="300" width="196" height="82" rx="26" fill="#ffffff"/>
    <path d="M366 130 a26 26 0 0 1 26 26 c0 22-26 38-62 57 c-36-19-62-35-62-57 a26 26 0 0 1 26-26 c15 0 28 9 36 22 c8-13 21-22 36-22 z" fill="#ffffff"/>
  </g>`

const gradient = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f97316"/><stop offset="1" stop-color="#c2410c"/>
  </linearGradient></defs>`

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${gradient}<rect width="512" height="512" rx="112" fill="url(#bg)"/>${monogram(0.82)}</svg>`

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${gradient}<rect width="512" height="512" fill="url(#bg)"/>${monogram(0.56)}</svg>`

const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${gradient}<rect width="512" height="512" fill="url(#bg)"/>${monogram(0.76)}</svg>`

await sharp(Buffer.from(iconSvg)).png().toFile('public/icons/icon-512.png')
await sharp(Buffer.from(iconSvg)).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(Buffer.from(maskableSvg)).png().toFile('public/icons/icon-512-maskable.png')
await sharp(Buffer.from(appleSvg)).resize(180, 180).png().toFile('public/apple-touch-icon.png')
console.log('PWA icons generated')
