# Что это за код и как он реально запускается

Мобильное меню платформы ai.cashruflow.ru. Два новых модуля лежат рядом:

- `menu-pins.js` — `window.MenuPins`, закрепление строк меню в блок «Быстрый доступ».
- `page-copy.js` — `window.cfCopyPage()`, копирование данных страницы в буфер.

Оба подключаются из `sidebar.js` (портал) и `cab-sidebar.js` (кабинет клиента) —
эти файлы целиком сюда не скопированы, ниже точные выдержки из них.

## Как портал вызывает MenuPins (sidebar.js, внутри inject())

```js
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
```

## Как кабинет вызывает MenuPins (cab-sidebar.js)

```js
const api = window.MenuPins.mount({
  scope: 'cab:' + TEN,           // TEN — slug кабинета из адреса /<slug>/<page>
  root: sb,                      // .cl-sb — он же и список
  list: sb,
  before: sb.querySelector('a.cl-nav[href]'),
  linkSel: 'a.cl-nav[href]',
  mq: '(max-width:820px)'
});
const ed = document.getElementById('cab-pins-edit');
if (api && ed) ed.onclick = () => {
  const on = api.edit();
  ed.classList.toggle('active', on);
  ed.lastChild.textContent = on ? 'Готово' : 'Правка меню';
};
```

## Разметка портала, на которую всё это садится

`#app-sidebar` (nav) → `.sb-nav` (прокрутка) → на каждую группу пара узлов:

```html
<div class="sb-group" onclick="sbToggleGroup(0)"><span>РАБОТА</span><span class="sb-arrow">▾</span></div>
<div class="sb-items" id="sb-items-0">
  <a class="sb-link" href="/notify"><svg class="ico">…</svg>Уведомления</a>
  <a class="sb-link active" href="/tasks">…</a>
  …
</div>
```

Групп 8, пунктов 55. Ссылки строятся из массива MENU; href вида `/notify`, `/crm/leads`,
`/projects/crm`, `/sitemap.xml`, `/medcard/sex`, `/b24/fields`, `/control{/:tab}` → `/control`.

## Разметка кабинета

`.cl-sb` (div) → прямые дети: `<a class="logo" href="/<slug>">`, потом строки
`<a class="cl-nav" href="/<slug>/crm">…</a>`, потом служебные:
`<a class="cl-nav" id="cab-set" href="/<slug>/set">`, `<div class="cl-nav" id="cab-pins-edit">`,
`<a class="cl-nav" id="cab-theme">` (БЕЗ href), `<a class="cl-nav" id="cab-logout">` (БЕЗ href).

## Чужой код, который трогает те же узлы

1. Поллеры sidebar.js вешают бейджи, находя ссылку ПО АДРЕСУ, и делают это по таймеру
   (20–180 с) и при возврате на вкладку:
   ```js
   const link = document.querySelector('#app-sidebar a[href="/crm/chats"]');
   let b = link.querySelector('.sb-badge');
   if (d.unread > 0) { if (!b) { b = document.createElement('span'); b.className='sb-badge'; link.appendChild(b); } … }
   else if (b) b.remove();
   ```
2. `sbToggleGroup(gi)` сворачивает группу и меряет высоту:
   ```js
   const items = document.getElementById('sb-items-'+gi);
   const collapsed = items.classList.toggle('collapsed');
   if (!collapsed) { items.style.maxHeight = items.scrollHeight + 'px'; … }
   ```
3. `sidebar.js` закрывает мобильную шторку по клику на пункте (фаза всплытия):
   ```js
   document.addEventListener('click', e => {
     if (window.innerWidth > 768) return;
     const a = e.target.closest && e.target.closest('#app-sidebar a');
     if (a) window.sbMenu(false);
   });
   ```
4. `cab-burger.js` закрывает шторку кабинета в фазе ПЕРЕХВАТА на document:
   ```js
   document.addEventListener('click', function (e) {
     if (window.innerWidth > BP) return;
     var el = sb();
     if (!el || !el.contains(e.target)) return;
     if (window.MenuPins && window.MenuPins.suppressed(e.target)) return;
     if (e.target.closest('.cl-nav, a')) open(false);
   }, true);
   ```
5. `normIcons()` в sidebar.js на КАЖДУЮ вставку узла (MutationObserver на documentElement)
   правит svg с `use[href*="#i-"]` для i-trash|i-del|i-edit|i-copy|i-show|i-hide:
   снимает атрибут style у svg, добавляет класс, чистит inline-color у родителя.
6. `ui-scale.js` меняет `--ui-zoom` и вставляет свой виджет в `.sb-foot`.
7. Кнопки платформы: класс `.ibtn` красится глобальным CSS с `!important`
   (`width:auto !important; height:auto !important`).

## Что модули обещают

- Закреплённая строка ПЕРЕЕЗЖАЕТ в «Быстрый доступ», а не копируется; при откреплении
  возвращается на своё прежнее место в своей группе.
- Мёртвый href (раздела больше нет) отбрасывается молча.
- Набор свой на устройство, ключ localStorage `cf_pins_v1`, формат `{scope: [href, …]}`.
- Удержание 600 мс закрепляет; сдвиг пальца >10 px отменяет жест; после сработавшего
  удержания переход по ссылке НЕ происходит.
- В режиме правки клик по строке не ведёт по ссылке, группы раскрываются.
- Порядок закреплённых меняется перетаскиванием за ручку и сохраняется.
- «Копия для ИИ» кладёт в буфер адрес с параметрами, версию, окружение, ошибки консоли
  и упавшие запросы; обёртка над fetch не ломает чтение тела ответа страницей.
