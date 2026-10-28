// Рендер макета редизайна /threads в PNG: node render.mjs
// Playwright — локальный или глобальный (/opt/node22/lib/node_modules); Chromium уже в /opt/pw-browsers, playwright install не нужен.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
  try { pw = require(p); break; } catch (e) { /* следующий */ }
}
if (!pw) { console.error('Нет пакета playwright'); process.exit(1); }
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const dir = path.dirname(fileURLToPath(import.meta.url));
const page = pathToFileURL(path.join(dir, 'threads.html')).href;
const exe = fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter(d => d.startsWith('chromium-')).map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f)) : null;

const D = { view: 'desktop', w: 1440, h: 900, dpr: 2 }, Mb = { view: 'mobile', w: 390, h: 844, dpr: 3 };
const SHOTS = [
  { ...D,  screen: 'posts',     theme: 'light', out: 'posts-desktop-light.png' },
  { ...D,  screen: 'posts',     theme: 'dark',  out: 'posts-desktop-dark.png' },
  { ...Mb, screen: 'posts',     theme: 'light', out: 'posts-mobile-light.png' },
  { ...Mb, screen: 'posts',     theme: 'dark',  out: 'posts-mobile-dark.png' },
  { ...D,  screen: 'keywords',  theme: 'light', out: 'keywords-desktop-light.png' },
  { ...Mb, screen: 'keywords',  theme: 'light', out: 'keywords-mobile-light.png' },
  { ...D,  screen: 'analytics', theme: 'light', out: 'analytics-desktop-light.png' },
  { ...Mb, screen: 'analytics', theme: 'light', out: 'analytics-mobile-light.png' },
  { ...D,  screen: 'states',    theme: 'light', out: 'states-desktop-light.png' },
  { ...Mb, screen: 'states',    theme: 'light', out: 'states-mobile-light.png' },
];
const only = process.argv[2];
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
for (const s of SHOTS) {
  if (only && !s.out.includes(only)) continue;
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr, colorScheme: s.theme });
  const p = await ctx.newPage();
  await p.goto(`${page}?view=${s.view}&theme=${s.theme}&screen=${s.screen}`);
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: path.join(dir, s.out) });
  await ctx.close();
  console.log('готово:', s.out);
}
await browser.close();
