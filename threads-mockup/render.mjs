// Рендер макета «Треды» в PNG: node render.mjs
// Playwright берётся локально, если стоит, иначе — из глобальной установки (/opt/node22/lib/node_modules).
// Браузер — уже установленный Chromium (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers), playwright install не нужен.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
  try { pw = require(p); break; } catch (e) { /* следующий */ }
}
if (!pw) { console.error('Нет пакета playwright: npm i playwright во временной папке'); process.exit(1); }

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const dir = path.dirname(fileURLToPath(import.meta.url));
const page = pathToFileURL(path.join(dir, 'threads.html')).href;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));

const SHOTS = [
  { out: 'desktop-light.png', view: 'desktop', theme: 'light', w: 1440, h: 900, dpr: 2 },
  { out: 'desktop-dark.png',  view: 'desktop', theme: 'dark',  w: 1440, h: 900, dpr: 2 },
  { out: 'mobile-light.png',  view: 'mobile',  theme: 'light', w: 390,  h: 844, dpr: 3 },
  { out: 'mobile-dark.png',   view: 'mobile',  theme: 'dark',  w: 390,  h: 844, dpr: 3 },
];

const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
for (const s of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr, colorScheme: s.theme });
  const p = await ctx.newPage();
  await p.goto(`${page}?view=${s.view}&theme=${s.theme}`);
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: path.join(dir, s.out) });
  await ctx.close();
  console.log('готово:', s.out);
}
await browser.close();
