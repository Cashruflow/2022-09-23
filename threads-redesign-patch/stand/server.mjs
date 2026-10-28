// Локальный стенд /threads: настоящие ui.css (копия с сервера), theme.css (собран кодом themeVars/btnCss/inpCss
// из web/server.js с THEME_DEFAULTS — см. theme-gen.mjs), toast.js, loc-time.js, page-header.js и файлы из ../new
// (или ../orig: STAND_SRC=orig). API /api/threads/* — заглушки; сценарий меняется GET /__mode?k=v.
// Запуск: node stand/server.mjs [порт]. Только для проверки вида, на сервер не едет.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(DIR, '..', process.env.STAND_SRC || 'new', 'web', 'public');
const PORT = +process.argv[2] || 8787;
const ICONS_V = 32;

const M = { conn: 1, noins: 0, posts: 'many', analytics: 'data', search: 'many', user: 'cashruflow' };
const log = [];

const now = Date.now(), H = 3600e3, D = 24 * H;
const iso = t => new Date(t).toISOString().replace('.000Z', '+0000');
const POSTS = [
  { id: '101', text: 'Разобрали, почему CTR в Яндексе падает после смены сниппета: пять причин и что проверить первым делом. Спойлер: чаще всего виноват не заголовок, а дата в description.', permalink: 'https://www.threads.net/@cashruflow/post/1', timestamp: iso(now - 2 * H), media_type: 'TEXT_POST' },
  { id: '102', text: 'Новая статья в блоге: как мы перенесли 64 статьи на новый шаблон без потери позиций. Карта 301-редиректов внутри.', permalink: 'https://www.threads.net/@cashruflow/post/2', timestamp: iso(now - D - 3 * H), media_type: 'TEXT_POST' },
  { id: '103', text: '', permalink: 'https://www.threads.net/@cashruflow/post/3', timestamp: iso(now - 4 * D), media_type: 'REPOST_FACADE' },
  { id: '104', text: 'Что смотреть в Вебмастере каждое утро — 3 отчёта, 5 минут.', permalink: 'https://www.threads.net/@cashruflow/post/4', timestamp: iso(now - 5 * D), media_type: 'IMAGE' },
  { id: '105', text: 'Короткий пост без ответов.', permalink: '', timestamp: iso(now - 400 * D), media_type: 'TEXT_POST' }
];
const INS = {
  101: { views: 2418, likes: 48, replies: 12, reposts: 6, quotes: 3 },
  102: { views: 1120, likes: 21, replies: 4, reposts: 2, quotes: 0 },
  104: { views: 864, likes: 17, replies: 2, reposts: 1, quotes: 1 },
  105: { views: 96, likes: 2, replies: 0, reposts: 0, quotes: null }
};
const REPLIES = {
  101: [{ id: 'r1', username: 'dmitry.orlov', text: 'А если сниппет собирается из микроразметки, тоже дата?', timestamp: iso(now - 90 * 60e3) },
    { id: 'r2', username: 'elena_seo', text: 'Подтверждаю, у нас после правки description CTR вернулся за неделю.', timestamp: iso(now - 60 * 60e3) },
    { id: 'r3', username: 'mebel.dom', text: 'Сохранил, проверим на каталоге', timestamp: iso(now - 30 * 60e3) }]
};
const SEARCH = [
  { id: 's1', username: 'seo.pulse', text: 'SEO-продвижение в 2026: что реально работает для малого бизнеса — короткий тред с цифрами по трём нишам.', permalink: 'https://www.threads.net/@seo.pulse/post/1', timestamp: iso(now - 5 * D) },
  { id: 's2', username: 'anna_marketing', text: 'Кто делал SEO-продвижение для интернет-магазина мебели? Ищу подрядчика, бюджет есть, нужна прозрачная отчётность.', permalink: 'https://www.threads.net/@anna/post/2', timestamp: iso(now - 5 * D - 7 * H) },
  { id: 's3', username: 'digital.notes', text: 'Продвижение сайта без ссылок — миф или нет?', permalink: '', timestamp: iso(now - 6 * D) }
];
function dayStr(n) { const d = new Date(now - n * D); return d.toISOString().slice(0, 10); }
function analytics() {
  const days = [];
  for (let n = 13; n >= 0; n--) days.push({ day: dayStr(n) });
  const s = k => ({ posts: [1, 2, 0, 1, 3, 1, 1], views: [1400, 1800, 1200, 2300, 2700, 2000, 2900], replies: [8, 12, 6, 9, 10, 7, 12], followers: [3, 5, 4, 9, 6, 5, 6] })[k];
  return {
    days,
    cards: {
      posts: { cur: 9, prev: 6, series: s('posts'), cmp: true },
      views: { cur: 12480, prev: 9935, series: s('views'), cmp: true },
      replies: { cur: 64, prev: 71, series: s('replies'), cmp: true },
      followers: { cur: 38, prev: 24, series: s('followers'), now: 1912 }
    },
    has_data: true,
    updated_at: new Date(now - 3 * H).toISOString().slice(0, 19).replace('T', ' ')
  };
}

function send(res, code, type, body) { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); }
function json(res, code, obj) { send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj)); }
const TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html; charset=utf-8' };
function file(res, p) {
  if (!fs.existsSync(p)) return send(res, 404, 'text/plain', 'нет файла');
  send(res, 200, TYPES[path.extname(p)] || 'application/octet-stream', fs.readFileSync(p));
}
// как injectEarlyErr в server.js: адрес спрайта → ICONS_URL и window.ICONS_URL в <head>
function page(res) {
  let html = fs.readFileSync(path.join(SRC, 'threads.html'), 'utf8');
  const url = '/assets/icons.svg?v=' + ICONS_V;
  html = html.replace(/\/assets\/icons\.svg(?:\?v=[\w.-]*)?(?=[#"'`)])/g, url);
  html = html.replace(/<head[^>]*>/i, m => m + '<script>window.ICONS_URL="' + url + '"</script>');
  send(res, 200, 'text/html; charset=utf-8', html);
}
const SIDEBAR_STUB = `/* заглушка sidebar.js стенда: тема из ?theme=, сборка шапки настоящим page-header.js */
(function(){var t=new URLSearchParams(location.search).get('theme');if(t)document.documentElement.setAttribute('data-theme',t);
var s=document.createElement('script');s.src='/page-header.js';document.head.appendChild(s);
/* как mhead.js на телефоне: шапка .ph не липкая */
var st=document.createElement('style');st.textContent='@media (max-width:768px){header.ph{position:static !important}}';document.head.appendChild(st);})();`;

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  log.push(req.method + ' ' + p + u.search);
  if (p === '/__mode') { u.searchParams.forEach((v, k) => { M[k] = /^\d+$/.test(v) ? +v : v; }); return json(res, 200, M); }
  if (p === '/__log') return json(res, 200, log.splice(0));
  if (p === '/threads') return page(res);
  if (p === '/sidebar.js') return send(res, 200, TYPES['.js'], SIDEBAR_STUB);
  if (p === '/ui.css' || p === '/theme.css' || p === '/toast.js' || p === '/loc-time.js' || p === '/page-header.js') return file(res, path.join(DIR, p));
  if (p === '/threads-analytics-widget.js') return file(res, path.join(SRC, 'threads-analytics-widget.js'));
  if (p === '/assets/icons.svg') return file(res, path.join(SRC, 'assets', 'icons.svg'));
  if (p === '/assets/logo.svg') return send(res, 200, 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"/>');
  if (p.startsWith('/img/')) return file(res, path.join(DIR, p));
  if (p === '/api/threads/status') return json(res, 200, M.conn
    ? { connected: true, threads_user_id: '26831904417712', expires_at: '2026-12-24', live: { ok: true, error: '', username: M.user, checked_at: new Date().toISOString() } }
    : { connected: false, threads_user_id: '', expires_at: '', live: null });
  if (p === '/api/threads/posts') return json(res, 200, { items: M.posts === 'none' ? [] : POSTS });
  if (p === '/api/threads/insights') {
    if (M.noins) return json(res, 403, { error: 'Нет прав', code: 'no_insights_permission' });
    const x = INS[u.searchParams.get('id')];
    return x ? json(res, 200, x) : json(res, 400, { error: 'нет' });
  }
  if (p === '/api/threads/replies') return json(res, 200, { items: REPLIES[u.searchParams.get('id')] || [] });
  if (p === '/api/threads/search') return json(res, 200, { items: M.search === 'none' ? [] : SEARCH });
  if (p === '/api/threads/analytics') {
    if (M.analytics === 'nodata') return json(res, 200, { ...analytics(), has_data: false });
    if (M.analytics === 'noins') return json(res, 403, { error: 'Нет прав', code: 'no_insights_permission' });
    return json(res, 200, analytics());
  }
  if (p === '/api/threads/analytics/collect') { M.analytics = 'data'; return json(res, 200, { ok: true, ...analytics() }); }
  if (p === '/api/threads/post' && req.method === 'POST') {
    let b = ''; req.on('data', c => { b += c; }); req.on('end', () => {
      let d = {}; try { d = JSON.parse(b); } catch (e) {}
      log.push('POST body: text=' + (d.text || '').length + ' image=' + (d.image_base64 ? d.image_base64.slice(0, 23) + '…' + d.image_base64.length : '-'));
      json(res, 200, { ok: true, id: '999' });
    });
    return;
  }
  if (p === '/api/threads/oauth/start') return send(res, 200, 'text/html; charset=utf-8', '<p>oauth stub</p>');
  send(res, 404, 'text/plain', 'нет: ' + p);
});
srv.listen(PORT, () => console.log('стенд: http://127.0.0.1:' + PORT + '/threads  (src=' + SRC + ')'));
