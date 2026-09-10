/* Атаки, которые НЕ прошли: код устоял. Эти тесты зелёные — они и есть доказательство. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from './harness.mjs';

test('устояло: возврат строки на своё место в группе — 13 комбинаций закрепления/открепления', () => {
  const combos = [
    [['/b'], ['/b']], [['/a'], ['/a']], [['/e'], ['/e']],
    [['/b', '/c'], ['/c', '/b']], [['/b', '/c'], ['/b', '/c']],
    [['/a', '/b'], ['/b', '/a']], [['/d', '/e'], ['/e', '/d']],
    [['/a', '/b', '/c', '/d', '/e'], ['/e', '/d', '/c', '/b', '/a']],
    [['/a', '/b', '/c', '/d', '/e'], ['/a', '/b', '/c', '/d', '/e']],
    [['/a', '/e'], ['/a', '/e']], [['/a', '/c', '/e'], ['/c', '/a', '/e']],
    [['/e'], ['/e']], [['/c', '/d'], ['/d', '/c']]
  ];
  for (const [pin, unpin] of combos) {
    const { win } = H.makeWin(H.portalHTML([['G', ['/a', '/b', '/c', '/d', '/e']]]), { storage: '{"portal":[]}' });
    H.loadPins(win);
    const api = H.mountPortal(win);
    pin.forEach((h) => api.toggle(h));
    unpin.forEach((h) => api.toggle(h));
    assert.deepEqual(H.groupHrefs(win, 0), ['/a', '/b', '/c', '/d', '/e'],
      'порядок сломался на pin=' + JSON.stringify(pin) + ' unpin=' + JSON.stringify(unpin));
    win.close();
  }
});

test('устояло: тот же возврат на разметке без пробельных узлов (сайдбар собран из JS)', () => {
  const { win, doc } = H.makeWin('<!doctype html><html><body><nav id="app-sidebar"><div class="sb-nav"><div class="sb-items" id="sb-items-0"></div></div></nav></body></html>', { storage: '{"portal":[]}' });
  const items = doc.getElementById('sb-items-0');
  ['/a', '/b', '/c', '/d'].forEach((h) => { const a = doc.createElement('a'); a.className = 'sb-link'; a.href = h; a.textContent = h; items.appendChild(a); });
  H.loadPins(win);
  const api = win.MenuPins.mount({ scope: 'portal', root: doc.getElementById('app-sidebar'), list: doc.querySelector('.sb-nav'), linkSel: 'a.sb-link', mq: '(max-width:768px)' });
  for (const [pin, unpin] of [[['/b', '/c'], ['/c', '/b']], [['/a', '/b', '/c', '/d'], ['/d', '/c', '/b', '/a']], [['/d'], ['/d']]]) {
    pin.forEach((h) => api.toggle(h)); unpin.forEach((h) => api.toggle(h));
    assert.deepEqual(H.groupHrefs(win, 0), ['/a', '/b', '/c', '/d']);
  }
  win.close();
});

test('устояло: бейдж переживает закрепление и открепление, поллер продолжает находить ссылку', () => {
  const { win, doc } = H.makeWin(H.portalHTML(), { storage: '{"portal":[]}' });
  H.loadPins(win);
  const poll = H.installBadgePoller(win);
  const api = H.mountPortal(win);
  poll(7);
  api.toggle('/crm/chats');
  const link = doc.querySelector('#app-sidebar a[href="/crm/chats"]');
  assert.equal(link.closest('.mp-quick') !== null, true);
  assert.equal(link.querySelector('.sb-badge').textContent, '7');
  assert.equal(poll(3) !== null, true, 'поллер должен находить ссылку и в «Быстром доступе»');
  api.toggle('/crm/chats');
  assert.equal(doc.querySelector('#app-sidebar a[href="/crm/chats"] .sb-badge').textContent, '3');
});

test('устояло: умолчания не возвращаются после того, как их все открепили', () => {
  const { win } = H.makeWin(H.portalHTML());
  H.loadPins(win);
  const api = H.mountPortal(win);
  assert.deepEqual(H.arr(api.pins()), ['/crm/chats', '/crm/leads', '/notify']);
  H.arr(api.pins()).forEach((h) => api.toggle(h));
  const saved = H.pinsStored(win);
  assert.deepEqual(saved, { portal: [] });
  // «перезагрузка страницы» с тем же хранилищем
  const { win: w2 } = H.makeWin(H.portalHTML(), { storage: JSON.stringify(saved) });
  H.loadPins(w2);
  assert.deepEqual(H.arr(H.mountPortal(w2).pins()), []);
  win.close(); w2.close();
});

test('устояло: битое хранилище (не JSON, массив, строка вместо массива, null) не роняет меню', () => {
  for (const raw of ['ой', '[]', '["/a"]', '{"portal":"/a"}', '{"portal":[null,"/a"]}', '{"portal":[]}', 'null', '{']) {
    const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { storage: raw });
    H.loadPins(win);
    assert.doesNotThrow(() => H.mountPortal(win), 'упало на ' + raw);
    assert.equal(!!doc.querySelector('.mp-quick'), true);
    win.close();
  }
});

test('устояло: href с кавычкой, пробелом, скобкой, решёткой, фигурными скобками и кириллицей', () => {
  const hrefs = ['/a"b', '/раз дел', '/control{/:tab}', '/x(2)#top', '/sitemap.xml', '/medcard/sex'];
  const { win, doc } = H.makeWin(H.portalHTML([['G', hrefs]]), { storage: '{"portal":[]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  for (const h of hrefs) {
    api.toggle(h);
    assert.deepEqual(H.arr(api.pins()), [h], 'не закрепился href ' + h);
    assert.deepEqual(H.hrefsIn(doc.querySelector('.mp-quick')), [h]);
    api.toggle(h);
    assert.deepEqual(H.arr(api.pins()), []);
  }
  win.close();
});

test('устояло: отмена (undo) — плашка одна, откат возвращает ровно прежний набор', () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { storage: '{"portal":[]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  api.toggle('/a');
  api.toggle('/b');
  assert.equal(doc.querySelectorAll('.mp-undo').length, 1, 'старая плашка должна убираться');
  const plate = doc.querySelector('.mp-undo');
  H.click(win, plate.querySelector('.mp-undo-btn'));
  assert.deepEqual(H.arr(api.pins()), ['/a']);
  assert.deepEqual(H.pinsStored(win), { portal: ['/a'] });
  H.click(win, plate.querySelector('.mp-undo-btn'));   // повторное нажатие по уже убранной плашке
  assert.deepEqual(H.arr(api.pins()), ['/a'], 'второе «Отменить» не должно ничего менять');
  api.toggle('/a'); api.toggle('/a');
  H.click(win, doc.querySelector('.mp-undo .mp-undo-btn'));
  assert.deepEqual(H.arr(api.pins()), []);
  win.close();
});

test('устояло: мёртвый href из хранилища отбрасывается молча', () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { storage: '{"portal":["/удалённый","/a"]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  assert.deepEqual(H.arr(api.pins()), ['/a']);
  assert.deepEqual(H.hrefsIn(doc.querySelector('.mp-quick')), ['/a']);
  win.close();
});

test('устояло: сдвиг пальца больше 10 px отменяет удержание, мышь и ПК-ширина не закрепляют', async () => {
  const { win, doc } = H.makeWin(H.portalHTML([['G', ['/a', '/b']]]), { storage: '{"portal":[]}' });
  H.loadPins(win);
  const api = H.mountPortal(win);
  const A = doc.querySelector('a.sb-link[href="/a"]');
  H.down(win, A, { pointerType: 'touch', clientX: 10, clientY: 10 });
  H.move(win, A, { pointerType: 'touch', clientX: 10, clientY: 40 });   // прокрутка
  await H.sleep(700);
  assert.deepEqual(H.arr(api.pins()), [], 'прокрутка не должна закреплять');
  H.down(win, A, { pointerType: 'mouse' });
  await H.sleep(700);
  assert.deepEqual(H.arr(api.pins()), [], 'мышь не должна закреплять');
  win.__mobile = false;                                                  // ПК-ширина
  await H.longPress(win, A, { holdFor: 700 });
  assert.deepEqual(H.arr(api.pins()), [], 'на ПК удержание не должно закреплять');
  win.close();
});

test('устояло: page-copy — страница читает тело после неудачного ответа', async () => {
  const { win } = H.makeWin(H.portalHTML());
  H.installFetch(win, () => Promise.resolve(H.makeRes(win, { ok: false, status: 422, body: '{"err":"нет прав"}', textDelay: 15 })));
  H.loadCopy(win);
  const res = await win.fetch('/api/save');
  assert.deepEqual(await res.json(), { err: 'нет прав' });
  await H.sleep(40);
  assert.match(H.section(await H.grabCopy(win), 'Неудачные запросы'), /422/);
  win.close();
});

test('устояло: page-copy — 10 000 провалов не растят память, в отчёте ровно 12 записей', async () => {
  const { win } = H.makeWin(H.portalHTML());
  H.installFetch(win, () => Promise.resolve(H.makeRes(win, { ok: false, status: 404, body: 'no' })));
  H.loadCopy(win);
  for (let i = 0; i < 10000; i++) win.fetch('/api/i' + i);
  await H.sleep(80);
  const txt = await H.grabCopy(win);
  assert.equal((txt.match(/^- GET/gm) || []).length, 12);
  assert.match(txt, /## Неудачные запросы \(12\)/);
  win.close();
});

test('устояло: page-copy — about:blank, пустой title и пустой --ui-zoom не роняют сборку', async () => {
  const { win } = H.makeWin('<!doctype html><html><head></head><body></body></html>', { url: 'about:blank' });
  H.loadCopy(win);
  const txt = await H.grabCopy(win);
  assert.match(txt, /^# /);
  assert.match(txt, /масштаб 100%/);
  assert.match(txt, /## Ошибки консоли \(0\)/);
  win.close();
});

test('устояло: page-copy — Request-подобный объект и параметры адреса разбираются верно', async () => {
  const { win } = H.makeWin(H.portalHTML(), { url: 'https://ai.cashruflow.ru/crm/leads?p=2&q=%D0%B0%D0%B1%D0%B2#top' });
  H.installFetch(win, () => Promise.resolve(H.makeRes(win, { ok: false, status: 500, body: 'boom' })));
  H.loadCopy(win);
  await win.fetch({ url: 'https://ai.cashruflow.ru/api/x', method: 'POST' });
  await H.sleep(20);
  const txt = await H.grabCopy(win);
  assert.match(txt, /- POST https:\/\/ai\.cashruflow\.ru\/api\/x → 500 · boom/);
  assert.match(txt, /- p = 2/);
  assert.match(txt, /- q = абв/);
  assert.match(txt, /- #top/);
  win.close();
});
