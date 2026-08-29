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

  /* ===== аккордеон: шеврон слева, шаг уровня 18px, направляющая линия ===== */
  .row{position:relative;}
  .row.lv1{padding-left:calc(var(--ui-page-pad-m) + 18px);}
  .row.lv2{padding-left:calc(var(--ui-page-pad-m) + 36px);}
  .tog{width:17px;height:17px;color:#3f3f3f;transform:rotate(-90deg);
       transition:transform .18s, color .18s;}
  .row.open > .tog{transform:rotate(0deg);color:var(--ui-brand);}
  .row.lf .tog{visibility:hidden;}
  .gd{position:absolute;top:0;bottom:0;width:1px;background:#1c1c1c;}
  .row.last .gd.deep{bottom:auto;height:30px;}

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

  /* =========== ПК: сайдбар портала (sidebar.js) + плотное дерево =========== */
  .dsk{display:flex;width:1440px;height:900px;background:#0f0f0f;overflow:hidden;}
  .sb{flex:0 0 230px;background:#0a0a0a;border-right:1px solid #1a1a1a;
      display:flex;flex-direction:column;padding:16px 0;overflow:hidden;}
  .sb-logo{display:flex;align-items:center;gap:8px;padding:6px 20px 18px;
           font-size:16px;font-weight:700;color:#fff;}
  .sb-logo .v{font-size:11px;color:#555;font-weight:400;}
  .sb-logo .dot{width:8px;height:8px;border-radius:50%;background:#2ecc71;
                box-shadow:0 0 5px #2ecc7166;}
  .sb-ses{margin-top:-8px;padding:0 20px 10px;font-size:10px;color:#555;line-height:1.5;}
  .sb-nav{flex:1 1 auto;min-height:0;overflow:hidden;}
  .sb-grp{display:flex;align-items:center;justify-content:space-between;
          padding:14px 20px 6px;font-size:10px;letter-spacing:.08em;
          text-transform:uppercase;color:#555;}
  .sb-grp .ar{font-size:10px;display:inline-block;}
  .sb-grp.cl .ar{transform:rotate(-90deg);}
  .sb-items{position:relative;}
  .sb-items::before{content:'';position:absolute;left:27px;top:0;bottom:6px;
                    width:1px;background:#1c1c1c;}
  .sb-link{position:relative;display:flex;align-items:center;gap:var(--ui-nav-gap,11px);
           padding:var(--ui-nav-pad,8px) 14px var(--ui-nav-pad,8px) 44px;margin-right:10px;
           border-radius:0 8px 8px 0;color:#aaa;font-size:var(--ui-nav-fs,14px);}
  .sb-link .ico{width:var(--ui-nav-ico,18px);height:var(--ui-nav-ico,18px);color:#8a8a8a;}
  .sb-link::before{content:'';position:absolute;left:28px;top:50%;width:9px;height:1px;
                   background:#232323;}
  .sb-link.act{color:#00a0ff;font-weight:600;
               background:linear-gradient(90deg,rgba(0,160,255,.14),rgba(0,160,255,.03));}
  .sb-link.act .ico{color:#00a0ff;}
  .sb-link.act::before{background:#00a0ff;width:12px;box-shadow:0 0 6px rgba(0,160,255,.6);}
  .sb-foot{flex:0 0 auto;padding:14px 20px;border-top:1px solid #1a1a1a;
           display:flex;flex-direction:column;gap:8px;}
  .sb-set{display:flex;align-items:center;gap:9px;margin:0 -10px;padding:8px 10px;
          font-size:13px;color:#aaa;background:#101010;border:1px solid #1e1e1e;
          border-radius:8px;}
  .sb-set .ico{width:16px;height:16px;color:#8a8a8a;}
  .sb-inp{width:100%;margin:0 -10px;background:#101010;border:1px solid #1e1e1e;
          border-radius:8px;padding:8px 10px;color:#eee;font-size:13px;font-family:inherit;}
  .sb-home{display:flex;align-items:center;gap:7px;font-size:12px;color:#666;}
  .sb-home .ico{width:14px;height:14px;color:#666;}

  .dmain{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;}
  .dhead{display:flex;align-items:center;justify-content:space-between;
         padding:16px var(--ui-page-pad,44px);border-bottom:1px solid #222;}
  .dhead h1{font-size:18px;font-weight:600;padding:0;}
  .dhead .back{font-size:13px;color:#666;}
  .dwrap{flex:1 1 auto;min-height:0;padding:22px var(--ui-page-pad,44px) 60px;overflow:hidden;}
  .dcont{width:100%;}
  .dsrch{position:relative;margin-bottom:12px;}
  .dsrch .mag{position:absolute;left:11px;top:50%;margin-top:-8px;
              width:15px;height:15px;color:#5c5c5c;}
  .dsrch input{width:100%;padding:9px 11px 9px 34px;color:#fff;font-family:inherit;
               background:var(--ui-inp-bg,#1a1a1a);border:1px solid var(--ui-inp-border,#333);
               border-radius:var(--ui-inp-radius,8px);font-size:var(--ui-inp-fs,13px);outline:none;}
  .dsrch input.on{border-color:#00a0ff55;}
  .dsrch input::placeholder{color:var(--ui-inp-ph,#666);}
  .dbar{display:flex;align-items:center;justify-content:space-between;
        padding:0 8px 8px;font-family:var(--mono);font-size:12px;color:#666;}
  .dbar .r{display:flex;gap:14px;font-family:-apple-system,sans-serif;}
  .dbar b{color:#e8e8e8;font-weight:600;} .dbar .sep{color:#333;} .dbar .up{color:#6ab0f5;}

  .drow{position:relative;display:flex;align-items:center;gap:8px;min-width:0;
        padding:4px 8px;border-radius:6px;font-family:var(--mono);font-size:13px;line-height:1.7;}
  .drow.hov{background:#141414;}
  .drow .tog{width:14px;height:14px;color:#3f3f3f;transform:rotate(-90deg);}
  .drow.open > .tog{transform:none;color:var(--ui-brand);}
  .drow.lf .tog{visibility:hidden;}
  .drow .ic svg{width:15px;height:15px;}
  .dnm{white-space:nowrap;}
  .dpth{color:#4e4e4e;}
  .dcm{min-width:0;color:#555;font-size:12.5px;
       overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .dact{margin-left:auto;display:flex;gap:2px;padding-left:10px;opacity:0;}
  .drow.hov .dact{opacity:1;}
  .dact span{width:26px;height:26px;display:flex;align-items:center;justify-content:center;
             color:var(--ui-btni-text,#8a8a8a);border-radius:var(--ui-btni-radius,4px);}
  .dact span svg{width:var(--ui-btni-ico,15px);height:var(--ui-btni-ico,15px);}
  .dact span.hi{color:var(--ui-brand);}
  .dgd{position:absolute;top:0;bottom:0;width:1px;background:#1c1c1c;}

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
  access: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  webhook:'<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/>',
  skills: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  bot:    '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  link:   '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  msg:    '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
  gear:   '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
  dash:   '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
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

function head(extra = '') {
  return `<div class="hdr">
      <h1>Структура проекта</h1>
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
function row(name, comment, { level = 0, open = false, sel = false, last = false, flatPath = '', hit = '' } = {}) {
  const k = kind(name);
  const isDir = k === 'dir';
  const cls = ['row', level ? `lv${level}` : '', isDir ? '' : 'lf',
               open ? 'open' : '', sel ? 'sel' : '', last ? 'last' : ''].filter(Boolean).join(' ');
  // направляющие: линия под шевроном родителя, шаг 18px от бокового отступа
  const guides = [];
  for (let i = 1; i <= level; i++) {
    guides.push(`<span class="gd${i === level ? ' deep' : ''}" `
      + `style="left:calc(var(--ui-page-pad-m) + ${(i - 1) * 18 + 8}px);"></span>`);
  }
  const mark = (s) => hit ? s.split(hit).join(`<span class="hit">${hit}</span>`) : s;
  return `<div class="${cls}">
      ${guides.join('')}
      ${svg('chev', 'tog')}
      <span class="${k} ic">${svg(isDir ? 'folder' : 'file')}</span>
      <span class="body">
        ${flatPath ? `<span class="pth">${mark(flatPath)}</span>` : ''}
        <span class="nm ${k}">${mark(name)}</span>
        ${comment ? `<span class="cm">${comment}</span>` : ''}
      </span>
      ${isDir ? '' : `<span class="more">${svg('dots')}</span>`}
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
   СТРАНИЦА «ЧЕРНОВИКИ» — как раздел открывается сейчас на 390px
   ========================================================= */
const nowLines = [
  ['~', 0, ''],
  ['add_adr_013.py', 0, 'разовый скрипт: ADR-013'],
  ['add_changelog_v162.py', 0, 'разовый скрипт: CHANGELOG v1.6.2'],
  ['add_token_stats.py', 0, 'разовый скрипт: статистика токенов'],
  ['agents', 0, 'AI-агенты: diary_agent, gpt_diary_agent'],
  ['gpt_diary_agent', 1, 'GPT-агент дневника (agent.mjs + README)'],
  ['analytics', 0, 'аналитика (план: diary analytics)'],
  ['apps', 0, 'пустая папка (резерв)'],
  ['backups', 0, 'бэкапы перед правками — дата в имени файла'],
  ['config', 0, 'пустая папка (резерв)'],
  ['data', 0, 'SQLite: tasks.db (бэклог + промты), med.sqlite (медкарта)'],
  ['fields_crm.csv', 1, 'исходник полей CRM из Google Sheets'],
  ['med-uploads', 1, 'загруженные файлы анализов'],
  ['med.sqlite', 1, 'SQLite: медкарта'],
  ['projects.csv', 1, 'исходник проектов из Google Sheets'],
  ['projects_crm.csv', 1, 'исходник CRM-порталов из Google Sheets'],
  ['tasks.db', 1, 'SQLite: бэклог задач + промты'],
  ['tenants', 1, 'БД других пользователей мед-модуля (irina.db)'],
  ['database', 0, 'пустая папка (резерв)'],
  ['design', 0, 'макеты из Claude Design — переносятся навыком design-transfer'],
  ['docs', 0, 'документация: VERSION, ARCHITECTURE, ADR'],
  ['ADR', 1, 'architecture decision records — история решений'],
  ['ARCHITECTURE.md', 1, 'как устроена система: модули, связи, потоки данных'],
  ['CHANGELOG.md', 1, 'что изменилось: история по версиям'],
  ['DESIGN-TOKENS.md', 1, 'дизайн-токены платформы — цвета проекта главнее макета'],
  ['PHILOSOPHY.md', 1, 'принципы разработки + правило версионирования'],
  ['ROADMAP.md', 1, 'что дальше: план, идеи, приоритеты'],
  ['VERSION.md', 1, 'состояние сейчас: версия, модули, статус'],
  ['adr', 1, 'дубль папки ADR со строчными буквами (ADR-025 контакты)'],
  ['structure-comments.json', 1, 'подписи для дерева /structure — этот файл'],
  ['fix_diary_usage.py', 0, 'разовый фикс: usage дневника'],
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
                white-space:pre;">${nowLines.map(([n, d, c]) =>
      '  '.repeat(d) + `<span class="${kind(n)}">${n}</span>` +
      `<span style="color:#4a4a4a;"> ⧉</span>` +
      (c ? `<span style="color:#555;">  // ${c}</span>` : '')).join('\n')}</div>
  </div>
</div>`);

/* =========================================================
   ПАНЕЛЬ НАД СПИСКОМ — путь текущей ветки + «свернуть всё»
   ========================================================= */
const bar = (left, right) =>
  `<div class="found"><span class="crumbs">${left}</span>${right}</div>`;

/* =========================================================
   ЭКРАН 1 — корень, всё свёрнуто
   ========================================================= */
out('Main.dc.html', `
<div class="scr">
  ${burger}
  <div class="top">
    ${head()}
    ${field()}
    ${bar('<b>/home/cashruflow</b>', '<a>Свернуть всё</a>')}
  </div>
  <div class="list">
    ${row('agents', 'AI-агенты: diary_agent, gpt_diary_agent')}
    ${row('backups', 'бэкапы перед правками — дата в имени файла')}
    ${row('data', 'SQLite: tasks.db (бэклог + промты), med.sqlite (медкарта)')}
    ${row('design', 'макеты из Claude Design — переносятся навыком design-transfer')}
    ${row('docs', 'документация: VERSION, ARCHITECTURE, ADR')}
    ${row('gpt', 'GPT-ядро: точка входа, реестр агентов, клиент OpenAI')}
    ${row('mcp-server', 'ядро: MCP API (3000), SSE-коннектор (3002), бот дневника')}
    ${row('notediscovery', 'дневник и база знаний (8000)')}
    ${row('scripts', 'утилиты и cron')}
    ${row('web', 'веб-панель (3001, за nginx :80)')}
  </div>
</div>`);

/* =========================================================
   ЭКРАН 2 — ветка web → public раскрыта
   ========================================================= */
out('Open.dc.html', `
<div class="scr">
  ${burger}
  <div class="top">
    ${head()}
    ${field()}
    ${bar('<span class="up">web</span><span class="sep">/</span><b>public</b>',
          '<a>Свернуть всё</a>')}
  </div>
  <div class="list">
    ${row('scripts', 'утилиты и cron')}
    ${row('web', 'веб-панель (3001, за nginx :80)', { open: true })}
    ${row('public', 'все страницы платформы: CRM, финансы, медкарта, кабинеты',
          { level: 1, open: true })}
    ${row('assets', 'иконки и логотипы (icons.svg, logo.svg)', { level: 2 })}
    ${row('index.html', 'главная: дашборд, плашки, карточки инструментов', { level: 2 })}
    ${row('sidebar.js', 'общий сайдбар навигации всех страниц', { level: 2 })}
    ${row('structure.html', 'живое дерево проекта с // комментариями', { level: 2 })}
    ${row('ui.css', 'общая тема портала: CSS-переменные (--ui-brand, --ui-ico)',
          { level: 2, last: true })}
    ${row('server.js', 'Express: все API платформы — задачи, CRM, финансы, медкарта',
          { level: 1 })}
    ${row('tasks.js', 'API бэклога задач (data/tasks.db)', { level: 1, last: true })}
  </div>
</div>`);

/* =========================================================
   ЭКРАН 3 — поиск: тот же фильтр, плоский список найденных путей
   ========================================================= */
out('Search.dc.html', `
<div class="scr">
  ${burger}
  <div class="top">
    ${head()}
    ${field({ value: 'agent', clear: true })}
    <div class="found"><span>Найдено: <em>6</em></span><a>Сбросить</a></div>
  </div>
  <div class="list">
    ${row('agents', 'AI-агенты: diary_agent, gpt_diary_agent',
          { flatPath: '~/', hit: 'agent' })}
    ${row('gpt_diary_agent', 'GPT-агент дневника (agent.mjs + README)',
          { flatPath: '~/agents/', hit: 'agent' })}
    ${row('agent.mjs', '', { flatPath: '~/agents/gpt_diary_agent/', hit: 'agent' })}
    ${row('README.md', '', { flatPath: '~/agents/gpt_diary_agent/', hit: 'agent' })}
    ${row('agents', 'AI-агенты: diary_agent (сводки дневника через Claude → TG)',
          { flatPath: '~/mcp-server/', hit: 'agent' })}
    ${row('diary_agent.mjs', 'сводки дневника: Claude API → Telegram, cron',
          { flatPath: '~/mcp-server/agents/', hit: 'agent' })}
  </div>
</div>`);

/* =========================================================
   ЭКРАН 4 — шторка действий с файлом
   ========================================================= */
out('Sheet.dc.html', `
<div class="scr">
  ${burger}
  <div class="top">
    ${head()}
    ${field()}
    ${bar('<span class="up">web</span><span class="sep">/</span><b>public</b>',
          '<a>Свернуть всё</a>')}
  </div>
  <div class="list">
    ${row('scripts', 'утилиты и cron')}
    ${row('web', 'веб-панель (3001, за nginx :80)', { open: true })}
    ${row('public', 'все страницы платформы: CRM, финансы, медкарта, кабинеты',
          { level: 1, open: true })}
    ${row('assets', 'иконки и логотипы (icons.svg, logo.svg)', { level: 2 })}
    ${row('index.html', 'главная: дашборд, плашки, карточки инструментов', { level: 2 })}
    ${row('structure.html', 'живое дерево проекта с // комментариями',
          { level: 2, sel: true })}
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
   ПК — тот же аккордеон в десктопной раскладке
   ========================================================= */

/* сайдбар портала: группы свёрнуты, раскрыта та, где активный пункт */
const SB_GROUPS = ['РАБОТА', 'AI-CRM', 'СПРАВОЧНИКИ', 'ФИНАНСЫ', 'ЛИЧНОЕ', 'МЕДКАРТА'];
const SB_INTEGR = [
  ['bot', 'MCP-серверы'], ['webhook', 'Вебхуки'], ['upload', 'Загрузки'],
  ['access', 'Журнал входов'], ['net', 'Структура', true], ['net', 'Бэкапы'],
  ['link', 'Короткие ссылки'], ['skills', 'AI-навыки'], ['search', 'Краулер'],
  ['msg', 'Промты'], ['net', 'Тест'],
];
const sidebar = `
  <div class="sb">
    <div class="sb-logo">
      <span style="color:#00a0ff;">${svg('net')}</span>
      AI-платформа <span class="v">v1.99.0</span><span class="dot"></span>
    </div>
    <div class="sb-ses">Вход: 22.08, 09:14<br>осталось 29д 4ч</div>
    <div class="sb-nav">
      ${SB_GROUPS.map(g => `<div class="sb-grp cl"><span>${g}</span><span class="ar">▾</span></div>`).join('')}
      <div class="sb-grp"><span>ИНТЕГРАЦИИ</span><span class="ar">▾</span></div>
      <div class="sb-items">
        ${SB_INTEGR.map(([ic, label, act]) =>
          `<a class="sb-link${act ? ' act' : ''}">${svg(ic, 'ico')}${label}</a>`).join('')}
      </div>
    </div>
    <div class="sb-foot">
      <div class="sb-set">${svg('gear', 'ico')}Настройка</div>
      <input class="sb-inp" type="text" placeholder="Поиск по порталу…">
      <div class="sb-home">${svg('dash', 'ico')}На главную</div>
    </div>
  </div>`;

/* строка дерева на ПК: имя и подпись в одну строку, действия — по наведению */
function drow(name, comment, { level = 0, open = false, hov = false, leaf = null,
                               pub = false, hi = '', flatPath = '', hit = '' } = {}) {
  const k = kind(name);
  const isDir = leaf === null ? k === 'dir' : !leaf;
  const cls = ['drow', isDir ? '' : 'lf', open ? 'open' : '', hov ? 'hov' : '']
    .filter(Boolean).join(' ');
  const guides = [];
  for (let i = 1; i <= level; i++) {
    guides.push(`<span class="dgd" style="left:${(i - 1) * 20 + 15}px;"></span>`);
  }
  const mark = (s) => hit ? s.split(hit).join(`<span class="hit">${hit}</span>`) : s;
  return `<div class="${cls}" style="padding-left:${8 + level * 20}px;">
      ${guides.join('')}
      ${svg('chev', 'tog')}
      <span class="${k} ic">${svg(isDir ? 'folder' : 'file')}</span>
      ${flatPath ? `<span class="dpth">${mark(flatPath)}</span>` : ''}
      <span class="dnm ${k}">${mark(name)}</span>
      ${comment ? `<span class="dcm">// ${comment}</span>` : ''}
      <span class="dact">
        <span class="${hi === 'copy' ? 'hi' : ''}">${svg('copy')}</span>
        ${pub ? `<span class="${hi === 'pub' ? 'hi' : ''}">${svg('globe')}</span>` : ''}
      </span>
    </div>`;
}

const dhead = `
  <div class="dhead">
    <h1>Структура проекта</h1>
    <span class="back">← AI-платформа <span style="color:#444;">v1.99.0</span></span>
  </div>`;

const dsearch = (value = '') => `
  <div class="dsrch">
    ${svg('search', 'mag')}
    <input type="text" ${value ? `class="on" value="${value}"` : ''}
           placeholder="Фильтр (например: mjs, dnevnik, web)...">
  </div>`;

const dbar = (left, right) => `<div class="dbar"><span>${left}</span><span class="r">${right}</span></div>`;

/* ---- ПК: корень, всё свёрнуто ---- */
out('Desk.dc.html', `
<div class="dsk">
  ${sidebar}
  <div class="dmain">
    ${dhead}
    <div class="dwrap"><div class="dcont">
      ${dsearch()}
      ${dbar('<b>/home/cashruflow</b>', '<a>Развернуть всё</a><a>Свернуть всё</a>')}
      ${drow('add_adr_013.py', 'разовый скрипт: ADR-013')}
      ${drow('add_changelog_v162.py', 'разовый скрипт: CHANGELOG v1.6.2')}
      ${drow('add_token_stats.py', 'разовый скрипт: статистика токенов')}
      ${drow('agents', 'AI-агенты: diary_agent, gpt_diary_agent')}
      ${drow('analytics', 'аналитика (план: diary analytics)')}
      ${drow('apps', 'пустая папка (резерв)')}
      ${drow('backups', 'бэкапы перед правками — дата в имени файла')}
      ${drow('config', 'пустая папка (резерв)')}
      ${drow('data', 'SQLite: tasks.db (бэклог + промты), med.sqlite (медкарта)')}
      ${drow('database', 'пустая папка (резерв)')}
      ${drow('design', 'макеты из Claude Design — переносятся навыком design-transfer')}
      ${drow('docs', 'документация: VERSION, ARCHITECTURE, ADR')}
      ${drow('fix_diary_usage.py', 'разовый фикс: usage дневника')}
      ${drow('fix_telegram_debug.py', 'разовый фикс: debug Telegram-бота')}
      ${drow('gpt', 'GPT-ядро: точка входа, реестр агентов, клиент OpenAI')}
      ${drow('integrations', 'пустая папка (резерв)')}
      ${drow('knowledge', 'пустая папка (резерв)')}
      ${drow('logs', 'логи')}
      ${drow('mcp', 'старый бэкап MCP-ядра')}
      ${drow('mcp-server', 'ядро: MCP API (3000), SSE-коннектор (3002), бот дневника', { hov: true })}
      ${drow('memory', 'состояние: timezone.txt и др.')}
      ${drow('notediscovery', 'дневник и база знаний (8000)')}
      ${drow('patch-backup', 'бэкапы patch.sh — unix-время в имени')}
      ${drow('purge.log', 'лог очистки загрузок')}
      ${drow('reports', 'выгрузки отчётов SEO Auto')}
    </div></div>
  </div>
</div>`);

/* ---- ПК: ветка web → public раскрыта ---- */
out('DeskOpen.dc.html', `
<div class="dsk">
  ${sidebar}
  <div class="dmain">
    ${dhead}
    <div class="dwrap"><div class="dcont">
      ${dsearch()}
      ${dbar('<span class="up">web</span><span class="sep">/</span><b>public</b>',
             '<a>Развернуть всё</a><a>Свернуть всё</a>')}
      ${drow('seo-pipeline', 'старые python-скрипты, .env')}
      ${drow('services', 'пустая папка (резерв)')}
      ${drow('web', 'веб-панель (3001, за nginx :80)', { open: true })}
      ${drow('public', 'все страницы платформы: CRM, финансы, медкарта, кабинеты',
             { level: 1, open: true })}
      ${drow('assets', 'иконки и логотипы (icons.svg, logo.svg)', { level: 2 })}
      ${drow('img', 'картинки: логотипы сервисов', { level: 2 })}
      ${drow('client.html', 'кабинет клиента /:slug — задачи, уведомления, доступы, команда',
             { level: 2, pub: true })}
      ${drow('index.html', 'главная: дашборд, плашки, карточки инструментов',
             { level: 2, pub: true })}
      ${drow('leads.html', 'лиды /crm/leads: канбан 11 статусов, сделки, оплаты',
             { level: 2, pub: true })}
      ${drow('set.html', 'настройки /set: тема, геометрия карточек (--ui-токены)',
             { level: 2, pub: true })}
      ${drow('sidebar.js', 'общий сайдбар навигации всех страниц', { level: 2, pub: true })}
      ${drow('structure.html', 'живое дерево проекта с // комментариями',
             { level: 2, pub: true, hov: true, hi: 'pub' })}
      ${drow('tasks.html', 'бэклог задач: таблица, таймеры, виджет «в работе», спринты',
             { level: 2, pub: true })}
      ${drow('ui.css', 'общая тема портала: CSS-переменные (--ui-brand, --ui-ico)',
             { level: 2, pub: true })}
      ${drow('server.js', 'Express: все API платформы — задачи, CRM, финансы, медкарта',
             { level: 1 })}
      ${drow('tasks.js', 'API бэклога задач (data/tasks.db)', { level: 1 })}
      ${drow('webhooks', 'пустая папка (резерв)')}
    </div></div>
  </div>
</div>`);

/* ---- ПК: поиск ---- */
out('DeskSearch.dc.html', `
<div class="dsk">
  ${sidebar}
  <div class="dmain">
    ${dhead}
    <div class="dwrap"><div class="dcont">
      ${dsearch('agent')}
      ${dbar('Найдено: <b>6</b>', '<a>Сбросить</a>')}
      ${drow('agents', 'AI-агенты: diary_agent, gpt_diary_agent',
             { flatPath: '~/', hit: 'agent' })}
      ${drow('gpt_diary_agent', 'GPT-агент дневника (agent.mjs + README)',
             { flatPath: '~/agents/', hit: 'agent' })}
      ${drow('agent.mjs', '', { flatPath: '~/agents/gpt_diary_agent/', hit: 'agent' })}
      ${drow('README.md', '', { flatPath: '~/agents/gpt_diary_agent/', hit: 'agent', hov: true })}
      ${drow('agents', 'AI-агенты: diary_agent (сводки дневника через Claude → TG)',
             { flatPath: '~/mcp-server/', hit: 'agent' })}
      ${drow('diary_agent.mjs', 'сводки дневника: Claude API → Telegram, cron',
             { flatPath: '~/mcp-server/agents/', hit: 'agent' })}
    </div></div>
  </div>
</div>`);

/* =========================================================
   СПЕЦИФИКАЦИЯ — какой элемент какой токен /set читает
   ========================================================= */
const SPEC = [
  ['Шапка и поля', [
    ['Боковые отступы экрана', '--ui-page-pad-m', '14px'],
    ['Фон, рамка, кегль поля', '--ui-inp-*', 'inpCss()'],
    ['Рамка в фокусе', '--ui-inp-focus', 'var(--ui-brand)'],
    ['Минимальный тач-таргет', '--ui-tap', '44px'],
  ]],
  ['Поверхности и текст', [
    ['Фон страницы', '--ui-bg', '#0a0a0a / #f6f8fb'],
    ['Поверхность шторки', '--ui-surface', '#141414 / #ffffff'],
    ['Подложка подписи', '--ui-surface-3', '#111111 / #f3f6fa'],
    ['Разделители', '--ui-line-2', '#1e1e1e / #e6ecf3'],
    ['Основной текст', '--ui-tx', '#e8e8e8 / #0f1c2e'],
    ['Подпись и мета', '--ui-tx-3', '#6a6a6a / #8595a8'],
  ]],
  ['Список и шторка', [
    ['Скругление блоков', '--ui-card-radius', '12px'],
    ['Скругление верха шторки', '--ui-sheet-radius', '22px'],
    ['Толщина штриха иконок', '--ui-ico-stroke', '2'],
    ['Значок действия — вид целиком', '.ibtn', 'btnCss()'],
    ['Акцент платформы', '--ui-brand', '#00a0ff / #0072c6'],
  ]],
];
const PAL = [
  ['Папка', '--ui-ft-dir', '#6ab0f5', '#1d63a8'],
  ['.js / .mjs', '--ui-ft-code', '#4ade80', '#15803d'],
  ['.html', '--ui-ft-page', '#fb923c', '#b45309'],
  ['.md', '--ui-ft-doc', '#c084fc', '#7e22ce'],
  ['Прочие файлы', '--ui-tx-2', '#8b8b8b', '#5a6b80'],
];

out('Tokens.dc.html', `
<div style="width:760px;min-height:1000px;background:#0f0f0f;padding:34px 36px 40px;
            display:flex;flex-direction:column;gap:26px;">
  <div style="display:flex;flex-direction:column;gap:7px;">
    <div style="font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:#555;">
      /structure — телефон и ПК</div>
    <div style="font-size:23px;font-weight:600;letter-spacing:-.01em;">Что берём из /set</div>
    <div style="font-size:13px;line-height:1.5;color:#777;max-width:56ch;">
      Ни одного литерала в новой вёрстке: геометрия и цвета читаются переменными из
      <span style="font-family:var(--mono);color:#6ab0f5;">/theme.css</span>, который отдаёт
      <span style="font-family:var(--mono);color:#6ab0f5;">server.js → themeVars()</span>.
      Второй столбец — тёмное значение, третий светлое: после ADR-142 у платформы две темы,
      и зашитый литерал остаётся тёмной заплатой в светлой.
    </div>
  </div>

  ${SPEC.map(([title, rows]) => `
  <div style="display:flex;flex-direction:column;gap:0;">
    <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#555;
                padding-bottom:9px;">${title}</div>
    ${rows.map(([what, token, val]) => `
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 190px 170px;gap:16px;
                align-items:center;padding:10px 0;border-top:1px solid #1a1a1a;">
      <span style="font-size:13.5px;color:#d8d8d8;">${what}</span>
      <span style="font-family:var(--mono);font-size:12.5px;color:#00a0ff;">${token}</span>
      <span style="font-family:var(--mono);font-size:12.5px;color:#7a7a7a;">${val}</span>
    </div>`).join('')}
  </div>`).join('')}

  <div style="display:flex;flex-direction:column;gap:0;">
    <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#555;
                padding-bottom:9px;">Цвета типов файлов — новые токены, заведены этой правкой</div>
    ${PAL.map(([what, token, dark, light]) => `
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 190px 85px 85px;gap:16px;
                align-items:center;padding:10px 0;border-top:1px solid #1a1a1a;">
      <span style="display:flex;align-items:center;gap:10px;font-size:13.5px;color:#d8d8d8;">
        <span style="width:13px;height:13px;border-radius:3px;background:${dark};"></span>${what}</span>
      <span style="font-family:var(--mono);font-size:12.5px;color:#00a0ff;">${token}</span>
      <span style="font-family:var(--mono);font-size:12.5px;color:${dark};">${dark}</span>
      <span style="font-family:var(--mono);font-size:12.5px;color:#7a7a7a;">${light}</span>
    </div>`).join('')}
  </div>

  <div style="margin-top:4px;padding:14px 16px;background:#101010;border:1px solid #1e1e1e;
              border-radius:var(--ui-card-radius,12px);display:flex;flex-direction:column;gap:9px;">
    <div style="font-size:12.5px;font-weight:600;color:#e8e8e8;">Две поправки к первой версии макета</div>
    <div style="font-size:12.5px;line-height:1.5;color:#8a8a8a;">
      <b style="color:#4ade80;font-weight:600;">Кегль поля на мобиле уже решён.</b>
      Анти-зум iOS сидит в <span style="font-family:var(--mono);">inpCss()</span> последней
      строкой — <span style="font-family:var(--mono);">font-size:16px !important</span> внутри
      <span style="font-family:var(--mono);">max-width:768px</span> (ADR-081/082). Своего кегля
      поле на странице не задаёт вообще.
    </div>
    <div style="font-size:12.5px;line-height:1.5;color:#8a8a8a;">
      <b style="color:#4ade80;font-weight:600;">Токен высоты строки тоже есть.</b>
      <span style="font-family:var(--mono);">--ui-tap</span> (44px) в
      <span style="font-family:var(--mono);">ui.css</span> — минимальный тач-таргет платформы.
      Строка на телефоне взяла его как <span style="font-family:var(--mono);">min-height</span>,
      на ПК тач-таргет не нужен и строка остаётся плотной.
    </div>
  </div>
</div>`);
