# Собирает «файлы-выдержки»: реальные строки боевого файла на своих номерах,
# всё выше — пустые строки-заглушки. Нужны только для генерации/проверки диффа
# по файлам, которые целиком не копировались (server.js > 1 МБ и т.п.).
# issues.html (стр. 281–288) и ticket.html (стр. 311–317) собраны тем же способом отдельно.
import os
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'orig')
EX = {
 'web/public/issues_page.js': (272, r"""  document.addEventListener('keydown', function (e) {
    var inField = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
    if (e.key === 'Escape') {
      if ($('iss-back').classList.contains('is-open')) { close(); return; }
      if (inField && e.target.id === 'iss-q') { e.target.value = ''; Q = ''; render(); e.target.blur(); }
      return;
    }
    // Сохранение из карточки — ⌘/Ctrl+Enter, как в задачах.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && $('iss-back').classList.contains('is-open')) { save(); return; }
    if (inField || e.metaKey || e.ctrlKey || e.altKey) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('iss-q').focus(); }
      return;
    }
    if (e.key === '/') { e.preventDefault(); $('iss-q').focus(); return; }
    if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'с') { e.preventDefault(); open(null); }
  });

  window.issOpen = open;
  window.issClose = close;"""),
 'web/public/ticket_page.js': (577, r"""  document.addEventListener('keydown', function (e) {
    var inField = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
    if (e.key === 'Escape') {
      if ($('tk-back').classList.contains('is-open')) { close(); return; }
      if (inField && e.target.id === 'tk-q') { e.target.value = ''; Q = ''; render(); e.target.blur(); }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && $('tk-back').classList.contains('is-open')) {
      if (document.activeElement && document.activeElement.id === 'tf-cmt') comment(); else save();
      return;
    }
    if (inField || e.metaKey || e.ctrlKey || e.altKey) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('tk-q').focus(); }
      return;
    }
    if (e.key === '/') { e.preventDefault(); $('tk-q').focus(); return; }
    if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'с') { e.preventDefault(); open(null); }
  });

  window.tkOpen = open;
  window.tkClose = close;"""),
 'web/public/mhead.js': (190, r"""  // Бургер, нижний док и вкладки раздела — это «новый корень», а не шаг вглубь.
  // Метка с отметкой времени: клик по вкладке, которая не перезагружает страницу,
  // не должен через минуту обнулить стек случайному переходу.
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('#app-sidebar a.sb-link, #app-sidebar .sb-frow, #app-sidebar .sb-search-results a, #cfbn, #cfbn-sheet, .med-tabs, .cl-sb a.cl-nav')) {
      ss(RESET, String(Date.now()));
    }
  }, true);"""),
 'web/server.js': (207, r"""// Поправил спрайт (новый символ) — подними ICONS_V здесь, и всё. Фолбэк-строку в JS
// поднимать не обязательно: он срабатывает только на странице без <head>. Версионный
// адрес получает Cache-Control 7 дней (setHeaders у express.static ниже) — одна загрузка,
// дальше из кэша браузера. Правило — docs/rules/ui.md, «Адрес спрайта».
const ICONS_V = 12; // 12 — i-star/i-pushpin для «Моих продуктов» (ADR-286, 01.10.2026); 11 — i-flag/i-mail-open для «Почты» (ADR-283, 01.10.2026); 10 — i-utensils/i-scan-barcode/i-flashlight для «Питания» (29.09.2026)
const ICONS_URL = "/assets/icons.svg?v=" + ICONS_V;
const ICONS_TAG = '<script>window.ICONS_URL="' + ICONS_URL + '"</script>';
const ICONS_RE = /\/assets\/icons\.svg(?:\?v=[\w.-]*)?(?=[#"'`)])/g;"""),
 'web/public/habits-sw.js': (30, r"""const SHELL = [
  '/habits/app',
  '/habits/auth',
  '/habits',
  // Спрайт — тем же адресом, что просят страницы (ICONS_V в server.js, 27.09.2026): иначе
  // установка качала бы отдельную копию без версии. Поднял ICONS_V — подними и здесь.
  '/assets/icons.svg?v=12',
  '/assets/logo.svg',
  '/habits.webmanifest',
  '/toast.js',"""),
 'web/public/assets/icons.svg': (173, r"""<symbol id="i-mail-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z"/><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"/></symbol>
<!-- Lucide star (01.10.2026, ADR-286 «Питание»): «В мои» в «Моих продуктах»; добавлен star, i-pushpin уже был выше («Закрепить»; i-pin — метка места на карте). Состояние «включено» показывает роль кнопки (.btn), не заливка значка. -->
<symbol id="i-star" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></symbol>
</svg>"""),
}
for rel, (start, text) in EX.items():
    p = os.path.join(HERE, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    # icons.svg на сервере кончается '</svg>' БЕЗ перевода строки (read_file не показывает пустой последней строки)
    tail = '' if rel.endswith('icons.svg') else '\n'
    open(p, 'w', encoding='utf-8').write('\n' * (start - 1) + text + tail)
    print(rel, 'start', start)
