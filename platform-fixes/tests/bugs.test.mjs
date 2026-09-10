/* Подтверждённые поломки. Каждый тест падает на текущем коде и позеленел бы на исправном.
   Исходники menu-pins.js / page-copy.js не менялись. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from './harness.mjs';

/* ───────────────────────── menu-pins.js ───────────────────────── */

test('P0-1 мусор в cf_pins_v1 роняет mount и обрывает загрузку сайдбара', () => {
  const cases = {
    'число в массиве': '{"portal":[42]}',
    'объект в массиве': '{"portal":[{"h":"/a"}]}',
    'true в массиве': '{"portal":[true]}',
    'href оканчивается обратным слэшем': '{"portal":["/a\\\\"]}'
  };
  const dead = [];
  for (const [name, raw] of Object.entries(cases)) {
    const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { storage: raw });
    H.loadPins(win);
    try {
      H.mountPortal(win);
    } catch (e) {
      const cap = doc.querySelector('.mp-cap');
      dead.push(`${name}: ${e.constructor.name}: ${String(e.message).slice(0, 60)}` +
        ` (в меню осталась пустая шапка «${cap && cap.textContent}», hidden=${cap && cap.hidden})`);
    }
    win.close();
  }
  assert.deepEqual(dead, [], 'mount обязан пережить любое содержимое localStorage, а он бросает исключение наружу:\n  ' + dead.join('\n  '));
});

test('P0-2 кабинет: удержание дольше 1.1 с закрывает шторку прямо во время закрепления', async () => {
  const { win, doc } = H.makeWin(H.cabHTML(), { storage: '{"cab:acme":[]}' });
  H.loadPins(win);
  const closes = H.installCabBurger(win);          // cab-burger.js из CONTEXT.md
  const api = H.mountCab(win);
  const a = doc.querySelector('a.cl-nav[href="/acme/docs"]');
  await H.longPress(win, a, { holdFor: 1200 });    // человек держит палец 1.2 с
  assert.deepEqual(H.arr(api.pins()), ['/acme/docs'], 'строка должна закрепиться');
  assert.equal(closes.length, 0,
    'suppressed() протухает через 500 мс после срабатывания удержания: click приходит позже, cab-burger.js считает его обычным тапом и захлопывает шторку');
  win.close();
});

test('P0-3 повторный mount() дублирует «Быстрый доступ» и вкладывает строки друг в друга', async () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { storage: '{"portal":[]}' });
  H.loadPins(win);
  H.mountPortal(win);
  H.mountPortal(win);                              // сайдбар перерисовался и inject() позвал mount ещё раз
  const nested = doc.querySelectorAll('.mp-row .mp-row').length;
  const quick = doc.querySelectorAll('.mp-quick').length;
  const caps = doc.querySelectorAll('.mp-cap').length;
  const edits = doc.querySelectorAll('.mp-edit-btn').length;
  await H.longPress(win, doc.querySelector('a.sb-link[href="/a"]'));
  assert.deepEqual(
    { nested, quick, caps, edits, toasts: win.__toasts.length },
    { nested: 0, quick: 1, caps: 1, edits: 1, toasts: 1 },
    'mount() не защищён от повторного вызова: строки заворачиваются в .mp-row второй раз, блоков «Быстрый доступ» и кнопок правки становится два, обработчики удержания дублируются'
  );
  win.close();
});

test('P1-4 два пальца: строка закрепляется сама через 0.6 с после того, как человек убрал руку', async () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b', '/c']]]), { storage: '{"portal":[]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  const A = doc.querySelector('a.sb-link[href="/a"]');
  const B = doc.querySelector('a.sb-link[href="/b"]');
  H.down(win, A, { pointerType: 'touch', pointerId: 1 });
  await H.sleep(80);
  H.down(win, B, { pointerType: 'touch', pointerId: 2 });   // второй палец лёг на меню
  await H.sleep(60);
  H.up(win, B, { pointerType: 'touch', pointerId: 2 });      // обе руки убрали, это был скролл
  H.up(win, A, { pointerType: 'touch', pointerId: 1 });
  await H.sleep(700);
  assert.deepEqual(H.arr(api.pins()), [],
    'второй pointerdown затирает переменную hold без clearTimeout: таймер первого пальца переживает pointerup и закрепляет строку уже после того, как экран отпущен (тосты: ' + JSON.stringify(win.__toasts) + ')');
  win.close();
});

test('P1-5 отменённый системой жест оставляет fired=true и съедает следующий клик', async () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { storage: '{"portal":[]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  await H.longPress(win, doc.querySelector('a.sb-link[href="/a"]'), { holdFor: 700, cancelInstead: true });
  const b = doc.querySelector('a.sb-link[href="/b"]');
  const nav = H.click(win, b);                               // Enter с клавиатуры: click без pointerdown
  const pinBtn = b.closest('.mp-row').querySelector('.mp-pin');
  H.click(win, pinBtn);                                      // и обычный тап по «Закрепить»
  assert.deepEqual(
    { переход: nav.defaultPrevented, pins: H.arr(api.pins()) },
    { переход: false, pins: ['/a', '/b'] },
    'после pointercancel флаг fired не сбрасывается (его чистят только pointerdown и съеденный click), поэтому следующий клик по меню гасится: ссылка не открывается, кнопка «Закрепить» не срабатывает'
  );
  win.close();
});

test('P1-6 перетаскивание не завершается по pointercancel: строка ездит за пальцем, которого нет', () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b', '/c']]]), { storage: '{"portal":["/a","/b","/c"]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  api.edit();
  const quick = doc.querySelector('.mp-quick');
  H.down(win, quick.children[0].querySelector('.mp-grip'), { pointerType: 'touch', clientY: 10 });
  H.cancel(win, doc, { pointerType: 'touch' });   // входящий звонок / системный жест
  H.move(win, doc, { clientY: 900 });             // палец давно снят
  assert.deepEqual(
    { порядок: H.hrefsIn(quick), залипшийКласс: !!doc.querySelector('.mp-drag'), сохранено: H.arr(H.pinsStored(win).portal) },
    { порядок: ['/a', '/b', '/c'], залипшийКласс: false, сохранено: ['/a', '/b', '/c'] },
    'dragEnd навешан только на pointerup: pointercancel не разбирает перетаскивание — строка продолжает переставляться на любое движение указателя и остаётся полупрозрачной (.mp-drag)'
  );
  win.close();
});

test('P1-7 после перерисовки группы открепление уносит строку из документа насовсем', () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b', '/c']]]), { storage: '{"portal":["/b"]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  const items = doc.getElementById('sb-items-0');
  items.replaceWith(items.cloneNode(true));    // сайдбар перерисовал группу, закреплённая строка была в quick
  api.toggle('/b');                            // человек жмёт «Открепить»
  assert.equal(!!doc.querySelector('a.sb-link[href="/b"]'), true,
    'row.mpHome держит жёсткую ссылку на прежний контейнер: если группу пересобрали, строка возвращается в узел, оторванный от документа, и исчезает из меню до перезагрузки (в группе осталось: ' + JSON.stringify(H.groupHrefs(win, 0)) + ')');
  win.close();
});

test('P2-8 дубликаты href в хранилище: «Открепить» показывает тост, но ничего не откручивает', () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { storage: '{"portal":["/a","/a"]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  const quick = doc.querySelector('.mp-quick');
  H.click(win, quick.children[0].querySelector('.mp-pin'));
  assert.deepEqual(
    { quick: H.hrefsIn(quick), pins: H.arr(api.pins()), тост: win.__toasts.at(-1) },
    { quick: [], pins: [], тост: 'Откреплено' },
    'pins не нормализуется: indexOf/splice убирают одну копию из двух, строка остаётся в «Быстром доступе», а человеку сказали «Откреплено»'
  );
  win.close();
});

test('P2-9 две строки с одним href: кнопка на одной строке утаскивает другую', () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G1', ['/a', '/dup']], ['G2', ['/dup', '/z']]]), { storage: '{"portal":[]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  const second = doc.querySelectorAll('a.sb-link[href="/dup"]')[1];    // строка из второй группы
  H.click(win, second.closest('.mp-row').querySelector('.mp-pin'));
  assert.equal(second.closest('.mp-quick') !== null, true,
    'rowOf() ищет строку по href через querySelector и всегда берёт первую в документе: нажали «Закрепить» во второй группе, а в «Быстрый доступ» уехала строка из первой (G1=' +
    JSON.stringify(H.groupHrefs(win, 0)) + ', G2=' + JSON.stringify(H.groupHrefs(win, 1)) + ', pins=' + JSON.stringify(H.arr(api.pins())) + ')');
  win.close();
});

test('P2-10 режим правки навсегда разворачивает свёрнутые группы', () => {
  const { win, doc } = H.makeWin(H.portalHTML());
  H.loadPins(win);
  H.installToggleGroup(win);                    // sbToggleGroup из CONTEXT.md
  const api = H.mountPortal(win);
  win.sbToggleGroup(1);                         // человек свернул группу
  const items = doc.getElementById('sb-items-1');
  assert.equal(items.classList.contains('collapsed'), true, 'предусловие: группа свёрнута');
  api.edit(); api.edit();                       // зашли в правку и вышли
  assert.deepEqual(
    { collapsed: items.classList.contains('collapsed'), inlineMaxHeight: items.style.maxHeight },
    { collapsed: true, inlineMaxHeight: '0px' },
    'setEdit(true) снимает .collapsed и прибивает style="max-height:none", а setEdit(false) ничего не возвращает: свёрнутые группы разворачиваются насовсем, а инлайновый max-height:none перебивает CSS-правило .collapsed и мешает свернуть их снова'
  );
  win.close();
});

test('P2-11 в режиме правки Enter по строке уводит со страницы', () => {
  const { win, doc } = H.makeWin(H.portalHTML());
  H.loadPins(win);
  const api = H.mountPortal(win);
  api.edit();
  const a = doc.querySelector('a.sb-link[href="/tasks"]');
  const e = H.click(win, a);                    // клавиатурный Enter на сфокусированной ссылке
  const обезврежена = e.defaultPrevented || a.tabIndex === -1 || a.getAttribute('aria-disabled') === 'true';
  assert.equal(обезврежена, true,
    'режим правки держится на одном CSS-правиле .mp-edit .mp-row>a{pointer-events:none}: с клавиатуры ссылка по-прежнему в фокусе и Enter выполняет переход вместо правки меню');
  win.close();
});

test('P2-12 приватный режим: «Закреплено» показано, хотя ничего не сохранилось', () => {
  const { win } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { brokenStorage: true });
  H.loadPins(win);
  const api = H.mountPortal(win);
  api.toggle('/a');
  const сохранено = win.localStorage.getItem('cf_pins_v1');
  assert.equal(сохранено !== null || !win.__toasts.includes('Закреплено в быстром доступе'), true,
    'writeAll() глотает QuotaExceededError молча: человек видит «Закреплено в быстром доступе», а после перезагрузки набор пуст (в хранилище ' + сохранено + ')');
  win.close();
});

test('P2-13 обычный тап сразу после удержания не закрывает шторку кабинета', async () => {
  const { win, doc } = H.makeWin(H.cabHTML(), { storage: '{"cab:acme":[]}' });
  H.loadPins(win);
  const closes = H.installCabBurger(win);
  H.mountCab(win);
  await H.longPress(win, doc.querySelector('a.cl-nav[href="/acme/docs"]'), { holdFor: 700 });
  const other = doc.querySelector('a.cl-nav[href="/acme/pay"]');
  H.down(win, other, { pointerType: 'touch' }); H.up(win, other, { pointerType: 'touch' }); H.click(win, other);
  assert.equal(closes.length, 1,
    'suppressed() гасит ЛЮБОЙ клик 500 мс после удержания, а не только тот, что породило удержание: человек закрепил строку и тут же перешёл по соседней — шторка осталась висеть поверх страницы');
  win.close();
});

test('P3-14 в режиме правки «Выход» и логотип кабинета перестают закрывать шторку', () => {
  const { win, doc } = H.makeWin(H.cabHTML(), { storage: '{"cab:acme":[]}' });
  H.loadPins(win);
  const closes = H.installCabBurger(win);
  const api = H.mountCab(win);
  api.edit();
  H.click(win, doc.getElementById('cab-logout'));
  H.click(win, doc.querySelector('a.logo'));
  assert.equal(closes.length, 2,
    'suppressed() возвращает true для всего, что лежит внутри .mp-edit, то есть для всего сайдбара: в режиме правки «Выход», «Тема» и логотип срабатывают, но шторка не закрывается');
  win.close();
});

test('P3-15 ручку перетаскивания невозможно взять с клавиатуры', () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { storage: '{"portal":["/a","/b"]}' });
  H.loadPins(win);
  H.mountPortal(win).edit();
  const grip = doc.querySelector('.mp-quick .mp-grip');
  assert.deepEqual(
    { tag: grip.tagName, tabIndex: grip.tabIndex, ariaHidden: grip.getAttribute('aria-hidden') },
    { tag: 'BUTTON', tabIndex: 0, ariaHidden: null },
    'порядок закреплённых меняется только перетаскиванием: ручка — это div с aria-hidden="true" и без tabindex, слушает лишь pointerdown, так что с клавиатуры и через скринридер порядок не поменять'
  );
  win.close();
});

test('P3-16 href с обратным слэшем: тост врёт про закрепление, строка не двигается', () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a\\b', '/ab']]]), { storage: '{"portal":[]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  api.toggle('/a\\b');
  assert.deepEqual(
    { pins: H.arr(api.pins()), quick: H.hrefsIn(doc.querySelector('.mp-quick')), тост: win.__toasts.at(-1) },
    { pins: ['/a\\b'], quick: ['/a\\b'], тост: 'Закреплено в быстром доступе' },
    'rowOf() клеит селектор строкой и экранирует только кавычки: обратный слэш в href остаётся CSS-экранированием, строка не находится, render() молча выкидывает её из pins — а тост уже сказал «Закреплено»'
  );
  win.close();
});

test('P3-17 10 000 записей в хранилище морозят монтирование почти на секунду', () => {
  const many = JSON.stringify({ portal: Array.from({ length: 10000 }, (_, i) => '/x' + i) });
  const { win } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { storage: many });
  H.loadPins(win);
  const t0 = Date.now();
  H.mountPortal(win);
  const ms = Date.now() - t0;
  assert.ok(ms < 100, 'render() на каждый чих делает по querySelector на каждую запись pins и никак не ограничивает их число: mount занял ' + ms + ' мс синхронно, столько же уйдёт на каждое закрепление');
  win.close();
});

/* ───────────────────────── page-copy.js ───────────────────────── */

test('P2-18 fetch(new URL(...)) теряет адрес в отчёте об упавших запросах', async () => {
  const { win } = H.makeWin(H.portalHTML());
  H.installFetch(win, () => Promise.resolve(H.makeRes(win, { ok: false, status: 500, body: 'boom' })));
  H.loadCopy(win);
  await win.fetch(new win.URL('https://ai.cashruflow.ru/api/leads?p=2'));
  await H.sleep(20);
  const line = H.lineWith(await H.grabCopy(win), '- GET');
  assert.match(line, /\/api\/leads/,
    'url берётся как input.url и работает только для строки и Request: у URL-объекта адрес undefined, в отчёт уезжает «' + line + '» — понять, что упало, невозможно');
  win.close();
});

test('P2-19 отменённый запрос попадает в «упавшие»', async () => {
  const { win } = H.makeWin(H.portalHTML());
  H.installFetch(win, () => { const e = new Error('The user aborted a request.'); e.name = 'AbortError'; return Promise.reject(e); });
  H.loadCopy(win);
  try { await win.fetch('/api/search?q=лиды'); } catch (e) {}
  const sec = H.section(await H.grabCopy(win), 'Неудачные запросы');
  assert.match(sec, /\(0\)/,
    'обёртка над fetch не отличает AbortError от обрыва: каждая отмена (набор в поиске, уход со страницы) ложится в отчёт как упавший запрос —\n' + sec);
  win.close();
});

test('P2-20 отказ navigator.clipboard не откатывается на execCommand — копия просто не выходит', async () => {
  const { win, doc } = H.makeWin(H.portalHTML());
  let exec = 0;
  doc.execCommand = () => { exec++; return true; };
  Object.defineProperty(win.navigator, 'clipboard', {
    configurable: true, value: { writeText: () => Promise.reject(new Error('Document is not focused')) }
  });
  H.loadCopy(win);
  win.cfCopyPage();
  await H.sleep(30);
  assert.deepEqual({ exec, toasts: win.__toasts }, { exec: 1, toasts: ['Страница скопирована для ИИ'] },
    'toClipboard() выбирает ветку по наличию navigator.clipboard, а не по результату: типовой отказ («документ не в фокусе», отозванное разрешение) даёт «Не удалось скопировать», хотя запасной путь через execCommand рядом и работает');
  win.close();
});

test('P3-21 счётчик в h1 утекает в заголовок и рвёт отчёт на строки', async () => {
  const { win, doc } = H.makeWin(H.portalHTML());
  doc.querySelector('h1').innerHTML = '\n  Задачи\n  <span class="h1n">(88)</span>\n';
  H.loadCopy(win);
  const txt = await H.grabCopy(win);
  const lines = txt.split('\n');
  const i = lines.findIndex((l) => l.startsWith('- Заголовок:'));
  const хвост = lines.slice(i + 1, i + 3).filter((l) => l.trim() && !l.startsWith('- ') && !l.startsWith('#'));
  assert.deepEqual({ строка: lines[i], лишнее: хвост }, { строка: '- Заголовок: Задачи (88)', лишнее: [] },
    'берётся h1.textContent целиком: счётчик из <span class="h1n"> и внутренние переводы строк уезжают в отчёт как есть — пункт «Заголовок» разваливается на несколько строк markdown, счётчик становится отдельным абзацем');
  win.close();
});

test('P3-22 многострочная ошибка со стеком разваливает список ошибок', async () => {
  const { win } = H.makeWin(H.portalHTML());
  H.loadCopy(win);
  win.dispatchEvent(new win.ErrorEvent('error', {
    message: 'TypeError: x is null\n    at f (app.js:10)\n    at g (app.js:20)',
    filename: 'https://ai.cashruflow.ru/app.js', lineno: 10
  }));
  const sec = H.section(await H.grabCopy(win), 'Ошибки консоли');
  const bad = sec.split('\n').slice(1).filter((l) => l && !l.startsWith('- '));
  assert.deepEqual(bad, [],
    'push() кладёт message как есть: перевод строки внутри сообщения превращается в обычный текст markdown, строки стека выпадают из списка и в отчёте «Ошибки консоли (1)» оказывается три абзаца —\n' + sec);
  win.close();
});
