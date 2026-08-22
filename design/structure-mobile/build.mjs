/* Сборка артбордов Claude Design для мобильного /structure.
   Один источник вёрстки: правим здесь, гоним `node build.mjs`, пересеиваем холст.
   Значения цветов/геометрии — из /set (server.js → THEME_DEFAULTS, отдаются в /theme.css),
   палитра типов файлов и фоны — из web/public/structure.html и sidebar.js. */
import { writeFileSync } from 'node:fs';

const CSS = `
  /* ===== токены /set (THEME_DEFAULTS → /theme.css) ===== */
  :root{
    --ui-brand:#00a0ff; --ui-danger:#f87171;
    --ui-radius:8px; --ui-card-radius:12px;
    --ui-page-pad-m:14px; --ui-field-h:44px; --ui-sheet-radius:22px;
    --ui-inp-bg:#1a1a1a; --ui-inp-border:#333333; --ui-inp-ph:#666666;
    --ui-inp-radius:8px; --ui-ico:#e8e8e8; --ui-ico-stroke:2;
    --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:#0f0f0f;color:#fff;
       font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
       -webkit-font-smoothing:antialiased;}
  a{color:var(--ui-brand);text-decoration:none;}
  a:hover{color:#1aacff;}
  svg{width:18px;height:18px;flex:0 0 auto;fill:none;stroke:currentColor;
      stroke-width:var(--ui-ico-stroke,2);stroke-linecap:round;stroke-linejoin:round;}

  .scr{position:relative;width:390px;height:844px;overflow:hidden;
       display:flex;flex-direction:column;background:#0f0f0f;}

  /* кнопка меню — sidebar.js: fixed top:12 right:12, 42x42, radius 10 */
  .brg{position:absolute;top:12px;right:12px;z-index:6;width:42px;height:42px;
       border-radius:10px;background:#1a1a1a;border:1px solid #2a2a2a;color:#fff;
       display:flex;align-items:center;justify-content:center;font-size:19px;}

  /* ===== закреплённая шапка: заголовок + поиск + путь ===== */
  .top{flex:0 0 auto;background:#0f0f0f;border-bottom:1px solid #1c1c1c;
       padding:14px var(--ui-page-pad-m) 8px;display:flex;flex-direction:column;gap:10px;}
  .hdr{display:flex;flex-direction:column;gap:3px;}
  h1{font-size:17px;font-weight:600;padding-right:54px;letter-spacing:-.01em;}
  h1 .count{font-size:13px;color:#666;font-weight:400;margin-left:6px;}
  .back{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#666;}
  .back .v{color:#444;}

  .srch{position:relative;display:flex;align-items:center;}
  .srch .mag{position:absolute;left:12px;color:#5c5c5c;width:17px;height:17px;}
  .srch input{width:100%;height:var(--ui-field-h,44px);padding:0 44px;
              background:var(--ui-inp-bg,#1a1a1a);border:1px solid var(--ui-inp-border,#333);
              border-radius:var(--ui-inp-radius,8px);color:#fff;font-family:inherit;
              font-size:16px;outline:none;}
  .srch input::placeholder{color:var(--ui-inp-ph,#666);}
  .srch input.on{border-color:#00a0ff55;}
  .clr{position:absolute;right:1px;width:42px;height:42px;color:#7a7a7a;
       display:flex;align-items:center;justify-content:center;}
  .clr svg{width:16px;height:16px;}

  .crumbs{display:flex;align-items:center;gap:7px;min-height:34px;
          font-family:var(--mono);font-size:12.5px;color:#666;overflow:hidden;}
  .crumbs .sep{color:#333;}
  .crumbs .up{color:#6ab0f5;}
  .crumbs b{color:#e8e8e8;font-weight:600;}
  .found{display:flex;align-items:center;justify-content:space-between;min-height:34px;
         font-size:12.5px;color:#666;}
  .found em{font-style:normal;color:#e8e8e8;}
  .found a{font-size:12.5px;color:#6ab0f5;}

  /* ===== список ===== */
  .list{flex:1 1 auto;overflow:hidden;}
  .grp{padding:15px var(--ui-page-pad-m) 6px;font-size:10px;letter-spacing:.08em;
       text-transform:uppercase;color:#555;}
  .row{display:flex;align-items:center;gap:12px;min-height:60px;
       padding:10px var(--ui-page-pad-m);border-bottom:1px solid #171717;color:inherit;}
  .row.sel{background:#141414;}
  .row .body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px;}
  .nm{font-family:var(--mono);font-size:14.5px;line-height:1.25;word-break:break-all;}
  .cm{font-size:12px;line-height:1.35;color:#6a6a6a;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .pth{font-family:var(--mono);font-size:11.5px;color:#4e4e4e;
       overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .hit{color:var(--ui-brand);background:rgba(0,160,255,.14);border-radius:3px;padding:0 1px;}
  .dir{color:#6ab0f5;} .js{color:#4ade80;} .htm{color:#fb923c;}
  .md{color:#c084fc;} .file{color:#8a8a8a;}
  .ic{opacity:.85;}
  .chev{color:#3f3f3f;width:17px;height:17px;transform:rotate(-90deg);}
  .more{width:44px;height:44px;margin-right:-12px;color:#5a5a5a;
        display:flex;align-items:center;justify-content:center;}
  .more svg{width:17px;height:17px;}

  /* ===== аккордеон (вариант B) ===== */
  .row.lv1{padding-left:calc(var(--ui-page-pad-m) + 20px);}
  .row.lv2{padding-left:calc(var(--ui-page-pad-m) + 40px);}
  .row.open .chev{transform:rotate(0deg);color:#00a0ff;}
  .guide{position:absolute;top:0;bottom:0;width:1px;background:#1c1c1c;}

  /* ===== шторка действий ===== */
  .dim{position:absolute;inset:0;background:rgba(0,0,0,.55);}
  .sheet{position:absolute;left:0;right:0;bottom:0;background:#0a0a0a;
         border-top:1px solid #1a1a1a;
         border-radius:var(--ui-sheet-radius,22px) var(--ui-sheet-radius,22px) 0 0;
         box-shadow:0 -10px 30px rgba(0,0,0,.6);padding:8px 0 26px;}
  .grab{width:38px;height:4px;border-radius:2px;background:#2c2c2c;margin:4px auto 14px;}
  .sh-hd{padding:0 18px 12px;border-bottom:1px solid #161616;display:flex;
         flex-direction:column;gap:5px;}
  .sh-hd .nm{font-size:16px;}
  .sh-note{margin:12px 18px 6px;padding:10px 12px;background:#101010;
           border:1px solid #1e1e1e;border-radius:var(--ui-card-radius,12px);
           font-size:12.5px;line-height:1.45;color:#8a8a8a;}
  .act{display:flex;align-items:center;gap:13px;min-height:54px;padding:7px 18px;
       color:#e8e8e8;font-size:15px;}
  .act svg{width:19px;height:19px;color:#8a8a8a;}
  .act .sub{display:block;margin-top:2px;font-family:var(--mono);font-size:11.5px;color:#5a5a5a;}

  /* уведомление о копировании — как в structure.html (toast) */
  .toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);
         background:#1a1a1a;border:1px solid #333;color:#fff;padding:9px 14px;
         border-radius:8px;font-size:13px;max-width:90%;white-space:nowrap;
         overflow:hidden;text-overflow:ellipsis;}
`;

/* ---- иконки: те же контуры, что в web/public/assets/icons.svg ---- */
const I = {
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  file:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  chev:   '<path d="m6 9 6 6 6-6"/>',
  search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  x:      '<path d="M18 6 6 18M6 6l12 12"/>',
  copy:   '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  globe:  '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  open:   '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>',
  dots:   '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  net:    '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
};
const svg = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

/* класс типа — та же логика, что cls() в structure.html */
function kind(name) {
  if (!name.includes('.')) return 'dir';
  if (/\.(mjs|js)$/.test(name)) return 'js';
  if (/\.html$/.test(name)) return 'htm';
  if (/\.md$/.test(name)) return 'md';
  return 'file';
}

const burger = '<div class="brg" aria-label="Меню">☰</div>';

function head(count, extra = '') {
  return `<div class="hdr">
      <h1>Структура проекта<span class="count">(${count})</span></h1>
      <div class="back">← AI-платформа <span class="v">v1.99.0</span></div>
    </div>${extra}`;
}

function field({ value = '', ph = 'Фильтр: mjs, dnevnik, web…', clear = false } = {}) {
  return `<div class="srch">
      ${svg('search', 'mag')}
      <input type="text" ${value ? `class="on" value="${value}"` : ''} placeholder="${ph}">
      ${clear ? `<div class="clr">${svg('x')}</div>` : ''}
    </div>`;
}

/* строка списка: папка — с шевроном, файл — с «⋮» */
function row(name, comment, { level = 0, open = false, sel = false, flatPath = '' } = {}) {
  const k = kind(name);
  const isDir = k === 'dir';
  const lv = level ? ` lv${level}` : '';
  return `<div class="row${lv}${sel ? ' sel' : ''}${open ? ' open' : ''}">
      <span class="${k} ic">${svg(isDir ? 'folder' : 'file')}</span>
      <span class="body">
        ${flatPath ? `<span class="pth">${flatPath}</span>` : ''}
        <span class="nm ${k}">${name}</span>
        ${comment ? `<span class="cm">${comment}</span>` : ''}
      </span>
      ${isDir ? svg('chev', 'chev') : `<span class="more">${svg('dots')}</span>`}
    </div>`;
}

function dc(body) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>${CSS}</style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;
}

const out = (file, body) => { writeFileSync(file, dc(body)); console.log('  ' + file); };

/* =========================================================
   ЭКРАН 0 — как открывается сейчас (десктопная вёрстка на 390px)
   ========================================================= */
const nowLines = [
  ['~', 0, 'dir', ''],
  ['mcp-server', 1, 'dir', 'ядро: MCP API (3000), SSE-коннектор (3002), бот дневника'],
  ['integrations', 2, 'dir', 'интеграции: wordstat, yandexgpt, webmaster, seo_auto'],
  ['mcp_sse.mjs', 2, 'js', 'SSE-коннектор для Claude (list_tasks, create_task, wordstat)'],
  ['server.mjs', 2, 'js', 'MCP API — эндпоинты /tools/*'],
  ['web', 1, 'dir', 'веб-панель (3001, за nginx :80)'],
  ['public', 2, 'dir', 'все страницы платформы: CRM, финансы, медкарта, кабинеты'],
  ['server.js', 2, 'js', 'Express: все API платформы — задачи, CRM, финансы, медкарта'],
  ['tasks.js', 2, 'js', 'API бэклога задач (data/tasks.db)'],
];
out('Now.dc.html', `
<div class="scr">
  ${burger}
  <div style="padding:16px 24px;border-bottom:1px solid #222;display:flex;
              flex-wrap:wrap;row-gap:6px;align-items:center;">
    <h1 style="width:100%;order:1;">Структура проекта</h1>
    <div style="order:2;width:100%;display:flex;justify-content:space-between;align-items:center;">
      <span style="color:#666;font-size:13px;">← AI-платформа <span style="color:#444;">v1.99.0</span></span>
    </div>
  </div>
  <div style="padding:24px;">
    <input type="text" placeholder="Фильтр (например: mjs, dnevnik, web)..."
           style="width:100%;background:#1a1a1a;border:1px solid #333;border-radius:6px;
                  padding:9px 12px;color:#fff;margin-bottom:16px;font-size:13px;outline:none;
                  font-family:inherit;">
    <div style="font-family:var(--mono);font-size:13px;line-height:1.7;color:#aaa;
                white-space:pre;">${nowLines.map(([n, d, k, c]) =>
      '  '.repeat(d) + `<span class="${k}">${n}</span>` +
      `<span style="color:#4a4a4a;"> ⧉</span>` +
      (c ? `<span style="color:#555;">  // ${c}</span>` : '')).join('\n')}</div>
  </div>
</div>`);

/* =========================================================
   ВАРИАНТ A — проваливание по папкам
   ========================================================= */
out('Main.dc.html', `
<div class="scr">
  ${burger}
  <div class="top">
    ${head('784')}
    ${field()}
    <div class="crumbs"><span class="dir">${svg('net')}</span><b>/home/cashruflow</b></div>
  </div>
  <div class="list">
    <div class="grp">Папки</div>
    ${row('mcp-server', 'ядро: MCP API (3000), SSE-коннектор (3002), бот дневника')}
    ${row('web', 'веб-панель (3001, за nginx :80)')}
    ${row('gpt', 'GPT-ядро: точка входа, реестр агентов, клиент OpenAI')}
    ${row('notediscovery', 'дневник и база знаний (8000)')}
    ${row('docs', 'документация: VERSION, ARCHITECTURE, ADR')}
    ${row('data', 'SQLite: tasks.db (бэклог + промты), med.sqlite (медкарта)')}
    ${row('design', 'макеты из Claude Design — переносятся навыком design-transfer')}
    ${row('scripts', 'утилиты и cron')}
    ${row('backups', 'бэкапы перед правками — дата в имени файла')}
  </div>
</div>`);

out('AFolder.dc.html', `
<div class="scr">
  ${burger}
  <div class="top">
    ${head('22')}
    ${field()}
    <div class="crumbs">
      <span class="up">${svg('folder')}</span>
      <span class="up">web</span><span class="sep">/</span><b>public</b>
    </div>
  </div>
  <div class="list">
    <div class="grp">Папки</div>
    ${row('assets', 'иконки и логотипы (icons.svg, logo.svg)')}
    ${row('img', 'картинки: логотипы сервисов')}
    <div class="grp">Файлы</div>
    ${row('index.html', 'главная: дашборд, плашки, карточки инструментов')}
    ${row('structure.html', 'живое дерево проекта с // комментариями')}
    ${row('tasks.html', 'бэклог задач: таблица, таймеры, виджет «в работе», спринты')}
    ${row('set.html', 'настройки /set: тема, геометрия карточек (--ui-токены)')}
    ${row('sidebar.js', 'общий сайдбар навигации всех страниц')}
    ${row('ui.css', 'общая тема портала: CSS-переменные (--ui-brand, --ui-ico)')}
  </div>
  <div class="toast">Скопировано: /home/cashruflow/web/public/set.html</div>
</div>`);

out('ASearch.dc.html', `
<div class="scr">
  ${burger}
  <div class="top">
    ${head('784')}
    ${field({ value: 'mcp', clear: true })}
    <div class="found"><span>Найдено: <em>7</em></span><a>Сбросить</a></div>
  </div>
  <div class="list">
    ${row('mcp-server', 'ядро: MCP API (3000), SSE-коннектор (3002), бот дневника',
      { flatPath: '~/' }).replace('>mcp-server<', '><span class="hit">mcp</span>-server<')}
    ${row('mcp_sse.mjs', 'SSE-коннектор для Claude (list_tasks, create_task, wordstat)',
      { flatPath: '~/mcp-server/' }).replace('>mcp_sse.mjs<', '><span class="hit">mcp</span>_sse.mjs<')}
    ${row('mcp_gpt_sse.mjs', 'SSE-коннектор для GPT (аналог mcp_sse)',
      { flatPath: '~/mcp-server/' }).replace('>mcp_gpt_sse.mjs<', '><span class="hit">mcp</span>_gpt_sse.mjs<')}
    ${row('mcp_server.mjs', 'StreamableHTTP MCP для ChatGPT (от GPT, на верификации)',
      { flatPath: '~/mcp-server/' }).replace('>mcp_server.mjs<', '><span class="hit">mcp</span>_server.mjs<')}
    ${row('create_gpt_mcp.py', 'разовый скрипт создания GPT MCP',
      { flatPath: '~/mcp-server/' }).replace('_mcp.py<', '_<span class="hit">mcp</span>.py<')}
    ${row('mcp', 'старый бэкап MCP-ядра',
      { flatPath: '~/' }).replace('>mcp<', '><span class="hit">mcp</span><')}
  </div>
</div>`);

out('ASheet.dc.html', `
<div class="scr">
  ${burger}
  <div class="top">
    ${head('22')}
    ${field()}
    <div class="crumbs">
      <span class="up">${svg('folder')}</span>
      <span class="up">web</span><span class="sep">/</span><b>public</b>
    </div>
  </div>
  <div class="list">
    <div class="grp">Папки</div>
    ${row('assets', 'иконки и логотипы (icons.svg, logo.svg)')}
    ${row('img', 'картинки: логотипы сервисов')}
    <div class="grp">Файлы</div>
    ${row('index.html', 'главная: дашборд, плашки, карточки инструментов')}
    ${row('structure.html', 'живое дерево проекта с // комментариями', { sel: true })}
  </div>
  <div class="dim"></div>
  <div class="sheet">
    <div class="grab"></div>
    <div class="sh-hd">
      <span class="nm htm">structure.html</span>
      <span class="pth">/home/cashruflow/web/public/structure.html</span>
    </div>
    <div class="sh-note">живое дерево проекта с // комментариями</div>
    <div class="act">${svg('copy')}<span>Скопировать путь</span></div>
    <div class="act">${svg('globe')}<span>Скопировать публичную ссылку
      <span class="sub">ai.cashruflow.ru/structure.html</span></span></div>
    <div class="act">${svg('open')}<span>Открыть страницу</span></div>
  </div>
</div>`);

/* =========================================================
   ВАРИАНТ B — аккордеон
   ========================================================= */
out('BTree.dc.html', `
<div class="scr">
  ${burger}
  <div class="top">
    ${head('784')}
    ${field()}
    <div class="found"><span class="crumbs"><b>/home/cashruflow</b></span><a>Свернуть всё</a></div>
  </div>
  <div class="list">
    ${row('mcp-server', 'ядро: MCP API (3000), SSE-коннектор (3002), бот дневника')}
    ${row('web', 'веб-панель (3001, за nginx :80)')}
    ${row('gpt', 'GPT-ядро: точка входа, реестр агентов, клиент OpenAI')}
    ${row('notediscovery', 'дневник и база знаний (8000)')}
    ${row('docs', 'документация: VERSION, ARCHITECTURE, ADR')}
    ${row('data', 'SQLite: tasks.db (бэклог + промты), med.sqlite (медкарта)')}
    ${row('design', 'макеты из Claude Design — переносятся навыком design-transfer')}
    ${row('scripts', 'утилиты и cron')}
    ${row('backups', 'бэкапы перед правками — дата в имени файла')}
  </div>
</div>`);

out('BOpen.dc.html', `
<div class="scr">
  ${burger}
  <div class="top">
    ${head('784')}
    ${field()}
    <div class="found"><span class="crumbs"><b>/home/cashruflow</b></span><a>Свернуть всё</a></div>
  </div>
  <div class="list">
    ${row('mcp-server', 'ядро: MCP API (3000), SSE-коннектор (3002), бот дневника')}
    ${row('web', 'веб-панель (3001, за nginx :80)', { open: true })}
    ${row('public', 'все страницы платформы: CRM, финансы, медкарта, кабинеты', { level: 1, open: true })}
    ${row('index.html', 'главная: дашборд, плашки, карточки инструментов', { level: 2 })}
    ${row('structure.html', 'живое дерево проекта с // комментариями', { level: 2 })}
    ${row('sidebar.js', 'общий сайдбар навигации всех страниц', { level: 2 })}
    ${row('server.js', 'Express: все API платформы — задачи, CRM, финансы, медкарта', { level: 1 })}
    ${row('tasks.js', 'API бэклога задач (data/tasks.db)', { level: 1 })}
    ${row('gpt', 'GPT-ядро: точка входа, реестр агентов, клиент OpenAI')}
  </div>
</div>`);

/* =========================================================
   СПЕЦИФИКАЦИЯ — какой элемент какой токен /set читает
   ========================================================= */
const SPEC = [
  ['Шапка и поля', [
    ['Боковые отступы экрана', '--ui-page-pad-m', '14px'],
    ['Высота строки поиска', '--ui-field-h', '44px'],
    ['Фон строки поиска', '--ui-inp-bg', '#1a1a1a'],
    ['Рамка строки поиска', '--ui-inp-border', '#333333'],
    ['Подсказка в поиске', '--ui-inp-ph', '#666666'],
    ['Скругление поиска', '--ui-inp-radius', '8px'],
    ['Рамка в фокусе', '--ui-inp-focus', 'var(--ui-brand)'],
  ]],
  ['Список и шторка', [
    ['Скругление карточек/блоков', '--ui-card-radius', '12px'],
    ['Скругление верха шторки', '--ui-sheet-radius', '22px'],
    ['Общее скругление', '--ui-radius', '8px'],
    ['Толщина штриха иконок', '--ui-ico-stroke', '2'],
    ['Размер иконки действия', '--ui-btni-ico', '15px'],
    ['Цвет иконки действия', '--ui-btni-text', '#8a8a8a'],
    ['Наведение иконки', '--ui-btni-hover-text', 'var(--ui-brand)'],
  ]],
  ['Акценты', [
    ['Акцент платформы', '--ui-brand', '#00a0ff'],
    ['Опасное действие', '--ui-danger', '#f87171'],
  ]],
];
const PAL = [
  ['Папка', '#6ab0f5', '.dir'],
  ['.js / .mjs', '#4ade80', '.mjs'],
  ['.html', '#fb923c', '.html'],
  ['.md', '#c084fc', '.md'],
  ['Прочие файлы', '#8a8a8a', '.file'],
  ['Комментарий', '#555555', 'структура: // подпись'],
];

out('Tokens.dc.html', `
<div style="width:760px;min-height:1000px;background:#0f0f0f;padding:34px 36px 40px;
            display:flex;flex-direction:column;gap:26px;">
  <div style="display:flex;flex-direction:column;gap:7px;">
    <div style="font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:#555;">
      Мобильный /structure</div>
    <div style="font-size:23px;font-weight:600;letter-spacing:-.01em;">Что берём из /set</div>
    <div style="font-size:13px;line-height:1.5;color:#777;max-width:56ch;">
      Ни одного литерала в новой вёрстке: геометрия и цвета читаются переменными из
      <span style="font-family:var(--mono);color:#6ab0f5;">/theme.css</span>, который отдаёт
      <span style="font-family:var(--mono);color:#6ab0f5;">server.js → getTheme()</span>.
      Фолбэк в <span style="font-family:var(--mono);color:#8a8a8a;">var(--x, …)</span> = текущее
      значение THEME_DEFAULTS, чтобы включение ничего не перекрасило.
    </div>
  </div>

  ${SPEC.map(([title, rows]) => `
  <div style="display:flex;flex-direction:column;gap:0;">
    <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#555;
                padding-bottom:9px;">${title}</div>
    ${rows.map(([what, token, val]) => `
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 210px 150px;gap:16px;
                align-items:center;padding:10px 0;border-top:1px solid #1a1a1a;">
      <span style="font-size:13.5px;color:#d8d8d8;">${what}</span>
      <span style="font-family:var(--mono);font-size:12.5px;color:#00a0ff;">${token}</span>
      <span style="font-family:var(--mono);font-size:12.5px;color:#7a7a7a;">${val}</span>
    </div>`).join('')}
  </div>`).join('')}

  <div style="display:flex;flex-direction:column;gap:0;">
    <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#555;
                padding-bottom:9px;">Палитра типов — из structure.html, не из /set</div>
    ${PAL.map(([what, hex, sel]) => `
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 210px 150px;gap:16px;
                align-items:center;padding:10px 0;border-top:1px solid #1a1a1a;">
      <span style="display:flex;align-items:center;gap:10px;font-size:13.5px;color:#d8d8d8;">
        <span style="width:13px;height:13px;border-radius:3px;background:${hex};"></span>${what}</span>
      <span style="font-family:var(--mono);font-size:12.5px;color:#7a7a7a;">${sel}</span>
      <span style="font-family:var(--mono);font-size:12.5px;color:${hex};">${hex}</span>
    </div>`).join('')}
  </div>

  <div style="margin-top:4px;padding:14px 16px;background:#101010;border:1px solid #1e1e1e;
              border-radius:var(--ui-card-radius,12px);display:flex;flex-direction:column;gap:9px;">
    <div style="font-size:12.5px;font-weight:600;color:#e8e8e8;">Два места, где токенов не хватает</div>
    <div style="font-size:12.5px;line-height:1.5;color:#8a8a8a;">
      <b style="color:#fb923c;font-weight:600;">Кегль поля поиска.</b>
      <span style="font-family:var(--mono);">--ui-inp-fs</span> = 13px, и на iOS Safari при фокусе
      на поле меньше 16px страницу зумит. В макете поиск набран 16px — либо новый ключ
      <span style="font-family:var(--mono);">ui_inp_fs_m</span> в /set, либо
      <span style="font-family:var(--mono);">max(16px, var(--ui-inp-fs))</span> только под мобилой.
    </div>
    <div style="font-size:12.5px;line-height:1.5;color:#8a8a8a;">
      <b style="color:#fb923c;font-weight:600;">Высота строки списка.</b>
      Отдельного токена нет; взят
      <span style="font-family:var(--mono);">--ui-field-h</span> (44px) как минимум тач-таргета,
      фактическая строка 60px из-за второй строки с подписью.
    </div>
  </div>
</div>`);
