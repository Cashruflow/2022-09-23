/* Единое окно входа для всех админ-страниц (см. /auth-gate.js).
   Подключается отсюда, чтобы не дублировать <script> в 35 HTML-файлах. */

// 17.09.2026 — «сайдбар скачет». sb-resize.js (ширина/колонка иконок) и page-header.js
// (сборка шапки) раньше вставлялись асинхронно и отрабатывали ПОСЛЕ первой отрисовки:
// сайдбар рисовался 230px и схлопывался в 64px, шапка перестраивалась на глазах.
// Если sidebar.js подключён обычным <script> (парсер ещё идёт), грузим эти два файла
// синхронно через document.write — они выполнятся сразу за этим файлом, до отрисовки.
// Если sidebar.js вставлен скриптом (async), остаётся прежний путь через appendChild.
var __sbSync = (function () {
  try {
    var cs = document.currentScript;
    return document.readyState === 'loading' && !!cs && !cs.async && !cs.defer;
  } catch (e) { return false; }
})();
function __sbLoad(id, src) {
  if (document.getElementById(id)) return;
  if (__sbSync) { document.write('<script id="' + id + '" src="' + src + '"><\/script>'); return; }
  var s = document.createElement('script');
  s.id = id; s.src = src;
  document.head.appendChild(s);
}
(function () {
  if (!document.getElementById('cf-auth-gate-src')) {
    const g = document.createElement('script');
    g.id = 'cf-auth-gate-src';
    g.src = '/auth-gate.js?v=6'; // v6 (30.09.2026) — тень окна токеном --ui-shadow-lg; v5 (29.09.2026, поздний вечер) — внутри toast.js?v=4; v4 (29.09.2026) — внутри toast.js?v=3; v2 (11.09.2026) — шаг с кодом 2FA; v3 (16.09.2026) — тост обрыва после перепроверки 3 с
    document.head.appendChild(g);
  }
})();

// Зонд производительности (/perf-probe.js) — на ЛЮБОЙ странице портала по флагу ?perf=1.
// Подключается отсюда по той же причине, что гейт входа и tbl-freeze: одна точка вместо
// правки 35 файлов. Без флага сам скрипт выходит первой строкой, так что цена нулевая.
// На /crm/leads он дополнительно подключён из <head> — там нужно успеть подменить fetch
// до первых запросов страницы; повторное подключение зонд отсекает сам.
(function () {
  if (!/[?&]perf=1/.test(location.search)) return;
  if (!document.getElementById('cf-perf-probe-src')) {
    const p = document.createElement('script');
    p.id = 'cf-perf-probe-src';
    p.src = '/perf-probe.js';
    document.head.appendChild(p);
  }
})();

// Переключатель темы (/theme-toggle.js) — кнопка «Тема» в подвале сайдбара (ADR-142).
// Подключается отсюда по той же причине, что гейт входа ниже: одна строка вместо правки
// 35 HTML-файлов. Саму тему выбирает /theme.css — здесь только ручное переключение.
(function () {
  // Проверяем ПО АДРЕСУ, а не по id: страница может подключить тот же файл обычным тегом
  // (так делает trip.html), и охранник по id его не видел — сайдбар догружал вторую копию
  // другим адресом. Для браузера это другой файл: он приезжал позже и перезаписывал
  // cfSetTheme/cfToggleTheme версией постарше, да ещё на неделю оседал в кэше.
  // Остальные пять загрузчиков ниже по файлу уже сверяются префиксом — этот отстал.
  if (!document.querySelector('script[src^="/theme-toggle.js"]')) {
    const th = document.createElement('script');
    th.id = 'cf-theme-toggle-src';
    th.src = '/theme-toggle.js?v=5';
    document.head.appendChild(th);
  }
})();

// «Копия для ИИ» (/page-copy.js) — плитка в подвале сайдбара. Подключается ПЕРВОЙ из
// модулей: файл сразу вешает сборщики ошибок и обёртку над fetch, и чем раньше он
// приедет, тем больше запросов страницы попадёт в копию.
(function () {
  if (!document.getElementById('cf-page-copy-src')) {
    const pc = document.createElement('script');
    pc.id = 'cf-page-copy-src';
    pc.src = '/page-copy.js?v=4'; // v4 (29.09.2026, поздний вечер) — внутри toast.js?v=4; v3 (29.09.2026) — внутри toast.js?v=3 (тосты над доком)
    document.head.appendChild(pc);
  }
})();

// «Скрин» (/shot.js) — иконка в правом верхнем углу на ПК, на всех страницах портала
// (17.09.2026). Поверх модалок тоже. В кабинетах клиента её роль играет /pm-view.js.
(function () {
  if (!document.getElementById('cf-shot-src') && !window.__pltShot) {
    const sh = document.createElement('script');
    sh.id = 'cf-shot-src';
    sh.src = '/shot.js?v=7';
    document.head.appendChild(sh);
  }
})();

// Закрепление строк меню (/menu-pins.js) — блок «Быстрый доступ» над разделами.
// Подключается отсюда по той же причине, что гейт входа: одна строка вместо правки
// 35 HTML-файлов. Тот же файл грузит cab-sidebar.js — модуль ОДИН на портал и кабинет.
(function () {
  if (!document.getElementById('cf-menu-pins-src')) {
    const mp = document.createElement('script');
    mp.id = 'cf-menu-pins-src';
    mp.src = '/menu-pins.js?v=6';
    document.head.appendChild(mp);
  }
})();

// Строка профиля в подвале и меню за ⋮ (/sb-profile.js, 19.09.2026). Подключается
// отсюда по той же причине, что гейт входа: одна строка вместо правки 35 HTML-файлов.
// Тот же файл потом подключит cab-sidebar.js — модуль ОДИН на портал и кабинет.
(function () {
  if (!document.getElementById('cf-sb-profile-src')) {
    const sp = document.createElement('script');
    sp.id = 'cf-sb-profile-src';
    sp.src = '/sb-profile.js?v=5'; // v5 (02.10.2026): «Быстрые клавиши»; v3 (29.09.2026): тень меню — токен --ui-shadow-md
    document.head.appendChild(sp);
  }
})();

// Масштаб интерфейса (/ui-scale.js) — кнопки «А− / А+» в меню профиля.
// Подключается отсюда по той же причине, что и гейт входа: одна строка вместо
// правки 35 HTML-файлов.
(function () {
  // синхронно — zoom должен встать до первой отрисовки (17.09.2026)
  __sbLoad('cf-ui-scale-src', '/ui-scale.js');
})();

// Закреплённые слева колонки таблиц (/tbl-freeze.js). Подключается отсюда по той
// же причине, что гейт входа и масштаб: одна точка вместо правки 35 HTML-файлов.
// Страница помечает таблицу только атрибутом data-frz="N".
(function () {
  if (!document.getElementById('cf-tbl-freeze-src')) {
    const f = document.createElement('script');
    f.id = 'cf-tbl-freeze-src';
    f.src = '/tbl-freeze.js?v=3';
    document.head.appendChild(f);
  }
})();

// Ручное изменение ширины колонок таблиц (/tbl-resize.js). Тот же приём, что
// у tbl-freeze.js выше: одна точка подключения, страница помечает таблицу
// только атрибутом data-rsz="ключ".
(function () {
  if (!document.getElementById('cf-tbl-resize-src')) {
    const r = document.createElement('script');
    r.id = 'cf-tbl-resize-src';
    r.src = '/tbl-resize.js';
    document.head.appendChild(r);
  }
})();

// Тянущаяся граница сайдбара (/sb-resize.js, 09.09.2026) — ширина мышью + схлопывание
// в колонку иконок. Та же одна точка подключения, что у tbl-freeze и scroll-keep.
// На мобиле скрипт молчит: там сайдбар — нижняя шторка, тянуть нечего.
(function () {
  __sbLoad('cf-sb-resize-src', '/sb-resize.js?v=4');
})();

// Возврат на прежнее место при «Назад» (/scroll-keep.js, 09.09.2026). Тот же приём,
// что у tbl-freeze и page-header: одна точка подключения вместо правки 35 файлов.
// Срабатывает только на back/forward, обычное открытие страницы не трогает.
(function () {
  if (!document.getElementById('cf-scroll-keep-src')) {
    const sk = document.createElement('script');
    sk.id = 'cf-scroll-keep-src';
    sk.src = '/scroll-keep.js?v=2';
    document.head.appendChild(sk);
  }
})();

// PWA: манифест + иконка для iOS + регистрация service worker.
// Подключается отсюда по той же причине — одна точка вместо правки всех HTML.
(function () {
  // 28.09.2026 (ADR-240): вместо общего /platform-manifest.json (start_url "/app" — иконка
  // с любой страницы открывала главную) — манифест под текущую страницу из /pwa-manifest.js.
  // Страницу со своим манифестом (дневник) не трогаем.
  if (!document.querySelector('link[rel="manifest"]') && !window.cfPwaManifest) {
    const m = document.createElement('script');
    m.src = '/pwa-manifest.js?v=1';
    document.head.appendChild(m);
  }
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const a = document.createElement('link');
    a.rel = 'apple-touch-icon';
    a.href = '/assets/logo.svg';
    document.head.appendChild(a);
  }
  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    const c = document.createElement('meta');
    c.name = 'apple-mobile-web-app-capable';
    c.content = 'yes';
    document.head.appendChild(c);
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();

(function () {
  // ?embed=1 — страница открыта в iframe (карточка задачи внутри лида и т.п.): нав-сайдбар
  // портала (#app-sidebar, position:fixed, z-index:500) перекрывает собственный плавающий
  // сайдбар модалки задачи (z-index:5, ADR о вложенных модалках) — в узком встроенном окне
  // кнопки «сохранить/закрыть» оказываются под ним и недоступны. Молча не строим нав вообще.
  if (new URLSearchParams(location.search).get('embed') === '1') return;
  const MENU = [
    { group: 'РАБОТА', items: [
      { href: '/notify', icon: 'notify', label: 'Уведомления' },
      // Тайминг (17.09.2026) — сводка/сетка встреч и задач; вкладки /timing/week и
      // /timing/slots живут внутри раздела, отдельных пунктов в меню у них нет.
      { href: '/timing/app', icon: 'calendar', label: 'Тайминг' },
      { href: '/tasks', icon: 'tasks', label: 'Бэклог' },
      // Ошибки платформы (13.09.2026) — своя сущность, не задачи: баги страниц и
      // кода плюс заявки клиентов. Рядом с бэклогом, потому что разбираются вместе.
      { href: '/issues', icon: 'bug', label: 'Ошибки' },
      // Тикеты (ADR-136, задача #341) — клиентские запросы, не задачи: в бэклог и в
      // квоты недели не попадают, закрытие стоит нормативные 15 минут.
      { href: '/ticket', icon: 'ticket', label: 'Тикеты' },
      { href: '/projects', icon: 'projects', label: 'Проекты' },
      { href: '/clients', icon: 'clients', label: 'Клиенты' },
      { href: '/access', icon: 'access', label: 'Доступы' },
      { href: '/kb', icon: 'kb', label: 'БЗ' },
      // RAG-база (15.09.2026) — пары «вопрос — ответ», из которых отвечает ИИ-агент
      // в «Чатах». Рядом с БЗ, но это НЕ база знаний: там статьи, здесь готовые ответы.
      { href: '/rag/app', icon: 'brain', label: 'RAG' },
      { href: '/brief', icon: 'clipboard-list', label: 'Бриф' },
    ]},
    { group: 'AI-CRM', items: [
      // Обзор раздела — первым пунктом. Подсветка активного идёт по ТОЧНОМУ совпадению
      // пути, поэтому /crm не загорается на /crm/leads и остальных вложенных.
      { href: '/crm', icon: 'layout-dashboard', label: 'CRM — обзор' },
      { href: '/contacts', icon: 'contact', label: 'Люди' },
      { href: '/company', icon: 'building', label: 'Компании' },
      { href: '/crm/leads', icon: 'leads', label: 'Лиды' },
      { href: '/crm/soric', icon: 'zap', label: 'SORIC' },
      { href: '/crm/docs', icon: 'file-stack', label: 'Документы' },
      { href: '/crm/chats', icon: 'message', label: 'Чаты' },
      // Почта (29.09.2026, mailer.js): SMTP-ящики и журнал писем; раздел прав — mail в roles.js.
      { href: '/mail', icon: 'mail', label: 'Почта' },
      // Трекинг (tracking.js, ADR-264): колл-/имейлтрекинг, пул адресов; раздел прав — tracking в roles.js.
      { href: '/tracking/app', icon: 'phone-call', label: 'Трекинг' },
      { href: '/channels', icon: 'radio-tower', label: 'Каналы' },
      { href: '/staff', icon: 'id-card', label: 'Сотрудники' },
      // Роли и права (ADR-263): какие разделы видит роль. Только владельцу — остальным
      // пункт прячет фильтр ниже (/api/me/perms), а сервер отдаёт 403.
      { href: '/roles', icon: 'shield-check', label: 'Роли и права' },
      { href: '/projects/crm', icon: 'circle-pile', label: 'CRM клиентов' },
      { href: '/crm/services', icon: 'services', label: 'Услуги' },
      { href: '/history', icon: 'history', label: 'История правок' },
      // Загрузчик данных (29.09.2026): CSV/XLSX → лиды, люди, компании; журнал и откат импорта.
      { href: '/import', icon: 'import', label: 'Загрузчик данных' },
    ]},
    // Своя группа: до этого SEO-страницы были размазаны по «РАБОТЕ» (/sites, /jsonld)
    // и «ИНТЕГРАЦИЯМ» (/crawl, /skills). Пункты ПЕРЕНЕСЕНЫ, а не продублированы —
    // дублей страниц в меню быть не должно. /scripts остался в интеграциях: он про
    // сниппеты аналитики и баннер кук, а не про поиск. Сюда же приедет /ai-tracker
    // (видимость бренда в ответах AI), когда будет сделан.
    { group: 'SEO', items: [
      // Главная SEO-раздела (16.09.2026): сводка техаудита Топвизора + входы в сервисы.
      // #433: хаб «Сайт» — вкладки Сводка/Краулер/Индексация/PageSpeed/…; пункты ниже ведут в тот же хаб (редирект site_embed.js).
      { href: '/seo/app', icon: 'app-window', label: 'SEO' },
      { href: '/sites', icon: 'sites', label: 'Сайты' },
      { href: '/crawl', icon: 'scan-search', label: 'Краулер' },
      // Скорость страниц клиентских сайтов (задача #365). Рядом с краулером:
      // обе страницы про обход сайта целиком, а не про разметку одной страницы.
      { href: '/pagespeed', icon: 'gauge', label: 'AI Google PageSpeed' },
      // Индексация (15.09.2026): статус страниц в Яндексе/Google/Bing из Топвизора,
      // причины из Search Console, отправка на переобход. Здесь же галочки состава
      // карты сайта — поэтому пункт стоит прямо над «Картой сайта».
      { href: '/index/app', icon: 'file-search', label: 'Индексация' },
      // Ключевые слова и позиции (#388): семантика по группам, частота, позиции из Топвизора.
      { href: '/keywords/app', icon: 'search', label: 'Ключевые слова' },
      // Я.Директ (23.09.2026): кампании, статистика и ключи рекламы по проектам.
      { href: '/yadirect', icon: 'megaphone', label: 'Я.Директ' },
      // Сжатие картинок через Tinify. Рядом с PageSpeed осознанно: вес картинок — первая
      // причина низкой оценки скорости, чинится ровно здесь.
      { href: '/img', icon: 'image-down', label: 'Сжатие картинок' },
      { href: '/jsonld', icon: 'braces', label: 'JSON-LD' },
      { href: '/skills', icon: 'skills', label: 'AI-навыки' },
      // 23.09.2026: пункт ведёт на вкладку «Карта сайта» страницы «Индексация» — там
      // галочки и ссылка на сам /sitemap.xml. Голый xml из меню смотреть было неудобно.
      { href: '/index/app#sitemap', icon: 'network', label: 'Карта сайта' },
      // 28.09.2026 (ADR-241): бейджи страниц — фавикон и иконка «На экран Домой» по пути.
      { href: '/index/app#icons', icon: 'image', label: 'Иконки страниц' },
      // 01.10.2026: SEO каждой страницы (title, description, Open Graph, H1, alt) — окно
      // «Настройки страницы»; право — раздел «Индексация» (roles.js, menu).
      { href: '/pages', icon: 'file-cog', label: 'Страницы' },
      { href: '/emotion-journal', icon: 'smile', label: 'Дневник эмоций' },
    ]},
    { group: 'СПРАВОЧНИКИ', items: [
      { href: '/refs', icon: 'library', label: 'Справочники' },
      { href: '/crm/fields', icon: 'fields', label: 'Поля CRM' },
      { href: '/b24/fields', icon: 'table-properties', label: 'Поля Б24' },
    ]},
    { group: 'ФИНАНСЫ', items: [
      { href: '/cash', icon: 'cash', label: 'Финансы' },
      { href: '/money/app', icon: 'coins', label: 'Деньги' },
      { href: '/renew', icon: 'calendar-sync', label: 'Продления' },
      // Расходы Roistat по проектам (web/rs_expenses.js): выбор проекта + общая
      // история тарифов. Кабинетная половина — /<slug>/rs, ключ `rs` в cab-modules.js.
      // Здесь, а не в «Интеграциях»: раздел про деньги проекта, а не про подключение сервиса.
      { href: '/rs', icon: 'chart', label: 'Roistat' },
      // «Генерации» = журнал расходов на платные обращения к ИИ (задача #240), документы — на /crm/docs
      { href: '/doclog', icon: 'receipt', label: 'Генерации (ИИ)' },
    ]},
    { group: 'ЛИЧНОЕ', items: [
      { href: '/diary', icon: 'diary', label: 'Дневник' },
      { href: '/habits/app', icon: 'check-check', label: 'Ai-трекер привычек' },
      // «Путешествия» (14.09.2026) — границы, отели, счётчик резидентства. Раздел на
      // /trip/app; /trip оставлен под будущий лендинг, как у привычек.
      { href: '/trip/app', icon: 'globe', label: 'Путешествия' },
      { href: '/kpi', icon: 'podium', label: 'KPI' },
      { href: '/agents', icon: 'bot', label: 'Ai-агенты' },
      // «Картотека» (ADR-279) — личные справочники: меры продуктов и свои списки
      { href: '/cards', icon: 'archive', label: 'Картотека' },
    ]},
    { group: 'МЕДКАРТА', items: [
        { href: '/medcard', icon: 'medcard', label: 'Медкарта' },
      // страница «Активность» (вынос из вкладки «Цикл», v1.84.0, ADR-108)
      { href: '/medcard/sex', icon: 'heart', label: 'Активность' },
      { href: '/med', icon: 'test-tubes', label: 'Нормы анализов' },
      { href: '/missions', icon: 'flag', label: 'Миссии' },
      { href: '/patients', icon: 'stethoscope', label: 'Пациенты' },
      { href: '/control', icon: 'clipboard-check', label: 'Контроль' },
    ]},
    { group: 'ИНТЕГРАЦИИ', items: [
      { href: '/integrations', icon: 'plug', label: 'Интеграции' },
      { href: '/threads', icon: 'at-sign', label: 'Тредс' },
      { href: '/mcp', icon: 'server', label: 'MCP-серверы' },
      { href: '/stats', icon: 'tracking', label: 'Статистика' },
      { href: '/webhooks', icon: 'webhooks', label: 'Вебхуки' },
      { href: '/uploads', icon: 'upload', label: 'Загрузки' },
      { href: '/auth-log', icon: 'log-in', label: 'История входов' },
      { href: '/structure', icon: 'structure', label: 'Структура' },
      { href: '/backups', icon: 'database-backup', label: 'Бэкапы' },
      { href: '/short', icon: 'link', label: 'Короткие ссылки' },
      // Сниппеты аналитики по страницам (ADR-141) и публичная политика, на которую ссылается
      // баннер кук — обе про внешние скрипты и данные, поэтому здесь, а не в «Справочниках».
      { href: '/scripts', icon: 'code-xml', label: 'Скрипты сайта' },
      { href: '/footer', icon: 'panel-bottom', label: 'Подвал лендингов' },
      { href: '/policy', icon: 'scroll-text', label: 'Политика данных' },
      { href: '/prompt', icon: 'terminal', label: 'Промты' },
      { href: '/test', icon: 'flask-conical', label: 'Тест' },
    ]},
  ];

  // ПРАВА РОЛИ (ADR-263). Защита — на сервере (roles.js, 403), здесь только меню: пункты
  // закрытых разделов не показываем. Список закрытых адресов — /api/me/perms; до ответа
  // берём прошлый из sessionStorage (иначе закрытые пункты мигали бы на каждом переходе).
  // Прячем CSS-правилом по href, а не удалением из MENU: так же скрываются и пункты,
  // которые позже дорисуют «Быстрый доступ» (menu-pins.js) и поиск по порталу.
  // Любая ошибка чтения — пустой список: владельцу меню не урезаем никогда.
  function sbPermDenyCss(list) {
    let st = document.getElementById('sb-perm-css');
    if (!st) { st = document.createElement('style'); st.id = 'sb-perm-css'; document.head.appendChild(st); }
    st.textContent = (list || []).map(function (h) {
      const q = String(h).replace(/["\\]/g, '');
      return '#app-sidebar a[href="' + q + '"],#app-sidebar a[href^="' + q + '#"],#app-sidebar a[href^="' + q + '?"]';
    }).join(',') + ((list && list.length) ? '{display:none !important}' : '');
    window.CF_PERM_DENY = new Set(list || []);
  }
  function sbPermGroups() {
    // группа, где не осталось видимых пунктов, прячется вместе с заголовком
    document.querySelectorAll('#app-sidebar .sb-items').forEach(function (box) {
      const vis = [].some.call(box.querySelectorAll('a.sb-link'), function (a) { return getComputedStyle(a).display !== 'none'; });
      // style, а не hidden: у .sb-group свой display:flex, он сильнее атрибута
      box.style.display = vis ? '' : 'none';
      const head = box.previousElementSibling;
      if (head && head.classList.contains('sb-group')) head.style.display = vis ? '' : 'none';
    });
  }
  try { sbPermDenyCss(JSON.parse(sessionStorage.getItem('cf-perm-deny') || '[]')); } catch (e) { sbPermDenyCss([]); }
  // CF_PERMS_READY — промис прав; бейджи ниже ждут его, чтобы не стучаться в закрытые
  // ролью ручки (/api/agents, /api/med/review…) и не сыпать 403 в консоль.
  window.CF_PERMS_READY = fetch('/api/me/perms', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d) return null;
    const list = Array.isArray(d.deny_hrefs) ? d.deny_hrefs : [];
    try { sessionStorage.setItem('cf-perm-deny', JSON.stringify(list)); } catch (e) {}
    window.CF_PERMS = d;
    sbPermDenyCss(list);
    sbPermGroups();
    return d;
  }).catch(function () { return null; });
  // Открыт ли раздел текущей роли. Прав ещё нет (сеть) — считаем открытым, как до ролей.
  window.cfCan = function (key) {
    const p = window.CF_PERMS;
    return !p || p.owner || !p.sections || p.sections[key] !== false;
  };
  document.addEventListener('DOMContentLoaded', sbPermGroups);

  const path = location.pathname.replace(/\/$/, '') || '/';

  // Подсказка сочетания поиска в поле (02.10.2026): на Mac — ⌘K, иначе Ctrl K.
  // Платформу берём из userAgentData, где он есть, иначе из navigator.platform/UA.
  const SB_MAC = (function () {
    try {
      const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
      return /mac|iphone|ipad|ipod/i.test(p);
    } catch (e) { return false; }
  })();
  const SB_KEY_HINT = SB_MAC ? '⌘K' : 'Ctrl K';
  const SB_KEY_ARIA = SB_MAC ? 'Meta+K' : 'Control+K';
  window.cfIsMac = SB_MAC;

  const css = `

    /* Цвета сайдбара — токенами платформы (/theme.css, ADR-142): он виден на КАЖДОЙ странице,
       и в светлой теме чёрная колонка слева выглядела бы как недоделка. Фолбэки — прежние
       литералы, чтобы вид не поехал, если /theme.css почему-то не доехал. */
    :root { --sb-w: var(--ui-sb-w, 230px); --icon-color:#8a8a8a; --icon-hover:var(--ui-tx,#fff); --icon-active:var(--ui-brand,#00a0ff); }
    #app-sidebar { position:fixed; top:0; left:0; width:var(--sb-w); height:100vh; background:var(--ui-bg,#0a0a0a); border-right:1px solid var(--ui-line-2,#1a1a1a); overflow-y:auto; z-index:500; display:flex; flex-direction:column; padding:16px 0; }
    #app-sidebar .sb-logo { padding:6px 20px 18px; font-size:16px; font-weight:700; color:var(--ui-tx,#fff); display:flex; align-items:center; gap:8px; }
    #app-sidebar .sb-logo span.v { font-size:11px; color:#555; font-weight:400; }
    /* Индикатор «Диагностика каналов» (ai_health) — точка у версии, красная = обрыв,
       кликабельна на /agents. Не выводим цифр — только цвет+тултип, честно по данным /api/agents. */
    #sb-health-dot { width:8px; height:8px; border-radius:50%; margin-left:6px; background:#333; flex-shrink:0; cursor:pointer; }
    #sb-health-dot.ok { background:#2ecc71; box-shadow:0 0 5px #2ecc7166; }
    #sb-health-dot.error { background:#e05252; box-shadow:0 0 6px #e0525288; animation:sbhealthpulse 1.6s ease-in-out infinite; }
    @keyframes sbhealthpulse { 0%,100%{opacity:1} 50%{opacity:.45} }
    /* Правило .sb-session отсюда убрано (19.09.2026): остаток сессии больше не висит
       серым текстом под логотипом на каждой странице, а лежит строкой в меню профиля.
       Вид ему задаёт /sb-profile.js; писать его здесь нельзя — селектор с #app-sidebar
       весит больше и перебил бы модуль. Данные пишет тот же updSess ниже. */
    #app-sidebar .sb-group { padding:14px 20px 6px; font-size:10px; letter-spacing:.08em; color:#555; text-transform:uppercase; display:flex; align-items:center; justify-content:space-between; cursor:pointer; user-select:none; }
    #app-sidebar .sb-group:hover { color:#888; }
    #app-sidebar .sb-arrow { font-size:10px; transition:transform .2s; }
    #app-sidebar .sb-group.collapsed .sb-arrow { transform:rotate(-90deg); }
    #app-sidebar .sb-items { overflow:hidden; transition:max-height .25s ease; }
    #app-sidebar .sb-items.collapsed { max-height:0 !important; }
    /* gap / кегль / размер иконки — из темы (/set → «Меню и иконки»), фолбэки = прежние значения */
    #app-sidebar a.sb-link { display:flex; align-items:center; gap:var(--ui-nav-gap,11px); padding:9px 20px; color:var(--ui-tx-2,#aaa); text-decoration:none; font-size:var(--ui-nav-fs,14px); border-left:3px solid transparent; transition:background .15s, color .15s; }
    #app-sidebar a.sb-link:hover { background:var(--ui-surface,#141414); color:var(--ui-tx,#fff); }
    #app-sidebar a.sb-link.active { color:var(--ui-brand,#00a0ff); border-left-color:var(--ui-brand,#00a0ff); background:#00a0ff11; font-weight:600; }
    #app-sidebar a.sb-link .ico { width:var(--ui-nav-ico,18px); height:var(--ui-nav-ico,18px); flex-shrink:0; color:var(--icon-color, currentColor); }
    #app-sidebar a.sb-link:hover .ico { color:var(--icon-hover, #fff); }
    #app-sidebar a.sb-link.active .ico { color:var(--icon-active, #00a0ff); }
    /* Подпись пункта — отдельным span (10.09.2026): текстом-сиротой её нельзя было ужать,
       и в узком «Быстром доступе» (режим правки, справа кнопка закрепления) длинное
       «Уведомления» выталкивало бейдж под кнопку. Теперь подпись режется многоточием,
       а бейдж (flex:0 0 auto) всегда стоит целиком — слева от кнопки. */
    #app-sidebar a.sb-link .sb-lbl { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    /* Вид бейджа — токены --ui-badge-* из /theme.css (/set → «Бейджи»), правила компонента —
     .ui-badge в ui.css. Здесь только фолбэки на случай, если /theme.css не доехал. */
  #app-sidebar .sb-badge { margin-left:auto; flex:0 0 auto; background:var(--ui-badge-bg,#e05252); color:var(--ui-badge-text,#fff); font-size:var(--ui-badge-fs,10px); font-weight:var(--ui-badge-fw,600); min-width:var(--ui-badge-h,18px); height:var(--ui-badge-h,18px); border-radius:var(--ui-badge-radius,9px); display:flex; align-items:center; justify-content:center; padding:0 var(--ui-badge-px,5px); font-variant-numeric:tabular-nums; }
    /* Подвал (19.09.2026) — не плитки, а строки: «Настройки» и строка профиля, которую
       дорисовывает /sb-profile.js. Три плитки («На главную», «Копия для ИИ», масштаб)
       занимали ~100px высоты под то, что нажимают изредка; всё это переехало в меню
       за ⋮, а высота отдана списку разделов. */
    #app-sidebar .sb-foot { margin-top:auto; padding:6px 0 calc(6px + env(safe-area-inset-bottom,0px)); border-top:1px solid var(--ui-line-2,#1a1a1a); display:flex; flex-direction:column; gap:2px; }
    /* Строка подвала повторяет вид пункта меню, но без дерева групп: подвал — не группа,
       и засечка с направляющей линией тут читалась бы как «вложен в последнюю группу».
       Кегль, отступ и размер значка — из тех же переменных /set, что у пунктов. */
    #app-sidebar .sb-frow { display:flex; align-items:center; gap:var(--ui-nav-gap,11px); min-height:34px; box-sizing:border-box; padding:var(--ui-nav-pad,8px) 12px; margin:0 10px; border-radius:8px; color:var(--ui-tx-2,#aaa); text-decoration:none; font-size:var(--ui-nav-fs,14px); }
    #app-sidebar .sb-frow:hover { background:var(--ui-surface,#141414); color:var(--ui-tx,#fff); }
    #app-sidebar .sb-frow.active { color:var(--ui-brand,#00a0ff); font-weight:600; background:linear-gradient(90deg, rgba(0,160,255,.14), rgba(0,160,255,.03)); }
    #app-sidebar .sb-frow .ico { width:var(--ui-nav-ico,18px); height:var(--ui-nav-ico,18px); flex-shrink:0; color:var(--icon-color,#8a8a8a); }
    #app-sidebar .sb-frow:hover .ico { color:var(--icon-hover,#fff); }
    #app-sidebar .sb-frow.active .ico { color:var(--icon-active,#00a0ff); }
    @media (max-width:768px) { #app-sidebar .sb-frow { min-height:var(--ui-tap,44px); } }
    /* «Тема» и «Настройка» ходили по кругу: строками подвала → значками в строке
       логотипа (09.09.2026) → сюда (19.09.2026). Теперь «Настройки» — строка подвала,
       а тема лежит в меню за ⋮ вместе с масштабом и копией для ИИ. В строке логотипа
       остался только карандаш правки меню (/menu-pins.js). */
    /* Фолбэк для «Масштаба»: если /sb-profile.js не доехал, ui-scale.js кладёт виджет
       сюда, в подвал (последняя попытка в его waitAndInject). Дать ему вид строки, а не
       оставлять голым, — иначе редкий отказ модуля читается как сломанная вёрстка. */
    #app-sidebar .sb-foot > #ui-scale { display:flex; align-items:center; gap:8px; min-height:34px; padding:6px 12px; margin:0 10px; font-size:13px; color:var(--ui-tx-2,#8b8b8b); }
    #app-sidebar .sb-foot > #ui-scale .ttl { margin-right:auto; }
    /* Поиск — ПОД логотипом, а не в подвале (09.09.2026). Он самый частый вход в раздел,
       и внизу шторки за ним приходилось тянуться через весь список. Подсказки раскрываются
       ВНИЗ: наверху под полем есть куда, а прежнее bottom:100% выбрасывало бы их на логотип. */
    #app-sidebar .sb-search { position:relative; flex:0 0 auto; margin:2px 20px 10px; }
    #app-sidebar .sb-search input { width:100%; box-sizing:border-box; background:var(--ui-surface-3,#101010); border:1px solid var(--ui-line-2,#1e1e1e); border-radius:8px; padding:8px 10px; color:var(--ui-tx,#eee); font-size:13px; outline:none; }
    #app-sidebar .sb-search input::placeholder { color:var(--ui-tx-3,#666); }
    #app-sidebar .sb-search input:focus { border-color:#00a0ff55; }
    /* 02.10.2026: поиск — ФИЛЬТР самого меню, а не выпадающий список поверх.
       Несовпавшие строки прячутся классом .sb-f-off (display, а не удаление и не клон:
       бейджи-поллеры ищут ссылку по href и должны найти ту же самую), пустые группы — тоже,
       свёрнутые на время поиска раскрываются. Совпадение подсвечено <mark> в .sb-lbl.
       Стрелки ведут выделение .sb-f-hi по видимым строкам. Подсказка ⌘K / Ctrl K — справа
       в поле, пока оно пустое и без фокуса; на телефоне её нет (там нет клавиатуры). */
    #app-sidebar .sb-search input { padding-right:56px; }
    #app-sidebar .sb-kbd { position:absolute; right:8px; top:50%; transform:translateY(-50%); pointer-events:none; font:500 10.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ui-tx-3,#666); background:var(--ui-surface,#141414); border:1px solid var(--ui-line-2,#1e1e1e); border-radius:4px; padding:3px 5px; letter-spacing:.02em; }
    #app-sidebar .sb-search input:focus ~ .sb-kbd, #app-sidebar .sb-search input:not(:placeholder-shown) ~ .sb-kbd { display:none; }
    #app-sidebar .sb-f-off { display:none !important; }
    #app-sidebar .sb-lbl mark { background:color-mix(in srgb, var(--ui-brand,#00a0ff) 28%, transparent); color:inherit; border-radius:3px; padding:0 1px; }
    #app-sidebar .sb-group mark { background:none; color:var(--ui-brand,#00a0ff); }
    #app-sidebar a.sb-link.sb-f-hi { background:var(--ui-surface-2,#1a1a1a); color:var(--ui-tx,#fff); box-shadow:inset 2px 0 0 var(--ui-brand,#00a0ff); }
    #app-sidebar .sb-f-none { padding:14px 20px; font-size:12.5px; color:var(--ui-tx-3,#666); }
    #app-sidebar .sb-f-none[hidden] { display:none !important; }
    @media (max-width:768px) { #app-sidebar .sb-kbd { display:none; } #app-sidebar .sb-search input { padding-right:10px; } }
    body { padding-left:var(--sb-w); }
    #sb-burger { display:none; }
    #sb-overlay { display:none; }
    #app-sidebar .sb-grab { display:none; }
    /* МОБИЛА: кнопка ☰ — в ПРАВОМ верхнем углу, меню — нижняя шторка.
       Правый угол: при хвате правой рукой верхний ЛЕВЫЙ угол — самый дальний от пальца,
       правый ближе; плюс это привычный слот overflow-меню (Instagram, YouTube, Google).
       Нижняя шторка: тап по углу остаётся одним, но сам список пунктов приезжает
       в зону большого пальца, а не растягивается на весь рост экрана.
       Место под кнопку в шапке страницы резервирует /burger-space.js (обтеканием). */
    @media (max-width:768px) {
      body { padding-left:0; }
      #app-sidebar {
        top:auto; bottom:0; left:0; right:0; width:auto; height:auto;
        /* Потолок — до низа бургера (12px сверху + 42px кнопка + 8px просвет), а не
           доля экрана. Было min(78vh,640px): на рослом телефоне 640px упирались первыми,
           и над шторкой оставалась мёртвая полоса в четверть экрана — список при этом
           прокручивался внутри. Верхняя шторка (body.cfbn-on) от той же величины только
           выигрывает: снизу остаётся место под собственный док страницы.
           dvh — потому что vh на мобильных считается по РАЗВЁРНУТОМУ окну и не замечает
           панель браузера; строкой выше тот же расчёт на vh для движков без dvh. */
        max-height:calc(100vh - 62px);
        max-height:calc(100dvh - 62px);
        border-right:0; border-top:1px solid #1a1a1a;
        border-radius:var(--ui-sheet-radius,22px) var(--ui-sheet-radius,22px) 0 0;
        box-shadow:0 -16px 40px -8px color-mix(in srgb,var(--ui-shadow-c,#000) 35%,transparent);
        padding:8px 0 calc(10px + env(safe-area-inset-bottom));
        transform:translateY(100%); transition:transform .25s; will-change:transform;
      }
      #app-sidebar.open { transform:translateY(0); }
      /* «ручка» шторки — та же, что у шторок медкарты; за неё же тянут вниз, чтобы закрыть */
      #app-sidebar .sb-grab { display:block; flex:0 0 auto; width:38px; height:4px; border-radius:2px; background:var(--ui-grip,#4a4a4a); margin:4px auto 10px; }
      #app-sidebar .sb-logo { padding-top:0; padding-bottom:12px; }
      #sb-burger { display:flex; position:fixed; top:12px; right:12px; z-index:600; width:42px; height:42px; border-radius:10px; background:var(--ui-surface-2,#1a1a1a); border:1px solid var(--ui-line,#2a2a2a); color:var(--ui-tx,#fff); align-items:center; justify-content:center; font-size:20px; cursor:pointer; -webkit-tap-highlight-color:transparent; }
      #sb-overlay.open { display:block; position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:499; }
      /* Страницы со СВОИМ нижним меню (медкарта, трекер — там body.cfbn-on от
         bottom-nav.js): шторка приезжает СВЕРХУ, из-под бургера. Снизу у них уже
         есть док, и две панели в одной зоне спорят за большой палец — человек тянется
         к нижнему меню, а получает меню портала (04.09.2026, замечание Константина). */
      /* Потолок верхней шторки — НИЖНЯЯ граница полоски кнопок, а не 0 (15.09.2026,
         /trip). При top:0 шторка заезжала под фиксированные ⟳ (/hard-refresh.js,
         right:62px) и ☰ (right:12px): кнопки висели поверх её же шапки, крестик
         накрывал строку логотипа. Те кнопки стоят на top:12px и ростом 42px, значит
         полоска кончается на 54px; +8px просвет = 62px — та же величина, из которой
         выше считается max-height, так что низ шторки по-прежнему ровно на краю
         экрана. Отступ под чёлку не нужен: 62px уже ниже неё. */
      body.cfbn-on #app-sidebar {
        top:62px; bottom:auto;
        border-top:0; border-bottom:1px solid #1a1a1a;
        border-radius:0 0 var(--ui-sheet-radius,22px) var(--ui-sheet-radius,22px);
        box-shadow:var(--ui-shadow-md,0 6px 18px -2px rgba(0,0,0,.30));
        padding:8px 0 10px;
        transform:translateY(-100%);
      }
      /* Уехать наверх целиком шторке теперь мало -100%: под ней остаются те же 62px,
         и её край подглядывал бы из-под кнопок. Прячем с запасом. */
      body.cfbn-on #app-sidebar:not(.open) { transform:translateY(calc(-100% - 62px)); }
      body.cfbn-on #app-sidebar.open { transform:translateY(0); }
    }

    /* --- v2: скролл только по меню, футер закреплён --- */
    #app-sidebar { overflow:hidden; }
    #app-sidebar .sb-nav { flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding-bottom:6px; scrollbar-width:thin; scrollbar-color:#1e1e1e transparent; }
    #app-sidebar .sb-nav::-webkit-scrollbar { width:6px; }
    #app-sidebar .sb-nav::-webkit-scrollbar-track { background:transparent; }
    #app-sidebar .sb-nav::-webkit-scrollbar-thumb { background:#1c1c1c; border-radius:3px; }
    #app-sidebar .sb-nav:hover::-webkit-scrollbar-thumb { background:#2c2c2c; }
    #app-sidebar .sb-foot { flex:0 0 auto; margin-top:0; background:var(--ui-bg,#0a0a0a); }

    /* Экран ввода пароля: кнопки платформы прячем совсем (05.09.2026). За паролем
       открывать нечего — все пункты меню упрутся в ту же форму, — а с ADR-147
       место под кнопки резервирует собранная шапка, которой на экране входа нет:
       ☰ и ⟳ висели поверх пустого фона над формой. Класс ставит наблюдатель ниже.
       Прячем только бургер: /hard-refresh.js следит за его видимостью и уходит сам. */
    body.sb-authwall #sb-burger { display:none !important; }

    /* --- v2: направляющая линия групп --- */
    #app-sidebar .sb-items { position:relative; }
    #app-sidebar .sb-items::before { content:''; position:absolute; left:27px; top:0; bottom:6px; width:1px; background:var(--ui-line-2,#1c1c1c); }
    #app-sidebar .sb-items.collapsed::before { display:none; }
    #app-sidebar a.sb-link { position:relative; border-left:0; padding:var(--ui-nav-pad,8px) 14px var(--ui-nav-pad,8px) 44px; margin-right:10px; border-radius:0 8px 8px 0; }
    #app-sidebar a.sb-link::before { content:''; position:absolute; left:28px; top:50%; width:9px; height:1px; background:#232323; transition:background .15s, width .15s; }
    #app-sidebar a.sb-link:hover::before { background:#3d3d3d; width:11px; }
    #app-sidebar a.sb-link.active { background:linear-gradient(90deg, rgba(0,160,255,.14), rgba(0,160,255,.03)); }
    #app-sidebar a.sb-link.active::before { background:#00a0ff; width:12px; box-shadow:0 0 6px rgba(0,160,255,.6); }

    /* Правый край строки логотипа: правка меню (/menu-pins.js), тема, настройка.
       «Тема» и «Настройка» переехали сюда из подвала значками (09.09.2026): подписи
       занимали две строки шторки, а нажимают их изредка. Только раскладка контейнера —
       вид самих кнопок даёт роль .ibtn из btnCss(), локального CSS им не пишем
       (docs/rules/ui.md), размер значка задаётся спрайту, а не кнопке. */
    #app-sidebar .sb-logo .sb-acts { margin-left:auto; display:flex; align-items:center; gap:6px; }
    #app-sidebar .sb-logo .sb-acts > #sb-logo-act { display:flex; align-items:center; }
    /* Размер — как у бургера ☰ (42px): значки без подписей, и мелкая мишень тут не
       прощается. Задаём ТОЛЬКО min-width/min-height — иконочная роль в btnCss() объявляет
       width/height:auto !important, обычные width/height молча не сработают
       (docs/rules/ui.md, тот же приём, что у крестика шторки медкарты). */
    #app-sidebar .sb-logo .sb-acts > .ibtn { min-width:42px; min-height:42px; }
    #app-sidebar .sb-logo .sb-acts .ibtn svg { width:22px; height:22px; }

    /* ПК (10.09.2026): в 230px строка логотипа с тремя значками по 42px не влезала —
       «AI-платформа» ломалась на две строки, «Тема» и «Настройка» уезжали за край.
       Разрешаем перенос: версия с точкой и значки уходят второй строкой, значки
       поменьше (мышью мишень 32px — норма, 42px оставлены телефону). */
    @media (min-width:769px) {
      #app-sidebar .sb-logo { flex-wrap:wrap; row-gap:6px; white-space:nowrap; }
      #app-sidebar .sb-logo .sb-acts > .ibtn { min-width:32px; min-height:32px; }
      #app-sidebar .sb-logo .sb-acts .ibtn svg { width:18px; height:18px; }
    }

    /* Строка логотипа на ТЕЛЕФОНЕ (19.09.2026, макет утверждён Константином):
       «AI-платформа» и логотип убраны, слева статус + две версии — платформы и модуля
       текущей страницы (строку модуля заполняет /mhead.js по значку mvBadge-*),
       справа ✎ правка меню → ⟳ обновить → ⚙ настройки. Строка «Настройки» в подвале
       на телефоне скрыта — её заменила ⚙. На ПК всё как было. */
    #app-sidebar .sb-vers { display:flex; align-items:center; min-width:0; }
    #app-sidebar .sb-vl { display:flex; align-items:center; }
    #app-sidebar .sb-vlbl, #app-sidebar .sb-vmod, #app-sidebar .sb-logo .sb-acts > .sb-mact { display:none !important; }
    @media (max-width:768px) {
      #app-sidebar .sb-logo { padding:0 8px 8px 20px; gap:8px; min-height:44px; }
      #app-sidebar .sb-logo .sb-lg, #app-sidebar .sb-logo .sb-name { display:none; }
      #app-sidebar .sb-vers { flex:1 1 auto; flex-direction:column; align-items:flex-start; gap:2px; font-size:12px; font-weight:400; line-height:1.35; color:var(--ui-tx,#fff); }
      #app-sidebar .sb-vl { gap:6px; white-space:nowrap; }
      #app-sidebar .sb-vlbl { display:inline !important; }
      #app-sidebar .sb-vers .v { font-size:12px; color:var(--ui-tx-2,#8b8b8b); }
      #app-sidebar .sb-vers #sb-health-dot { order:-1; margin-left:0; width:7px; height:7px; }
      #app-sidebar .sb-vmod { display:flex !important; padding-left:13px; cursor:pointer; }
      #app-sidebar .sb-vmod:empty { display:none !important; }
      #app-sidebar .sb-logo .sb-acts { gap:4px; }
      #app-sidebar .sb-logo .sb-acts > .sb-mact { display:inline-flex !important; }
      #app-sidebar .sb-foot > a.sb-frow[href="/set"] { display:none; }
    }
  `;

  const links = MENU.map((g, gi) => {
    const inner = g.items.map(it => {
      // Раздел «Тайминг»: пункт горит и на своих вкладках (/timing/week, /timing/slots).
      const active = (path === it.href.replace(/\/$/, '') ||
        (it.href === '/timing/app' && path.indexOf('/timing/') === 0)) ? ' active' : '';
      return `<a class="sb-link${active}" href="${it.href}"${it.ext?' target="_blank" rel="noopener"':''}><svg class="ico" aria-hidden="true"><use href="${window.ICONS_URL||'/assets/icons.svg?v=8'}#i-${it.icon}"></use></svg><span class="sb-lbl">${it.label}</span></a>`;
    }).join('');
    return `<div class="sb-group" onclick="sbToggleGroup(${gi})"><span>${g.group}</span><span class="sb-arrow" id="sb-arr-${gi}">▾</span></div><div class="sb-items" id="sb-items-${gi}">${inner}</div>`;
  }).join('');

  const html = `
    <div id="sb-burger" role="button" aria-label="Меню" onclick="sbMenu()">☰</div>
    <div id="sb-overlay" onclick="sbMenu(false)"></div>
    <nav id="app-sidebar">
      <div class="sb-grab" aria-hidden="true"></div>
      <div class="sb-logo"><img class="sb-lg" src="/assets/logo.svg" alt="" style="width:22px;height:22px;flex-shrink:0;"><span class="sb-name">AI-платформа</span><span class="sb-vers"><span class="sb-vl"><span class="sb-vlbl">Платформа</span><span class="v" id="sb-version"></span><span id="sb-health-dot" title="Диагностика каналов" onclick="location.href='/agents'"></span></span><span class="sb-vl sb-vmod" id="sb-mod-ver"></span></span><span class="sb-acts"><span id="sb-logo-act"></span><button type="button" class="ibtn sb-mact" id="sb-refresh" aria-label="Обновить страницу" title="Обновить" onclick="window.hardReload ? window.hardReload() : location.reload()"><svg class="ico" aria-hidden="true"><use href="${window.ICONS_URL||'/assets/icons.svg?v=8'}#i-refresh"></use></svg></button><button type="button" class="ibtn sb-mact" id="sb-set" aria-label="Настройки" title="Настройки" onclick="window.mhSettings ? window.mhSettings() : (location.href='/set')"><svg class="ico" aria-hidden="true"><use href="${window.ICONS_URL||'/assets/icons.svg?v=8'}#i-settings"></use></svg></button></span></div>
      <div class="sb-search" id="sb-search" role="search"><input id="sb-search-input" type="text" placeholder="Поиск по меню…" autocomplete="off" spellcheck="false" aria-label="Поиск по меню" aria-controls="sb-nav" aria-keyshortcuts="${SB_KEY_ARIA}"><kbd class="sb-kbd" aria-hidden="true">${SB_KEY_HINT}</kbd></div>
      <div class="sb-nav" id="sb-nav">${links}<div class="sb-f-none" id="sb-f-none" role="status" hidden>Ничего не найдено</div></div>
      <div class="sb-foot"><a class="sb-frow${path === '/set' ? ' active' : ''}" href="/set"><svg class="ico" aria-hidden="true"><use href="${window.ICONS_URL||'/assets/icons.svg?v=8'}#i-settings"></use></svg><span class="sb-lbl">Настройки</span></a></div>
    </nav>
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  window.sbToggleGroup = function(gi) {
    const grp = document.querySelectorAll('#app-sidebar .sb-group')[gi];
    const items = document.getElementById('sb-items-'+gi);
    if (!grp || !items) return;
    const collapsed = items.classList.toggle('collapsed');
    grp.classList.toggle('collapsed', collapsed);
    if (!collapsed) { items.style.maxHeight = items.scrollHeight + 'px'; setTimeout(()=>{ if(!items.classList.contains('collapsed')) items.style.maxHeight='none'; }, 260); }
  };

  // Открыть/закрыть мобильную шторку меню. Без аргумента — переключить.
  window.sbMenu = function (v) {
    const sb = document.getElementById('app-sidebar');
    const ov = document.getElementById('sb-overlay');
    const b  = document.getElementById('sb-burger');
    if (!sb) return;
    if (v === undefined) v = !sb.classList.contains('open');
    sb.style.transition = '';
    sb.style.transform = '';            // сбрасываем след от перетаскивания
    sb.classList.toggle('open', v);
    if (ov) ov.classList.toggle('open', v);
    if (b) { b.textContent = v ? '✕' : '☰'; b.setAttribute('aria-label', v ? 'Закрыть меню' : 'Меню'); }
  };

  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.sbMenu(false); });

  // ⌘K / Ctrl+K — поиск по меню на ЛЮБОЙ странице портала (02.10.2026).
  // Раньше сочетание жило только на /issues и /ticket и ставило фокус в локальный поиск
  // списка — на остальных страницах те же пальцы открывали поиск браузера. Теперь одно
  // поведение везде; локальный поиск этих двух страниц остался на «/».
  // Меню в режиме иконок — сперва разворачиваем (window.sbSetIcons из sb-resize.js),
  // иначе поле поиска скрыто. На телефоне открываем шторку. Ловим в фазе перехвата на
  // window: страница не успеет съесть сочетание своим обработчиком.
  // По e.code — чтобы работало и в русской раскладке (там e.key = «л»).
  window.sbFocusSearch = function () {
    const inp = document.getElementById('sb-search-input');
    if (!inp) return false;
    if (window.innerWidth <= 768) window.sbMenu(true);
    else if (document.documentElement.classList.contains('sb-icons') && typeof window.sbSetIcons === 'function') window.sbSetIcons(false);
    inp.focus();
    inp.select();
    return true;
  };
  window.addEventListener('keydown', function (e) {
    // На Mac — только ⌘ (Ctrl+K там в полях ввода — «удалить до конца строки»), иначе Ctrl.
    if (!(SB_MAC ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey) return;
    if (e.code !== 'KeyK' && !/^[kл]$/i.test(e.key || '')) return;
    if (!document.getElementById('sb-search-input')) return;   // ?embed=1 / экран входа
    if (document.body && document.body.classList.contains('sb-authwall')) return;
    e.preventDefault();
    e.stopPropagation();
    window.sbFocusSearch();
  }, true);
  window.addEventListener('resize', () => { if (window.innerWidth > 768) window.sbMenu(false); });
  // переход по пункту меню закрывает шторку (иначе она висит поверх новой страницы,
  // пока та грузится, и мигает при возврате «назад» из кэша)
  document.addEventListener('click', e => {
    if (window.innerWidth > 768) return;
    const a = e.target.closest && e.target.closest('#app-sidebar a');
    if (a) window.sbMenu(false);
  });

  // Потянуть шторку вниз, чтобы закрыть. Тянем только за «ручку» и шапку меню:
  // если ловить жест на всей шторке, он отбирает вертикальный скролл у списка пунктов.
  (function () {
    let y0 = null, dy = 0, sb = null;
    document.addEventListener('touchstart', e => {
      sb = document.getElementById('app-sidebar');
      if (!sb || !sb.classList.contains('open')) return;
      // .sb-session из списка убран 19.09.2026: остаток сессии уехал в меню профиля,
      // под логотипом этого узла больше нет.
      if (!(e.target.closest && e.target.closest('.sb-grab, .sb-logo'))) return;
      y0 = e.touches[0].clientY; dy = 0;
      sb.style.transition = 'none';
    }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      sb.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    document.addEventListener('touchend', () => {
      if (y0 === null) return;
      y0 = null;
      sb.style.transition = '';
      sb.style.transform = '';
      if (dy > 70) window.sbMenu(false);
    });
  })();



  // Виден ли на странице экран ввода пароля (#login — общий id на всём портале).
  // Видимость меряем прямоугольниками, а не style.display: страницы гасят форму
  // кто инлайном, кто классом, кто просто удаляет узел. Слушаем мутации, а не
  // опрашиваем таймером: форма скрывается один раз, после успешного входа.
  (function () {
    var last = null;
    function sync() {
      if (!document.body) return;
      var l = document.getElementById('login');
      var on = !!(l && l.getClientRects().length);
      // Пишем в класс ТОЛЬКО при смене состояния: classList.toggle переустанавливает
      // атрибут даже когда набор классов не поменялся, а это новая мутация — и
      // наблюдатель ниже вызвал бы сам себя бесконечно.
      if (on === last) return;
      last = on;
      document.body.classList.toggle('sb-authwall', on);
    }
    function start() {
      sync();
      if (window.MutationObserver) {
        new MutationObserver(sync).observe(document.documentElement, {
          childList: true, subtree: true,
          attributes: true, attributeFilter: ['style', 'class', 'hidden']
        });
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  })();

  function normIcons(root) {
    (root || document).querySelectorAll('use[href*="#i-"]').forEach(u => {
      const svg = u.closest('svg'); if (!svg) return;
      if (svg.closest('.modal-sidebar')) return;
      // Кнопки с no-ui-btn — осознанное исключение из ролей: класс i-copy на значке
      // включает правило ui.css button:has(.i-copy) (padding:4px !important). Так кривой
      // выходила плитка «Копия для ИИ» в прежнем подвале; с 19.09.2026 это строка
      // «Копия для ИИ» в меню профиля (/sb-profile.js), и грабли там те же.
      if (svg.closest('.no-ui-btn')) return;
      const m = (u.getAttribute('href')||'').match(/#(i-trash|i-del|i-edit|i-copy|i-show|i-hide)/);
      if (!m) return;
      const cls = m[1] === 'i-trash' ? 'i-del' : m[1];
      if (svg.hasAttribute('style')) svg.removeAttribute('style');
      if (!svg.classList.contains(cls)) svg.classList.add(cls);
      const p = svg.parentElement;
      if (p && p.style && p.style.color) p.style.color = '';
    });
  }
  window.normIcons = normIcons;

  // ===== БЕЙДЖИ: кап счётчика (08.09.2026) =====
  // Правило платформы: счётчик не растёт бесконечно, после порога это «N+».
  // Иначе трёхзначное число раздвигает строку и ломает раскладку меню, а точное
  // «137» всё равно не несёт смысла — решение человек принимает уже на «много».
  // Порог живёт в теме (--ui-badge-cap, /set → «Бейджи»), а не константой в коде.
  // uiBadgeText(n) — только текст; uiBadge(el, n) — ещё и прячет узел на нуле.
  function uiBadgeCap() {
    const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ui-badge-cap'), 10);
    return v > 0 ? v : 99;
  }
  function uiBadgeText(n) {
    const v = +n || 0, cap = uiBadgeCap();
    return v <= 0 ? '' : (v > cap ? cap + '+' : String(v));
  }
  function uiBadge(el, n) {
    if (!el) return '';
    const t = uiBadgeText(n);
    el.textContent = t;
    el.style.display = t ? '' : 'none';
    return t;
  }
  window.uiBadgeCap = uiBadgeCap;
  window.uiBadgeText = uiBadgeText;
  window.uiBadge = uiBadge;
  document.addEventListener('DOMContentLoaded', () => normIcons());
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes)
    if (n.nodeType === 1) normIcons(n.parentElement || n); })
    .observe(document.documentElement, { childList: true, subtree: true });

  // 16.09.2026: body уже есть (скрипт стоит в конце <body>) — вставляем СРАЗУ, а не
  // по DOMContentLoaded: иначе первый кадр рисовался без меню и страница прыгала.
  // Заодно так сайдбар попадает в снимок View Transition (см. SB_EARLY_TAG в server.js).
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);
  function inject() {
    if (document.getElementById('app-sidebar')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    document.querySelectorAll('#app-sidebar .sb-items').forEach(el => { el.style.maxHeight = 'none'; });

    // Закрепление строк (/menu-pins.js). Модуль грузится асинхронно, поэтому ждём его —
    // но с потолком попыток: не дождались (файл не отдался) — меню просто остаётся
    // прежним, без «Быстрого доступа», и это не повод крутить таймер вечно.
    // Умолчания портала — то, что Константин ищет чаще всего (задача 09.09.2026);
    // применяются ОДИН раз, пока человек сам ничего не закрепил.
    (function mountPins(tries) {
      if (!window.MenuPins) {
        if ((tries || 0) > 60) return;
        return void setTimeout(() => mountPins((tries || 0) + 1), 60);
      }
      window.MenuPins.mount({
        scope: 'portal',
        root: document.getElementById('app-sidebar'),
        list: document.querySelector('#app-sidebar .sb-nav'),
        linkSel: 'a.sb-link',
        editHost: document.getElementById('sb-logo-act'),
        defaults: ['/crm/chats', '/crm/leads', '/notify'],
        mq: '(max-width:768px)'
      });
    })(0);
    // Поллеры сайдбара (09.09.2026). Раньше пять таймеров — чаты 20 с, уведомления,
    // контроль и сессия по 60 с, здоровье 180 с — ходили на сервер круглосуточно в
    // КАЖДОЙ открытой вкладке, включая свёрнутые и фоновые. Теперь в скрытой вкладке
    // запрос не уходит вообще, а при возврате к вкладке всё обновляется сразу, чтобы
    // бейджи не показывали вчерашнее.
    const SB_POLLS = [];
    let sbSeen = Date.now();
    function sbPoll(fn, ms) {
      fn();
      SB_POLLS.push(fn);
      setInterval(function () { if (!document.hidden) fn(); }, ms);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      // Троттл: вернулись на вкладку — обновляем, но не чаще раза в 10 секунд.
      // Без него частое переключение вкладок стало бы ХУЖЕ прежнего: каждый щелчок
      // давал бы залп из пяти запросов.
      if (Date.now() - sbSeen < 10000) return;
      sbSeen = Date.now();
      SB_POLLS.forEach(function (f) { try { f(); } catch (e) {} });
    });
    function updNotify() {
      fetch('/api/notify-count', {credentials:'same-origin'}).then(r=>r.json()).then(d=>{
        const link = document.querySelector('#app-sidebar a[href="/notify"]');
        if (!link) return;
        let b = link.querySelector('.sb-badge');
        if (d.unread > 0) {
          if (!b) { b = document.createElement('span'); b.className='sb-badge'; link.appendChild(b); }
          b.textContent = uiBadgeText(d.unread);
        } else if (b) b.remove();
      }).catch(()=>{});
    }
    // Бейджи — только открытых роли разделов (ADR-263): иначе 403 в консоли на каждой странице.
    const sbWhenCan = function (keys, f, ms) {
      (window.CF_PERMS_READY || Promise.resolve()).then(function () {
        if (keys.every(function (k) { return window.cfCan ? window.cfCan(k) : true; })) sbPoll(f, ms);
      });
    };
    sbWhenCan(['notify'], updNotify, 60000);
    function updControl() {
      fetch('/api/med/review', {credentials:'same-origin'}).then(r=>r.json()).then(d=>{
        const link = document.querySelector('#app-sidebar a[href="/control"]');
        if (!link) return;
        let b = link.querySelector('.sb-badge');
        if (d.count > 0) {
          if (!b) { b = document.createElement('span'); b.className='sb-badge'; link.appendChild(b); }
          b.textContent = uiBadgeText(d.count);
        } else if (b) b.remove();
      }).catch(()=>{});
    }
    sbWhenCan(['med', 'control'], updControl, 60000);
    // Бейдж непрочитанных сообщений раздела «Чаты» (business chats)
    function updChats() {
      fetch('/api/business/unread-count', {credentials:'same-origin'}).then(r=>r.json()).then(d=>{
        const link = document.querySelector('#app-sidebar a[href="/crm/chats"]');
        if (!link) return;
        let b = link.querySelector('.sb-badge');
        if (d.unread > 0) {
          if (!b) { b = document.createElement('span'); b.className='sb-badge'; link.appendChild(b); }
          b.textContent = uiBadgeText(d.unread);
        } else if (b) b.remove();
      }).catch(()=>{});
    }
    sbWhenCan(['chats'], updChats, 20000);
    // Бейдж «Почта» (01.10.2026, ADR-267): новые входящие по всем доменам владельца, /api/mail/unread.
    // Тот же общий опрос sbPoll (раз в минуту + возврат на вкладку); /mail шлёт событие mail-unread сразу.
    function paintMail(n) {
      const link = document.querySelector('#app-sidebar a[href="/mail"]');
      if (!link) return;
      let b = link.querySelector('.sb-badge');
      if (n > 0) {
        if (!b) { b = document.createElement('span'); b.className='sb-badge'; link.appendChild(b); }
        b.textContent = uiBadgeText(n);
      } else if (b) b.remove();
    }
    function updMail() {
      fetch('/api/mail/unread', {credentials:'same-origin'}).then(r => r.ok ? r.json() : null).then(d => {
        if (!d) return;
        paintMail(d.total || 0);
        // страница /mail берёт отсюда числа чипов доменов — своего интервала у неё нет
        try { window.dispatchEvent(new CustomEvent('mail-unread', { detail: { total: d.total || 0, by_domain: d.by_domain || {}, src: 'sidebar' } })); } catch (e) {}
      }).catch(()=>{});
    }
    window.addEventListener('mail-unread', function (e) { if (e && e.detail && typeof e.detail.total === 'number') paintMail(e.detail.total); });
    sbWhenCan(['mail'], updMail, 60000);
    // Индикатор «Диагностика каналов» — точка у версии в сайдбаре, честно по /api/agents
    // (та же ai_health.js, что и карточка на /agents), опрос раз в 3 минуты.
    function updHealth() {
      fetch('/api/agents', {credentials:'same-origin'}).then(r=>r.json()).then(d=>{
        const dot = document.getElementById('sb-health-dot');
        if (!dot) return;
        const a = (d.agents||[]).find(x=>x.id==='ai_health');
        dot.classList.remove('ok','error');
        if (!a || a.status==='unknown') { dot.title = 'Диагностика каналов: нет данных'; return; }
        dot.classList.add(a.status==='ok' ? 'ok' : 'error');
        dot.title = 'Диагностика каналов: ' + (a.note || (a.status==='ok'?'в порядке':'обрыв'));
      }).catch(()=>{});
    }
    sbWhenCan(['agents'], updHealth, 180000);
    fetch('/api/version').then(r => r.json()).then(d => {
      const el = document.getElementById('sb-version'); if (el) el.textContent = 'v' + d.version;
    }).catch(() => {});
    function updSess() {
      fetch('/api/pass-status', { credentials:'same-origin' }).then(r=>r.json()).then(d=>{
        const el = document.getElementById('sb-session'); if (!el) return;
        if (!d.authed) { el.textContent=''; return; }
        const left = d.expires - Date.now();
        if (left <= 0) { el.textContent='Сессия истекла'; return; }
        // сессия теперь 30 дней — часами уже не измеряем
        const dd = Math.floor(left/86400000), h = Math.floor((left%86400000)/3600000), m = Math.floor((left%3600000)/60000);
        const rest = dd > 0 ? (dd + 'д ' + h + 'ч') : (h > 0 ? (h + 'ч ' + m + 'м') : (m + 'м'));
        const lt = new Date(d.loginTime);
        el.innerHTML = 'Вход: ' + lt.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) + '<br>осталось ' + rest;
      }).catch(()=>{});
    }
    sbPoll(updSess, 60000);
    // Строка «Вход … осталось …» живёт в меню профиля, а его рисует /sb-profile.js после
    // своего запроса — к первому вызову updSess узла ещё нет, и до следующего тика
    // пришлось бы ждать минуту. Отдаём модулю ручку, чтобы он обновил строку сразу.
    // Не дублируем расчёт у него: продление сессии (скользящая кука) висит на ЭТОМ же
    // запросе, и два места, считающих остаток, разошлись бы на первой правке.
    window.sbUpdSess = updSess;

    // ===== Поиск по меню (02.10.2026) =====
    // Было: выпадающий список из 10 клонов-ссылок поверх меню. Стало: фильтр самого меню —
    // несовпавшие строки прячутся, совпадение подсвечено в подписи. Почему не клоны:
    // бейджи (уведомления, чаты, почта) вешают поллеры по href на ОРИГИНАЛ ссылки, и у клона
    // их не было; плюс «Быстрый доступ» (menu-pins.js) переносит сами строки — фильтр
    // работает и по ним.
    // Совпадение — по подписи пункта ИЛИ по названию группы (совпала группа — видны все её
    // пункты). Регистр не важен, ё = е, и запрос пробуется ещё в другой раскладке
    // (набрал «ktfls» вместо «лиды» — найдёт; и наоборот).
    // Пункты закрытых ролью разделов (ADR-263) в поиске не участвуют: их прячет CSS
    // из sbPermDenyCss, здесь мы их просто не считаем.
    const inp = document.getElementById('sb-search-input');
    const nav = document.querySelector('#app-sidebar .sb-nav');
    const none = document.getElementById('sb-f-none');
    // href → название группы из MENU: пункт в «Быстром доступе» живёт вне своей группы,
    // а искать его по группе всё равно нужно.
    const GROUP_OF = {};
    // Чтение — только через Object.hasOwn: href «constructor»/«__proto__» не должен достать
    // свойство прототипа (правило CLAUDE.md «Белый список в объекте», 03.10.2026).
    MENU.forEach(function (g) { g.items.forEach(function (it) { if (!Object.hasOwn(GROUP_OF, it.href)) GROUP_OF[it.href] = g.group; }); });
    const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
    const RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
    function swapLayout(s, from, to) {
      let o = '';
      for (const ch of s) { const i = from.indexOf(ch); o += i >= 0 ? to[i] : ch; }
      return o;
    }
    // Нормализация: нижний регистр и ё→е. Длина строки не меняется — индексы совпадения
    // в нормализованной подписи совпадают с индексами в исходной (нужно для <mark>).
    function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
    function variants(q) {
      const n = norm(q).trim();
      if (!n) return [];
      const out = [n];
      const ru = norm(swapLayout(n, EN, RU)), en = norm(swapLayout(n, RU, EN));
      if (out.indexOf(ru) < 0) out.push(ru);
      if (out.indexOf(en) < 0) out.push(en);
      return out;
    }
    function find(text, vs) {
      const t = norm(text);
      for (const v of vs) { const i = t.indexOf(v); if (i >= 0) return { i: i, n: v.length }; }
      return null;
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    // Подпись с подсветкой. Исходный текст держим в data-sbf-txt — к нему возвращаемся
    // при каждом новом запросе и при очистке, а не к тому, что уже размечено.
    function paintLbl(el, m) {
      if (!el) return;
      if (el.dataset.sbfTxt == null) el.dataset.sbfTxt = el.textContent;
      const t = el.dataset.sbfTxt;
      if (!m) { if (el.innerHTML !== esc(t)) el.textContent = t; return; }
      el.innerHTML = esc(t.slice(0, m.i)) + '<mark>' + esc(t.slice(m.i, m.i + m.n)) + '</mark>' + esc(t.slice(m.i + m.n));
    }
    function denied(a) {
      const deny = window.CF_PERM_DENY;
      if (!deny || !deny.size) return false;
      const h = a.getAttribute('href') || '';
      return deny.has(h.split('#')[0].split('?')[0]);
    }
    // Строка пункта: ссылку menu-pins.js оборачивает в .mp-row (там же пин и ручка) —
    // прятать надо обёртку целиком, иначе в «Быстром доступе» остаётся пустая полоса.
    function unitOf(a) { return (a.closest && a.closest('.mp-row')) || a; }
    function groupHead(box) {
      const h = box && box.previousElementSibling;
      return h && h.classList.contains('sb-group') ? h : null;
    }
    let curQ = '';
    let hi = -1;
    function visibleLinks() {
      return [].filter.call(nav.querySelectorAll('a.sb-link'), function (a) {
        return !denied(a) && !unitOf(a).classList.contains('sb-f-off') && a.getClientRects().length;
      });
    }
    function setHi(i) {
      const list = visibleLinks();
      list.forEach(function (a) { a.classList.remove('sb-f-hi'); a.removeAttribute('aria-selected'); });
      hi = list.length ? Math.max(0, Math.min(i, list.length - 1)) : -1;
      if (hi >= 0) { list[hi].classList.add('sb-f-hi'); list[hi].setAttribute('aria-selected', 'true'); list[hi].scrollIntoView({ block: 'nearest' }); }
    }
    function filter(q) {
      const vs = variants(q);
      curQ = vs.length ? vs[0] : '';
      const on = !!curQ;
      nav.classList.toggle('sb-filtering', on);
      let total = 0;
      // 1) группы: совпало название — открыта целиком; свёрнутую раскрываем на время поиска
      const boxes = [].slice.call(nav.querySelectorAll('.sb-items'));
      const grpHit = new Map();
      boxes.forEach(function (box) {
        const head = groupHead(box);
        const t = head && head.querySelector('span');
        const m = on && t ? find(t.dataset.sbfTxt != null ? t.dataset.sbfTxt : t.textContent, vs) : null;
        if (t) paintLbl(t, m);
        grpHit.set(box, !!m);
        if (on && box.classList.contains('collapsed')) {
          box.dataset.sbfWas = '1';
          box.classList.remove('collapsed'); if (head) head.classList.remove('collapsed');
          box.style.maxHeight = 'none';
        } else if (!on && box.dataset.sbfWas) {
          delete box.dataset.sbfWas;
          box.classList.add('collapsed'); if (head) head.classList.add('collapsed');
        }
      });
      const grpHitByName = {};
      boxes.forEach(function (box) {
        const t = groupHead(box) && groupHead(box).querySelector('span');
        if (t) grpHitByName[t.dataset.sbfTxt != null ? t.dataset.sbfTxt : t.textContent] = grpHit.get(box);
      });
      // 2) строки — и в группах, и в «Быстром доступе»
      [].forEach.call(nav.querySelectorAll('a.sb-link'), function (a) {
        const lbl = a.querySelector('.sb-lbl');
        const m = on ? find(lbl ? (lbl.dataset.sbfTxt != null ? lbl.dataset.sbfTxt : lbl.textContent) : a.textContent, vs) : null;
        const gHref = a.getAttribute('href') || '';
        const gName = Object.hasOwn(GROUP_OF, gHref) ? GROUP_OF[gHref] : '';
        const show = !on || !!m || (Object.hasOwn(grpHitByName, gName) && !!grpHitByName[gName]);
        paintLbl(lbl, m);
        unitOf(a).classList.toggle('sb-f-off', !show);
        a.classList.remove('sb-f-hi');
        if (show && on && !denied(a)) total++;
      });
      // 3) пустые группы и пустой «Быстрый доступ» — прочь вместе с заголовком
      boxes.forEach(function (box) {
        const has = [].some.call(box.querySelectorAll('a.sb-link'), function (a) { return !denied(a) && !unitOf(a).classList.contains('sb-f-off'); });
        const empty = on && !has;
        box.classList.toggle('sb-f-off', empty);
        const head = groupHead(box); if (head) head.classList.toggle('sb-f-off', empty);
      });
      const quick = nav.querySelector('.mp-quick');
      if (quick) {
        const qHas = [].some.call(quick.querySelectorAll('a.sb-link'), function (a) { return !denied(a) && !unitOf(a).classList.contains('sb-f-off'); });
        quick.classList.toggle('sb-f-off', on && !qHas);
        const cap = quick.previousElementSibling;
        if (cap && cap.classList.contains('mp-cap')) cap.classList.toggle('sb-f-off', on && !qHas);
      }
      if (none) none.hidden = !(on && total === 0);
      hi = -1;
      if (on && total) setHi(0);
      else if (!on) nav.scrollTop = 0;
    }
    window.sbFilter = function (q) { if (inp) inp.value = q || ''; filter(q || ''); };
    if (inp && nav) {
      inp.addEventListener('input', function () { filter(inp.value); });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHi(hi + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(hi <= 0 ? 0 : hi - 1); }
        else if (e.key === 'Enter') {
          e.preventDefault();
          const list = visibleLinks();
          const t = hi >= 0 ? list[hi] : list[0];
          if (t && curQ) location.href = t.getAttribute('href');
        }
        else if (e.key === 'Escape') {
          // первый Esc — очистить, второй (поле уже пустое) — уйти из поля.
          // stopPropagation: глобальный Esc сайдбара закрыл бы шторку на телефоне.
          if (inp.value) { e.stopPropagation(); inp.value = ''; filter(''); }
          else inp.blur();
        }
      });
      // Ушли в колонку иконок с непустым фильтром — сбрасываем: в 64px поле поиска
      // не видно, и меню выглядело бы «потерявшим» пункты без объяснения.
      window.addEventListener('sb:icons', function (e) {
        if (e.detail && e.detail.icons && inp.value) { inp.value = ''; filter(''); }
      });
    }
  }

  // единый счётчик в H1: "Название (N)"
  (function () {
    const st = document.createElement('style');
    st.textContent = '.h1n{color:#666;font-weight:normal;font-size:.62em;margin-left:6px;}';
    document.head.appendChild(st);
    let t = null;
    function count() {
      const h1 = document.querySelector('h1');
      if (!h1 || h1.hasAttribute('data-nocount')) return;
      const own = [...h1.children].find(e => !e.classList.contains('h1n'));
      if (own) { const old = h1.querySelector('.h1n'); if (old) old.remove(); return; }
      let sp = h1.querySelector('.h1n');
      if (!sp) { sp = document.createElement('span'); sp.className = 'h1n'; h1.appendChild(sp); }
      const tb = document.querySelector('tbody');
      let n = null;
      if (tb) n = [...tb.rows].filter(r => r.offsetParent !== null && r.cells.length > 1).length;
      sp.textContent = (n === null || n === 0) ? '' : '(' + n + ')';
    }
    function schedule() { clearTimeout(t); t = setTimeout(count, 250); }
    document.addEventListener('DOMContentLoaded', () => {
      count();
      new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    });
  })();

})();

// Глобальный виджет «Задачи в работе» — грузим один раз на всех страницах с сайдбаром
(function () {
  if (document.querySelector('script[src="/run-widget.js"]')) return;
  var s = document.createElement('script');
  s.src = '/run-widget.js';
  s.defer = true;
  document.head.appendChild(s);
})();

// Единая шапка страницы — /page-header.js (ADR-147). Подключается ТОЛЬКО отсюда:
// sidebar.js есть на каждой странице портала и нет в кабинетах клиентов, а у них
// свой порог (820px) и свой бургер — туда шапка приедет отдельным шагом.
(function () {
  if (document.querySelector('script[src^="/page-header.js"]')) return;
  __sbLoad('cf-page-header-src', '/page-header.js?v=8'); // v8 (01.10.2026): «i» (.ui-info) в H1 остаётся у названия
})();

// Место под кнопку меню в правом верхнем углу — /burger-space.js (ADR-075).
// Подключается отсюда и из cab-burger.js: файл один на портал и кабинет.
// На портале распорка больше не нужна: увидев window.__pageHeader, она снимает
// себя сама. Файл жив ради кабинетов.
(function () {
  if (document.querySelector('script[src^="/burger-space.js"]')) return;
  var s = document.createElement('script');
  s.src = '/burger-space.js?v=3';
  document.head.appendChild(s);
})();

// Кнопка жёсткого обновления слева от бургера (мобила) — /hard-refresh.js (25.08.2026).
// Тоже один файл на портал и кабинет, подключается отсюда и из cab-burger.js.
(function () {
  if (document.querySelector('script[src^="/hard-refresh.js"]')) return;
  var s = document.createElement('script');
  s.src = '/hard-refresh.js?v=4';
  document.head.appendChild(s);
})();

// Мобильная навигация портала — /mhead.js (19.09.2026): стрелка «назад» со стеком
// переходов, свёрнутая шапка при скролле, крошки и версия модуля в шторке бургера.
// Только портал: кабинеты клиентов этот файл не грузят.
(function () {
  if (document.querySelector('script[src^="/mhead.js"]')) return;
  var s = document.createElement('script');
  s.src = '/mhead.js?v=10'; // v10 (02.10.2026): без .sb-search-results (поиск меню стал фильтром)
  document.head.appendChild(s);
})();

// Копирование в буфер (uiCopy + data-copy) — /copy.js: мгновенная галочка, сброс
// через 2 с, сырое значение, фолбэк для небезопасного контекста. Один файл на портал
// и кабинет, второй раз подключается из cab-sidebar.js.
(function () {
  if (document.querySelector('script[src^="/copy.js"]')) return;
  var s = document.createElement('script');
  s.src = '/copy.js?v=2';
  document.head.appendChild(s);
})();

// Базовое поведение форм — /ui-forms.js (28.09.2026): плавающая подпись полей (имя поля в
// placeholder), подсказка под полем по data-hint, uiBusy()/uiDone() для кнопок. Правила —
// docs/rules/ui.md «Формы». Кабинеты (cab-sidebar.js) пока без него — отдельным шагом.
(function () {
  if (document.querySelector('script[src^="/ui-forms.js"]')) return;
  var s = document.createElement('script');
  s.src = '/ui-forms.js?v=2';
  document.head.appendChild(s);
})();

// Свои диалоги (uiConfirm / uiAlert / uiPrompt / uiToast) — вынесены в /ui-dialogs.js (ADR-033),
// чтобы их подхватывал и кабинет клиента, который грузит cab-sidebar.js вместо этого файла.
(function () {
  // Префикс, а не точное совпадение: страница может подключать файл с версией
  // (/ui-dialogs.js?v=1). При точном сравнении вторая копия скрипта грузилась бы
  // поверх уже подключённой — сам файл от этого защищён флагом window.uiDialogsReady,
  // но запрос уходил впустую (15.09.2026).
  if (document.querySelector('script[src^="/ui-dialogs.js"]')) return;
  var s = document.createElement('script');
  s.src = '/ui-dialogs.js?v=8'; // 03.10.2026: v8 — диалоги на телефоне шторкой + visualViewport; 30.09.2026: v7 — тени токенами; 29.09.2026: v6 — зазор над доком = --ui-toast-gap; v5 — тосты над доком (dockSync)
  document.head.appendChild(s);
})();

// Выбор цвета (uiColorPick) и разбор цвета для меток .ui-st — /ui-color.js (01.10.2026, ADR-285).
// Страницы, которые рисуют метки статусов сразу, подключают его сами выше своего скрипта;
// здесь — подстраховка для остальных (по префиксу src, как ui-dialogs.js).
(function () {
  if (document.querySelector('script[src^="/ui-color.js"]')) return;
  var s = document.createElement('script');
  s.src = '/ui-color.js?v=1';
  document.head.appendChild(s);
})();


