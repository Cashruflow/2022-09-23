/* Харнесс: поднимает разметку портала и кабинета в jsdom, грузит боевые модули как есть.
   Исходники не трогаются — только окружение вокруг них. */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_PINS = fs.readFileSync(path.join(DIR, 'menu-pins.js'), 'utf8');
const SRC_COPY = fs.readFileSync(path.join(DIR, 'page-copy.js'), 'utf8');

/* jsdom-массивы приходят из другого реалма — приводим к обычным перед сравнением */
export const arr = (x) => Array.from(x || []);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --- разметка портала: #app-sidebar > .sb-nav > (.sb-group + .sb-items > a.sb-link) ---
   Переводы строк между ссылками сохранены намеренно: в боевом шаблоне они есть. */
export function portalHTML(groups) {
  const g = groups || [
    ['РАБОТА', ['/notify', '/tasks', '/crm/leads', '/crm/chats']],
    ['ПРОЕКТЫ', ['/projects/crm', '/sitemap.xml', '/control']],
    ['ЗДОРОВЬЕ', ['/medcard/sex', '/b24/fields']]
  ];
  const esc = (h) => String(h).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const gs = g.map(([title, hrefs], i) => `
<div class="sb-group" onclick="sbToggleGroup(${i})"><span>${title}</span><span class="sb-arrow">&#9662;</span></div>
<div class="sb-items" id="sb-items-${i}">
${hrefs.map((h) => `  <a class="sb-link" href="${esc(h)}"><svg class="ico"></svg>${esc(h)}</a>`).join('\n')}
</div>`).join('\n');
  return `<!doctype html><html><head><title>Уведомления — платформа</title></head><body>
<nav id="app-sidebar">
  <div id="sb-logo-act"></div>
  <div class="sb-nav">${gs}
  </div>
  <div class="sb-foot"><span id="sb-version">v4.19.2</span></div>
</nav>
<main><h1>Уведомления</h1></main>
</body></html>`;
}

/* --- разметка кабинета: .cl-sb > a.logo, a.cl-nav[href]…, #cab-set, #cab-pins-edit, #cab-theme, #cab-logout --- */
export function cabHTML(slug = 'acme', pages = ['crm', 'leads', 'docs', 'pay']) {
  return `<!doctype html><html><head><title>Кабинет</title></head><body>
<div class="cl-sb">
<a class="logo" href="/${slug}">${slug}</a>
${pages.map((p) => `<a class="cl-nav" href="/${slug}/${p}">${p}</a>`).join('\n')}
<a class="cl-nav" id="cab-set" href="/${slug}/set">Настройки</a>
<div class="cl-nav" id="cab-pins-edit"><svg></svg><span>Правка меню</span></div>
<a class="cl-nav" id="cab-theme">Тема</a>
<a class="cl-nav" id="cab-logout">Выход</a>
</div>
</body></html>`;
}

/* Окно с подменёнными matchMedia / PointerEvent / localStorage. */
export function makeWin(html, opts = {}) {
  const dom = new JSDOM(html, {
    url: opts.url || 'https://ai.cashruflow.ru/notify',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const win = dom.window;

  // jsdom: matchMedia — заглушка без .matches, изображаем телефон/ПК вручную
  win.__mobile = opts.mobile !== false;
  win.matchMedia = (q) => ({
    media: q,
    get matches() { return !!win.__mobile; },
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
  });
  Object.defineProperty(win, 'innerWidth', { value: opts.innerWidth ?? (opts.mobile === false ? 1440 : 390), writable: true, configurable: true });
  Object.defineProperty(win, 'innerHeight', { value: 844, writable: true, configurable: true });

  // jsdom не умеет PointerEvent — синтезируем поверх MouseEvent
  if (!win.PointerEvent) {
    win.PointerEvent = class PointerEvent extends win.MouseEvent {
      constructor(type, init = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'touch';
        this.isPrimary = init.isPrimary ?? true;
      }
    };
  }
  // setPointerCapture в jsdom нет — ставим no-op, чтобы код пошёл по «браузерной» ветке
  const captured = [];
  win.Element.prototype.setPointerCapture = function (id) { captured.push({ el: this, id }); };
  win.Element.prototype.releasePointerCapture = function () {};
  win.__captured = captured;

  if (opts.storage) {
    try { win.localStorage.setItem('cf_pins_v1', opts.storage); } catch (e) {}
  }
  if (opts.brokenStorage) {
    const mem = {};
    Object.defineProperty(win, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k) => (k in mem ? mem[k] : null),
        setItem: () => { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; },
        removeItem: (k) => { delete mem[k]; },
        clear: () => {}
      }
    });
  }
  win.__toasts = [];
  win.uiToast = (m) => win.__toasts.push(m);
  return { dom, win, doc: win.document };
}

export function loadPins(win) {
  const s = win.document.createElement('script');
  s.textContent = SRC_PINS;
  win.document.head.appendChild(s);
  return win.MenuPins;
}
export function loadCopy(win) {
  const s = win.document.createElement('script');
  s.textContent = SRC_COPY;
  win.document.head.appendChild(s);
  return win.cfCopyPage;
}

/* Боевые вызовы из CONTEXT.md */
export function mountPortal(win, extra = {}) {
  return win.MenuPins.mount(Object.assign({
    scope: 'portal',
    root: win.document.getElementById('app-sidebar'),
    list: win.document.querySelector('#app-sidebar .sb-nav'),
    linkSel: 'a.sb-link',
    editHost: win.document.getElementById('sb-logo-act'),
    defaults: ['/crm/chats', '/crm/leads', '/notify'],
    mq: '(max-width:768px)'
  }, extra));
}
export function mountCab(win, slug = 'acme', extra = {}) {
  const sb = win.document.querySelector('.cl-sb');
  return win.MenuPins.mount(Object.assign({
    scope: 'cab:' + slug,
    root: sb, list: sb,
    before: sb.querySelector('a.cl-nav[href]'),
    linkSel: 'a.cl-nav[href]',
    mq: '(max-width:820px)'
  }, extra));
}

/* Чужой код из CONTEXT.md */
export function installCabBurger(win, BP = 820) {
  const calls = [];
  const sb = () => win.document.querySelector('.cl-sb');
  win.document.addEventListener('click', function (e) {
    if (win.innerWidth > BP) return;
    const el = sb();
    if (!el || !el.contains(e.target)) return;
    if (win.MenuPins && win.MenuPins.suppressed(e.target)) return;
    if (e.target.closest('.cl-nav, a')) calls.push(e.target);
  }, true);
  return calls; // каждый элемент = один вызов open(false), т.е. шторка закрылась
}
export function installPortalCloser(win) {
  const calls = [];
  win.document.addEventListener('click', (e) => {
    if (win.innerWidth > 768) return;
    const a = e.target.closest && e.target.closest('#app-sidebar a');
    if (a) calls.push(a);
  });
  return calls;
}
export function installBadgePoller(win, href = '/crm/chats') {
  return function poll(unread) {
    const link = win.document.querySelector('#app-sidebar a[href="' + href + '"]');
    if (!link) return null;
    let b = link.querySelector('.sb-badge');
    if (unread > 0) {
      if (!b) { b = win.document.createElement('span'); b.className = 'sb-badge'; link.appendChild(b); }
      b.textContent = String(unread);
    } else if (b) b.remove();
    return b;
  };
}
export function installToggleGroup(win) {
  win.sbToggleGroup = function (gi) {
    const items = win.document.getElementById('sb-items-' + gi);
    const collapsed = items.classList.toggle('collapsed');
    if (!collapsed) { items.style.maxHeight = items.scrollHeight + 'px'; }
    else { items.style.maxHeight = '0px'; }
    return collapsed;
  };
}

/* События */
export function ev(win, el, type, init = {}) {
  const E = /^pointer/.test(type) ? win.PointerEvent : win.MouseEvent;
  const e = new E(type, Object.assign({ bubbles: true, cancelable: true, composed: true, clientX: 10, clientY: 10 }, init));
  el.dispatchEvent(e);
  return e;
}
export const down = (win, el, i = {}) => ev(win, el, 'pointerdown', i);
export const up = (win, el, i = {}) => ev(win, el, 'pointerup', i);
export const move = (win, el, i = {}) => ev(win, el, 'pointermove', i);
export const cancel = (win, el, i = {}) => ev(win, el, 'pointercancel', i);
export const click = (win, el, i = {}) => ev(win, el, 'click', i);

/* Долгое нажатие как в жизни: палец вниз, ждём >600 мс, палец вверх, потом click. */
export async function longPress(win, el, { holdFor = 700, withClick = true, cancelInstead = false } = {}) {
  down(win, el, { pointerType: 'touch' });
  await sleep(holdFor);
  if (cancelInstead) { cancel(win, el, { pointerType: 'touch' }); return; }
  up(win, el, { pointerType: 'touch' });
  if (withClick) click(win, el);
}

export const rowsOf = (el) => [].slice.call(el.querySelectorAll(':scope > .mp-row'));
export const hrefsIn = (el) => rowsOf(el).map((r) => { const a = r.querySelector('a'); return a && a.getAttribute('href'); });
export const groupHrefs = (win, gi) => [].slice.call(win.document.getElementById('sb-items-' + gi).children)
  .filter((n) => n.classList && n.classList.contains('mp-row'))
  .map((r) => r.querySelector('a').getAttribute('href'));
export const pinsStored = (win) => { try { return JSON.parse(win.localStorage.getItem('cf_pins_v1') || 'null'); } catch (e) { return 'НЕ JSON'; } };

/* --- page-copy: в jsdom нет ни fetch, ни Response, ни clipboard --- */
export function makeRes(win, { ok = true, status = 200, body = '{"x":1}', textDelay = 0 } = {}) {
  const mk = () => ({
    ok, status, _used: false,
    clone() { if (this._used) throw new TypeError('body already used'); return mk(); },
    text() {
      this._used = true;
      return new win.Promise((r) => (textDelay ? win.setTimeout(() => r(body), textDelay) : r(body)));
    },
    json() { return this.text().then(JSON.parse); }
  });
  return mk();
}
export function installFetch(win, impl) { win.fetch = impl; }

/* Перехватываем то, что модуль реально кладёт в буфер. */
export async function grabCopy(win) {
  let out = null;
  Object.defineProperty(win.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (t) => { out = t; return Promise.resolve(); } }
  });
  win.cfCopyPage();
  await sleep(5);
  return out;
}
export function section(txt, name) {
  const i = txt.indexOf('## ' + name);
  if (i < 0) return '';
  const rest = txt.slice(i);
  const j = rest.indexOf('\n## ', 3);
  return (j < 0 ? rest : rest.slice(0, j)).trim();
}
export const lineWith = (txt, prefix) => txt.split('\n').find((l) => l.startsWith(prefix)) || '';
