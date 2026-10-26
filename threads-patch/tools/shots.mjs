// Скриншоты стенда «Треды» (Playwright + уже установленный Chromium): node tools/shots.mjs
// Перед запуском — node stand/server.mjs (порт 3077). Время браузера — МСК, как у людей платформы.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let pw; for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { pw = require(p); break; } catch (e) {} }
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screens');
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(f => fs.existsSync(f));
const B = 'http://127.0.0.1:3077/discuss';
const SHOTS = [
  { out: 'desktop-light.png', theme: 'light', w: 1440, h: 900, dpr: 2 },
  { out: 'desktop-dark.png', theme: 'dark', w: 1440, h: 900, dpr: 2 },
  { out: 'mobile-light.png', theme: 'light', w: 390, h: 844, dpr: 3 },
  { out: 'mobile-dark.png', theme: 'dark', w: 390, h: 844, dpr: 3 },
  { out: 'mobile-sheet-dark.png', theme: 'dark', w: 390, h: 844, dpr: 3, click: '.dc-row[data-id="task:662"]' },
  { out: 'tablet-sheet-light.png', theme: 'light', w: 1024, h: 768, dpr: 2, click: '.dc-row[data-id="chat:81"]' },
  { out: 'desktop-chat-dark.png', theme: 'dark', w: 1440, h: 900, dpr: 2, q: '&id=chat:81' },
  { out: 'desktop-search-empty-light.png', theme: 'light', w: 1440, h: 900, dpr: 2, q: '&q=zzzz' },
];
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
for (const s of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr, colorScheme: s.theme, timezoneId: 'Europe/Moscow', locale: 'ru-RU' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(B + '?theme=' + s.theme + (s.q || ''));
  await p.waitForLoadState('networkidle');
  if (s.click) { await p.click(s.click); await p.waitForTimeout(400); }
  await p.waitForTimeout(200);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  await p.screenshot({ path: path.join(dir, s.out) });
  console.log('готово:', s.out, 'scrollWidth=' + sw, errs.length ? 'ОШИБКИ: ' + errs.join(' | ') : 'без ошибок консоли');
  await ctx.close();
}
await browser.close();
