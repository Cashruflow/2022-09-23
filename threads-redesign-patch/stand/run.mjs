// Прогон стенда в Chromium (Playwright глобальный, браузер в /opt/pw-browsers): сценарии + скриншоты в ../screens.
// node stand/run.mjs  (стенд поднимается сам на свободном порту)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { pw = require(p); break; } catch (e) {} }
if (!pw) { console.error('нет playwright'); process.exit(1); }
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, '..', 'screens');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8790 + Math.floor(Math.random() * 100);
const SRC = process.env.STAND_SRC || 'new';
const srv = spawn(process.execPath, [path.join(DIR, 'server.mjs'), String(PORT)], { env: { ...process.env, STAND_SRC: SRC }, stdio: 'inherit' });
await new Promise(r => setTimeout(r, 700));
const B = 'http://127.0.0.1:' + PORT;
const mode = q => fetch(B + '/__mode?' + q).then(r => r.json());
const exe = fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter(d => d.startsWith('chromium-')).map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find(f => fs.existsSync(f)) : null;
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
const errors = [], checks = [];
const ok = (cond, what) => { checks.push((cond ? 'OK   ' : 'FAIL ') + what); };

async function open(view, theme, hash) {
  const vp = view === 'mobile' ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900, deviceScaleFactor: 1 };
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, colorScheme: theme });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${view}/${theme}${hash || ''}] console.${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => errors.push(`[${view}/${theme}${hash || ''}] pageerror: ${e.message}`));
  p.on('requestfailed', r => errors.push(`[${view}/${theme}] requestfailed: ${r.url()}`));
  await p.goto(B + '/threads?theme=' + theme + (hash || ''));
  await p.waitForSelector('header.ph .ph-tools #th-tabs', { timeout: 5000 });
  await p.waitForTimeout(600);
  return { p, ctx };
}
const shot = (p, name, full) => p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!full });

for (const view of ['desktop', 'mobile']) {
  for (const theme of ['light', 'dark']) {
    await mode('conn=1&noins=0&posts=many&analytics=data&search=many&user=cashruflow');
    const tag = view + '-' + theme;
    const { p, ctx } = await open(view, theme);
    // статус и @username
    const st = await p.textContent('#th-txt');
    ok(/Подключено/.test(st) && /@cashruflow/.test(st) && /24\.12\.2026/.test(st) && !/26831904417712/.test(st), `${tag}: статус «${st.trim()}» (ник есть, ID нет)`);
    ok((await p.textContent('#th-me')).includes('@cashruflow'), `${tag}: ник в «Новом посте»`);
    // счётчики со склонением
    await p.waitForFunction(() => document.querySelectorAll('#stats-101 .th-stat').length === 5 && document.querySelectorAll('#stats-102 .th-stat').length === 5 && document.querySelectorAll('#stats-105 .th-stat').length === 5);
    const s101 = (await p.textContent('#stats-101')).replace(/\s+/g, ' ');
    const s102 = (await p.textContent('#stats-102')).replace(/\s+/g, ' ');
    const s104 = (await p.textContent('#stats-104')).replace(/\s+/g, ' ');
    const s105 = (await p.textContent('#stats-105')).replace(/\s+/g, ' ');
    ok(/2 418 ?просмотров/.test(s101.replace(/ /g, ' ')) && /48 ?лайков/.test(s101) && /12 ?ответов/.test(s101) && /6 ?репостов/.test(s101) && /3 ?цитаты/.test(s101), `${tag}: склонение 101 «${s101}»`);
    ok(/21 ?лайк[^а-я]/.test(s102 + ' ') && /4 ?ответа/.test(s102) && /2 ?репоста/.test(s102) && /0 ?цитат/.test(s102), `${tag}: склонение 102 «${s102}»`);
    ok(/864 ?просмотра/.test(s104) && /1 ?репост[^а-я]/.test(s104 + ' ') && /1 ?цитата/.test(s104), `${tag}: склонение 104 «${s104}»`);
    ok(/— ?цитат/.test(s105) && /2 ?лайка/.test(s105), `${tag}: null → «—» 105 «${s105}»`);
    ok(/Репост — статистики нет/.test(await p.textContent('#stats-103')), `${tag}: репост без статистики`);
    ok((await p.$$('.th-post')).length === 5, `${tag}: 5 постов из 5`);
    ok(await p.isVisible('.th-post[data-id="101"] .th-open'), `${tag}: «Открыть» у поста`);
    if (theme === 'light') await shot(p, `posts-${tag}`);
    // ввод текста и счётчик
    await p.fill('#th-text', 'Пять причин, почему падает CTR');
    ok((await p.textContent('#th-count-n')).trim() === '30 / 500', `${tag}: счётчик ${(await p.textContent('#th-count-n')).trim()}`);
    const pv = await p.$eval('#th-count', e => e.style.getPropertyValue('--p'));
    ok(pv === '6', `${tag}: кольцо --p=${pv}`);
    // картинка
    await p.setInputFiles('#th-img-file', path.join(DIR, 'img', 'test.png'));
    await p.waitForSelector('#th-preview:not([hidden])');
    ok((await p.getAttribute('#th-preview-img', 'src')).startsWith('data:image/jpeg'), `${tag}: превью картинки (сжато в JPEG)`);
    // раскрыть ответы
    await p.click('.th-post[data-id="101"] .th-show-replies');
    await p.waitForSelector('#replies-101 .th-reply');
    ok((await p.$$('#replies-101 .th-reply')).length === 3 && (await p.textContent('.th-post[data-id="101"] .th-rl')) === 'Скрыть ответы', `${tag}: ответы раскрыты (3), кнопка «Скрыть ответы»`);
    await p.click('.th-post[data-id="105"] .th-show-replies');
    await p.waitForFunction(() => /Ответов пока нет/.test(document.getElementById('replies-105').textContent));
    ok(true, `${tag}: «Ответов пока нет»`);
    await shot(p, `posts-${tag}-composer`, false);
    if (view === 'desktop') { await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(200); await shot(p, `posts-${tag}-scrolled`); await p.evaluate(() => window.scrollTo(0, 0)); }
    else await shot(p, `posts-${tag}-full`, true);
    // убрать картинку и опубликовать
    await p.click('#th-img-rm');
    ok(await p.isHidden('#th-preview'), `${tag}: «Убрать картинку»`);
    await p.click('#th-post');
    await p.waitForFunction(() => document.querySelector('#plt-toast.show') && /Опубликовано/.test(document.querySelector('#plt-toast').textContent));
    ok((await p.inputValue('#th-text')) === '' && (await p.textContent('#th-post-l')) === 'Опубликовать', `${tag}: «Опубликовать» → тост, поле очищено`);
    await p.waitForTimeout(300);
    // ключи
    await p.click('#th-tabs .ui-tab[data-tab="keywords"]');
    ok(p.url().endsWith('#keywords') && await p.isVisible('#tab-keywords') && await p.isHidden('#tab-posts'), `${tag}: вкладка «Ключи»`);
    await p.fill('#th-q', 'seo продвижение');
    await p.press('#th-q', 'Enter');
    await p.waitForSelector('#th-search-results .th-post');
    ok((await p.$$('#th-search-results .th-post')).length === 3, `${tag}: поиск — 3 результата`);
    await shot(p, `keywords-${tag}`);
    await mode('search=none');
    await p.click('#th-search-btn');
    await p.waitForFunction(() => /Ничего не нашлось/.test(document.getElementById('th-search-results').textContent));
    ok(true, `${tag}: «Ничего не нашлось»`);
    // аналитика
    await p.click('#th-tabs .ui-tab[data-tab="аналитика"]');
    await p.waitForSelector('.tha-card');
    ok((await p.$$('.tha-card')).length === 4 && (await p.$$('.tha-bar')).length === 28, `${tag}: аналитика — 4 карточки, 28 столбиков`);
    const prev = await p.textContent('.tha-card:nth-child(2) .tha-prev');
    ok(/Предыдущие: 9\s935/.test(prev.replace(/ /g, ' ')) && await p.$('.tha-card:nth-child(2) .tha-up') && await p.$('.tha-card:nth-child(3) .tha-down'), `${tag}: «Предыдущие» и стрелки`);
    ok(/Обновлено:/.test(await p.textContent('.tha-upd')), `${tag}: «Обновлено»`);
    const lbl = await p.$$eval('.tha-card:first-child .tha-bar span', a => a.map(x => x.textContent).join(','));
    ok(lbl.split(',').length === 7 && lbl.split(',').every(Boolean), `${tag}: подписи дней ${lbl}`);
    await shot(p, `analytics-${tag}`, view === 'mobile');
    // хэш-белый список
    await p.goto(B + '/threads?theme=' + theme + '#constructor');
    await p.waitForTimeout(500);
    ok(await p.isVisible('#tab-posts') && await p.isHidden('#tab-keywords'), `${tag}: #constructor → «Мои посты» (Object.hasOwn)`);
    await ctx.close();
  }
}

// состояния (ПК и телефон, светлая)
for (const view of ['desktop', 'mobile']) {
  const tag = view + '-light';
  await mode('conn=0');
  let { p, ctx } = await open(view, 'light');
  ok(/Не подключено/.test(await p.textContent('#th-txt')) && await p.isVisible('#th-connect') && await p.isDisabled('#th-post'), `${tag}: не подключено, «Подключить», «Опубликовать» выключена`);
  ok(/Подключи Threads/.test(await p.textContent('#th-posts')), `${tag}: пусто «Подключи Threads…»`);
  await shot(p, `states-${tag}-notconnected`);
  await ctx.close();
  await mode('conn=1&posts=none&noins=0&analytics=nodata');
  ({ p, ctx } = await open(view, 'light'));
  await p.waitForFunction(() => /Постов пока нет/.test(document.getElementById('th-posts').textContent));
  ok(true, `${tag}: «Постов пока нет»`);
  await p.click('#th-tabs .ui-tab[data-tab="аналитика"]');
  await p.waitForSelector('#tha-collect');
  await shot(p, `states-${tag}-nodata`);
  await p.click('#tha-collect');
  await p.waitForSelector('.tha-card');
  ok(true, `${tag}: «Собрать сейчас» → карточки`);
  await ctx.close();
  await mode('conn=1&posts=many&noins=1&analytics=data');
  ({ p, ctx } = await open(view, 'light'));
  await p.waitForSelector('#th-noins:not([hidden])');
  ok(await p.isVisible('#th-reconnect'), `${tag}: плашка «Нет прав» + «Переподключить»`);
  await shot(p, `states-${tag}-noins`);
  await ctx.close();
}
// длинный текст: счётчик за 500 (maxlength режет ввод; программно — проверка цвета)
{
  await mode('conn=1&posts=many&noins=0');
  const { p, ctx } = await open('desktop', 'dark');
  await p.evaluate(() => { const t = document.getElementById('th-text'); t.removeAttribute('maxlength'); t.value = 'x'.repeat(520); t.dispatchEvent(new Event('input')); });
  ok(await p.$eval('#th-count', e => e.classList.contains('over')), 'desktop-dark: 520/500 → .over');
  await ctx.close();
}

await browser.close();
srv.kill();
// 403 от заглушки /api/threads/insights в сценарии «нет прав» — так отвечает и прод (ERR-193), страница его обрабатывает
const expected = errors.filter(e => /status of 403/.test(e)), real = errors.filter(e => !/status of 403/.test(e));
const log = checks.join('\n') + '\n\nКонсоль/ошибки страницы: ' + (real.length ? '\n' + real.join('\n') : 'нет')
  + '\nОжидаемые (403 insights в сценарии «нет прав»): ' + expected.length + '\n';
fs.writeFileSync(path.join(OUT, 'stand-log.txt'), log);
console.log(log);
process.exit(checks.some(c => c.startsWith('FAIL')) || real.length ? 1 : 0);
