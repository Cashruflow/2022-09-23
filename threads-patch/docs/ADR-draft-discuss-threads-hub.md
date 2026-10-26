---
# id: выдаст create_adr (номер руками не выбирать, в код не вписывать)
title: «Треды» — единый список обсуждений, чатов CRM и ленты Threads (/discuss), только чтение
status: Proposed
date: 2026-10-26
domain: ui
depends_on: [ADR-136, ADR-124, ADR-147, ADR-263, ADR-295, ADR-338]
---

## Контекст
Разговоры с клиентами и командой разбросаны: комментарии задач (/tasks), тикетов (/ticket), чаты
Telegram/WhatsApp/MAX (/crm/chats), посты Threads (/threads). Макет «Треды» (Claude Design, 26.10.2026)
просит один список «что нового и кто ждёт ответа» с превью справа на ПК.

## Решение
1. Страница `/discuss`, пункт меню «Треды» (РАБОТА, значок `i-messages-square`), раздел прав `discuss`
   (`roles.js SECTIONS`, `api: ["/api/discuss"]`). Адрес `/threads` занят постингом в Threads — не трогаем.
2. Модуль `web/discuss.js`: своё соединение с tasks.db **readonly**, миграций нет. Ручки:
   `GET /api/discuss/list?type=all|talks|feed|chats&q=&cursor=&limit=` и `GET /api/discuss/item?id=kind:id`.
   Единый формат строки `{kind, id, sub, ref, title, source, project, participants, last_text, last_author,
   last_at, unread, awaiting, replies, status, url, ext}`; курсор — (момент, ключ) в base64url.
3. Источники: `comments` (entity_type task|ticket) + `tasks`/`tickets`; `business_chats`/`business_messages`
   (тот же набор, что видит /crm/chats по умолчанию); посты Threads — из кэша `app.locals.threads.posts()`
   (threads.js, 10 мин, не блокирует); имя чата — `app.locals.chatDisplayName` (crm_chats.js), без копии.
4. Права: раздел discuss открывает ручки; каждый источник режется правом своего раздела (tasks, ticket,
   chats, threads) и областью own_projects (`scopeSql`; чаты и ленту роли с областью не отдаём).
5. Непрочитанное честно только у чатов (`unread_count`). У комментариев отметки «прочитал этот сотрудник»
   нет → `unread: null`, вместо него `awaiting` (последнее слово за клиентом). У постов — нет.
6. Ответ в тред не делается: «Открыть» ведёт в исходную карточку. Превью ничего не отмечает прочитанным.
7. Вид — компоненты платформы: шапка `.ph` (ADR-147), панель `.lt-one` + `ltBuild` (ADR-338), вкладки
   `.ui-tabs`, `.ui-st`, `.ui-badge`, `.ui-tiles.is-auto`, `.ui-empty`, шторка `.mdl-*` (<1100px).
   Своё — только строка треда `.dc-row` и раскладка «список + превью» (discuss.css, токены).

## Отличия от макета (осознанно)
Нет нижней панели и FAB «Новый тред» (плавающие кнопки — только док dock.js; создавать тред нечего);
нет капс-киккера «Работа» над H1 (запрещён ADR-147); активная вкладка — `.ui-tab.is-on`, а не инверсный
чип; заголовок — общая шапка `.ph`, не внутри карточки; поиск — «/», не Ctrl K (⌘K — поиск меню);
сегмент «Мои/Команда/Все», чип ⚡ и колокольчик в верхней полосе не делались; почта в список не входит.

## Последствия
- `ICONS_V` 30 → 31 (+`habits-sw.js` SHELL), `sidebar.js?v=` во всех подключениях.
- Почта (mail_inbox) — следующим шагом, когда mail_inbound.js отдаст наружу свои флаги (удалено/архив) и
  `unreadCounts()`; копию этой логики в discuss.js не заводим.
- Непрочитанные обсуждения — только после отдельного решения о таблице «прочтений» (миграция, вне этого ADR).
- Строка треда `.dc-row` — кандидат в мобильный кит (M-81) по ADR-295.
