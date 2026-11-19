// Preview stills: node scripts/preview.mjs 0 40 85 ...  (needs `remotion bundle --out-dir=build` first)
import {openBrowser, selectComposition, renderStill} from '@remotion/renderer';
import {mkdirSync} from 'node:fs';
import path from 'node:path';

const serveUrl = path.resolve('build'), id = 'GELADEIRA-NUNCA', chromiumOptions = {gl: 'swangle'};
mkdirSync('prev', {recursive: true});
const browser = await openBrowser('chrome', {chromiumOptions});
const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser, chromiumOptions});
for (const a of process.argv.slice(2)) {
  const frame = Number(a);
  await renderStill({composition, serveUrl, frame, output: `prev/f${String(frame).padStart(4, '0')}.png`, puppeteerInstance: browser, chromiumOptions, scale: 0.25});
}
await browser.close({silent: true});
console.log('ok', process.argv.length - 2);
