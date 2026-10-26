# Реальные строки боевых файлов (read_file, 26.10.2026) на своих номерах — из них make_excerpts.py
# собирает orig/ (выше и между блоками — пустые строки-заглушки, только чтобы собрать и проверить дифф).
SRC = {}

SRC['web/server.js'] = {
1: 'import { execFile } from "child_process";',
2: 'import { readQueue as wcReadQueue, saveQueue as wcSaveQueue } from "./work_channels.js"; // #458: очередь рабочих каналов лида переносится в копию',
3: "import { mountMedShare, mountMedSharePages } from './medshare.js'; // #166 этап 4: пациент делится разделами медкарты с врачом",
4: "import { ensureSexTerms, syncSexActivity, sexTermsList, sexTermsUsage, sexTermsOp, sexKartReady } from './sex_terms.js'; // ADR-290 §4: позы/места/игрушки «Секса» в Картотеке",
5: "import { mountTaskDeps, depsMap as taskDepsMap, isDepClosed } from './task_deps.js'; // #139: зависимости задач /api/task-deps (диаграмма Ганта)",
6: "import { mountMeProfile } from './me_profile.js'; // расширенный профиль для «Пара App» (#381 этап 1): /api/me/profile-ext, /sex-profile, /pair-profile, /car-profile",
7: "import { inputValue } from './page_texts.js'; // очистка formname из скрытого поля (#330)",
8: "import dotenv from 'dotenv';",
238: '// Поправил спрайт (новый символ) — подними ICONS_V здесь, и всё. Фолбэк-строку в JS',
239: '// поднимать не обязательно: он срабатывает только на странице без <head>. Версионный',
240: '// адрес получает Cache-Control 7 дней (setHeaders у express.static ниже) — одна загрузка,',
241: '// дальше из кэша браузера. Правило — docs/rules/ui.md, «Адрес спрайта».',
242: 'const ICONS_V = 30; // 29 — i-gantt для модуля «Диаграмма Ганта» кабинета (#139, шаг 4); 28 — i-code для кнопки «исходник» в редакторе kb.html (27 занят ?v=27 в mail-box.js/mail.html); 26 — i-undo-2/i-timer/i-rotate-ccw для мобильной /tasks (макет B); 25 — i-newspaper для пункта «Блог» (#452, 06.10.2026); 24 — i-list/i-layout-grid для переключателя вида «Мои разделы» (#403, 04.10.2026); 23 — убран дубль i-panel-bottom (остался Lucide, #33, 04.10.2026); 22 — i-pin-tack для закрепления плитки в cab-sidebar.js (#403, 04.10.2026); 21 — i-test-tube/i-list-checks/i-clipboard-list/i-panel-bottom для нижнего меню (#33, 03.10.2026); 20 (выше своих ?v=15..19 в medcard_food/balance_core/toast.js/balance.html, чтобы не попасть в чужой кэш) — i-hand-heart/i-lightbulb для «Нашей связи» в «Паре» (#381, 03.10.2026); 14 — i-sim/i-esim для вкладки «eSIM» (ADR-233, 03.10.2026); 13 — i-copy-plus (ADR-236, 02.10.2026); 12 — i-star/i-pushpin для «Моих продуктов» (ADR-286, 01.10.2026); 11 — i-flag/i-mail-open для «Почты» (ADR-283, 01.10.2026); 10 — i-utensils/i-scan-barcode/i-flashlight для «Питания» (29.09.2026)',
243: 'const ICONS_URL = "/assets/icons.svg?v=" + ICONS_V;',
244: 'const ICONS_TAG = \'<script>window.ICONS_URL="\' + ICONS_URL + \'"</script>\';',
245: "const ICONS_RE = /\\/assets\\/icons\\.svg(?:\\?v=[\\w.-]*)?(?=[#\"'`)])/g;",
556: '    return { online: false, ms: Date.now() - t0, error: e.code || e.message };',
557: '  }',
558: '}',
559: 'app.get("/mcp", (req, res) => res.sendFile("/home/cashruflow/web/public/mcp.html"));',
560: '// Раньше /stats был проксёй nginx прямо на GoatCounter, минуя Node — теперь роут',
561: '// на платформе: вкладка «Посещения» встраивает GoatCounter в iframe (src="/gc/",',
562: '// путь должен указывать на GoatCounter в nginx), вкладка «Тепловая карта» — наша.',
563: 'app.get("/stats", (req, res) => res.sendFile("/home/cashruflow/web/public/stats.html"));',
564: 'app.get("/api/mcp", async (req, res) => {',
565: '  if (!pauth(req, res)) return;',
566: '  const reg = mcpRegRead();',
567: '  const servers = await Promise.all(reg.servers.map(async s => ({ ...s, status: (s.check && s.check_type !== "none") ? await mcpCheck(s) : null })));',
}

SRC['web/roles.js'] = {
40: 'export const SECTIONS = [',
41: '  // РАБОТА',
42: '  { key: "notify", group: "Работа", label: "Уведомления", href: "/notify" },',
43: '  { key: "timing", group: "Работа", label: "Тайминг", href: "/timing/app", pages: ["/timing"] },',
44: '  { key: "tasks", group: "Работа", label: "Бэклог", href: "/tasks" },',
45: '  { key: "issues", group: "Работа", label: "Ошибки", href: "/issues" },',
46: '  { key: "ticket", group: "Работа", label: "Тикеты", href: "/ticket" },',
47: '  { key: "projects", group: "Работа", label: "Проекты", href: "/projects" },',
48: '  { key: "clients", group: "Работа", label: "Клиенты", href: "/clients" },',
49: '  { key: "access", group: "Работа", label: "Доступы и ключи", href: "/access",',
452: '    ["manager", "/api/tenant/demo/statuses/items", "POST", true, false], ["manager", "/api/tenant/demo/statuses/order", "POST", true, false],',
453: '    ["manager", "/api/tenant/demo/statuses/path", "POST", true, false], ["manager", "/api/tenant/demo/statuses/path", "GET", true, false],',
454: '    ["manager", "/api/dict-path/lead_stage", "POST", true, true],',
455: '    ["manager", "/api/tenant/demo/leads/5", "PUT", true, false],',
456: '    ["manager", "/api/tenant/demo/crm-leads/5", "PUT", true, true, { body: { kanban_status: "paid", stage_force: 1 } }],',
457: '  ];',
458: '  const saved = permCache; permCache = new Map(); permAt = Date.now(); // пустые галочки = умолчания',
459: '  const bad = [];',
}

SRC['web/public/sidebar.js'] = {
246: "      // Ошибки платформы (13.09.2026) — своя сущность, не задачи: баги страниц и",
247: "      // кода плюс заявки клиентов. Рядом с бэклогом, потому что разбираются вместе.",
248: "      { href: '/issues', icon: 'bug', label: 'Ошибки' },",
249: "      // Тикеты (ADR-136, задача #341) — клиентские запросы, не задачи: в бэклог и в",
250: "      // квоты недели не попадают, закрытие стоит нормативные 15 минут.",
251: "      { href: '/ticket', icon: 'ticket', label: 'Тикеты' },",
252: "      { href: '/projects', icon: 'projects', label: 'Проекты' },",
253: "      { href: '/clients', icon: 'clients', label: 'Клиенты' },",
254: "      { href: '/access', icon: 'access', label: 'Доступы' },",
}

SRC['web/threads.js'] = {
307: '  }',
308: '  // Не блокирует: отдаёт кэш (может быть null или устаревшим) и при необходимости запускает проверку в фоне.',
309: '  function liveGet() {',
310: '    if (!(liveCache && Date.now() - liveCache.at < LIVE_TTL)) liveRefresh().catch(() => {});',
311: '    return liveCache;',
312: '  }',
313: '  app.locals.threads = { live: liveGet };',
314: '',
315: '  // ---------- статус ----------',
316: "  app.get('/api/threads/status', async (req, res) => {",
}

SRC['web/crm_chats.js'] = {
2579: '    return l ? [l.last_name, l.name].map(s => String(s || "").trim()).filter(Boolean).join(" ") : "";',
2580: '  }',
2581: '  function chatDisplayName(chat, leadRow) {',
2582: '    if (chat.name_src === "manual" && String(chat.custom_name || "").trim()) return String(chat.custom_name).trim();',
2583: '    if (chat.name_src === "lead" && leadShortName(leadRow)) return leadShortName(leadRow);',
2584: '    return chat.client_name || "";',
2585: '  }',
2586: '',
2587: '  // Своё имя чата / сброс на имя лида. {name:"…"} — ручное (пустое = вернуть имя из Телеграма),',
2588: '  // {from_lead:true} — имя из лида, дальше следует за ним.',
}

SRC['web/public/habits-sw.js'] = {
30: 'const SHELL = [',
31: "  '/habits/app',",
32: "  '/habits/auth',",
33: "  '/habits',",
34: '  // Спрайт — тем же адресом, что просят страницы (ICONS_V в server.js, 27.09.2026): иначе',
35: '  // установка качала бы отдельную копию без версии. Поднял ICONS_V — подними и здесь.',
36: "  '/assets/icons.svg?v=30',",
37: "  '/assets/logo.svg',",
38: "  '/habits.webmanifest',",
39: "  '/toast.js',",
}

SRC['web/public/assets/icons.svg'] = {
220: '<symbol id="i-rotate-ccw" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></symbol>',
221: '<symbol id="i-clipboard-list" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></symbol>',
222: '<symbol id="i-panel-bottom" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 15h18"/></symbol>',
223: '<symbol id="i-newspaper" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="10" y="6" rx="1"/></symbol>',
224: '</svg>',
}
# у icons.svg на сервере (на 03.10.2026) не было перевода строки в конце — оставляем так же
NO_EOL = {'web/public/assets/icons.svg'}
