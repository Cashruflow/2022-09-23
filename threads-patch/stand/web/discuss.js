// web/discuss.js — раздел «Треды» (/discuss, 26.10.2026): обсуждения задач и тикетов, чаты CRM и
// лента Threads одним списком. Макет — «Треды» (Claude Design, 26.10.2026).
//
// ТОЛЬКО ЧТЕНИЕ. Своё соединение с tasks.db открыто readonly: модуль не пишет в базу ни строки,
// таблиц и колонок не заводит (миграций нет). Ответ в тред здесь НЕ делается — кнопка «Открыть»
// ведёт в исходную сущность (/tasks?id=, /ticket?id=, /crm/chats?chat=, пост в Threads).
//
// Адрес /threads занят постингом в Threads (threads.js), поэтому раздел живёт на /discuss.
//
// API (портал, ppass; раздел discuss в roles.js):
//   GET /api/discuss/list?type=all|talks|feed|chats&q=&cursor=&limit=
//       → { ok, items:[Item], next_cursor, counts:{all,talks,feed,chats}, unread:{chats}, awaiting, feed_state, access }
//   GET /api/discuss/item?id=task:662|ticket:318|chat:81|post:<id>
//       → { ok, item: Item + { tiles:[{l,v,s}], messages:[Msg], total } }
//   Item = { kind:'talk'|'chat'|'feed', id, sub, ref, title, source, project, participants:[{name,role}],
//            last_text, last_author, last_at (ISO, UTC), unread (число или null), awaiting, replies, status, url, ext }
//
// ПРАВА. Раздел discuss открывает страницу и ручки. Каждый источник ДОПОЛНИТЕЛЬНО режется правом
// своего раздела (allowed(role, key) из roles.js): задачи — tasks, тикеты — ticket, чаты — chats,
// лента — threads. Роль с областью own_projects (req.cfScope) видит только задачи и тикеты своих
// проектов (scopeSql); чаты и ленту ей не отдаём вовсе (их ручки закрыты ей и в role_scope.js).
//
// НЕПРОЧИТАННОЕ. Честно считается только у чатов: business_chats.unread_count (его сбрасывает открытие
// диалога на /crm/chats — GET …/messages без since/before). У комментариев задач и тикетов отметки
// «прочитал этот сотрудник» нет, поэтому unread = null, а вместо него awaiting — последнее слово за
// клиентом (author_type <> 'admin'). У постов Threads непрочитанного нет вовсе.
//
// Ожидаемые отказы — 4xx (403 нет права, 422 неверный запрос/запись исчезла), не 404/5xx:
// page-err.js заводит в /issues только 5xx и 404.
import Database from "better-sqlite3";
import * as TS from "./task_status.js";
import { labelMap, colorMap } from "./status_path.js";
import { ST_RU as TICKET_ST_RU } from "./tickets.js";
import { parseItems } from "./checklist_log.js";

const DB_PATH = process.env.STAND_DB;
const TYPES = ["all", "talks", "feed", "chats"];
const LIMIT_DEF = 30, LIMIT_MAX = 60, MSG_MAX = 40, Q_MAX = 100;
const CH_LBL = { tg: "Telegram", wa: "WhatsApp", max: "MAX" };
const MEDIA_LBL = { voice: "Голосовое сообщение", audio: "Аудио", photo: "Фото", video: "Видео",
  video_note: "Видеосообщение", document: "Файл", sticker: "Стикер", animation: "GIF", contact: "Контакт", location: "Место" };

const iso = s => (s ? String(s).replace(" ", "T") + "Z" : null);          // 'YYYY-MM-DD HH:MM:SS' (UTC) → ISO
const sqlTs = ms => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const chanOf = src => { const s = String(src || "").toLowerCase(); return s === "whatsapp" ? "wa" : (s === "max" || s === "max_user") ? "max" : "tg"; };
const own = (o, k) => o != null && Object.hasOwn(o, k);

export function mountDiscuss(app, deps) {
  const { pauth, scopeSql, roleOf, allowed } = deps;
  let db = null;
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("busy_timeout = 3000");
    db.function("lower_ru", s => String(s == null ? "" : s).toLowerCase()); // кириллица без регистра — только так (ADR-162)
  } catch (e) { console.error("[discuss] tasks.db (readonly):", e.message); }

  app.get("/discuss", (req, res) => res.sendFile(process.env.STAND_HTML));

  // ---------- права источников ----------
  function access(req) {
    let role = "owner";
    try { role = roleOf(req).role; } catch (e) { /* без сотрудника — владелец (ADR-164) */ }
    const can = k => { try { return !!allowed(role, k); } catch (e) { return false; } };
    const scoped = Array.isArray(req.cfScope);
    return { task: can("tasks"), ticket: can("ticket"), chats: can("chats") && !scoped, feed: can("threads") && !scoped };
  }

  // ---------- курсор: «момент последней активности + ключ» строки, после которой продолжать ----------
  function cursorIn(raw) {
    if (!raw) return null;
    try {
      const c = JSON.parse(Buffer.from(String(raw), "base64url").toString("utf8"));
      if (!c || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(c.t)) || typeof c.k !== "string") return undefined;
      return { t: c.t, k: c.k.slice(0, 80) };
    } catch (e) { return undefined; }
  }
  const cursorOut = it => Buffer.from(JSON.stringify({ t: it._t, k: it._k }), "utf8").toString("base64url");
  const before = (it, c) => !c || it._t < c.t || (it._t === c.t && it._k < c.k);
  const byRecent = (a, b) => (a._t < b._t ? 1 : a._t > b._t ? -1 : a._k < b._k ? 1 : a._k > b._k ? -1 : 0);

  // ---------- обсуждения: задачи и тикеты (общая таблица comments) ----------
  const TALK = {
    task: { table: "tasks", title: "t.task", label: "Задача", url: id => "/tasks?id=" + id },
    ticket: { table: "tickets", title: "t.title", label: "Тикет", url: id => "/ticket?id=" + id },
  };
  // Сводка по сущности из comments + сама сущность. Параметры: позиционные «?» — только область scopeSql
  // (они идут первыми), остальное — именованные (@q, @ct); better-sqlite3 принимает оба вида в одном вызове.
  function talkSql(et, req, q, c, oid) {
    const T = TALK[et];
    const sc = scopeSql(req, "t.project_id");
    // поиск: название, номер, проект и тексты/авторы комментариев сущности
    const qs = q ? " AND (instr(lower_ru(COALESCE(" + T.title + ",'') || ' ' || t.id || ' ' || COALESCE(pr.name,'') || ' ' || COALESCE(t.client_slug,'')), lower_ru(@q)) > 0"
      + " OR EXISTS (SELECT 1 FROM comments q2 WHERE q2.entity_type='" + et + "' AND q2.entity_id=t.id AND q2.deleted=0"
      + " AND instr(lower_ru(COALESCE(q2.text,'') || ' ' || COALESCE(q2.author_name,'')), lower_ru(@q)) > 0))" : "";
    const named = Object.assign({}, q ? { q } : {}, c ? { ct: c.t } : {}, oid ? { oid } : {});
    return {
      from: `FROM (SELECT entity_id, MAX(id) last_id, MAX(created_at) last_at, COUNT(*) n
                   FROM comments WHERE entity_type='${et}' AND deleted=0 GROUP BY entity_id) a
             JOIN ${T.table} t ON t.id = a.entity_id
             LEFT JOIN projects pr ON pr.id = t.project_id
             WHERE 1=1${sc.sql}${qs}${oid ? " AND t.id=@oid" : ""}`,
      cur: c ? " AND datetime(a.last_at) <= @ct" : "",
      args: Object.keys(named).length ? [...sc.args, named] : [...sc.args],
    };
  }
  function talkCount(et, req, q) {
    const s = talkSql(et, req, q, null);
    return db.prepare("SELECT COUNT(*) n " + s.from).get(...s.args).n;
  }
  function talkAwaitingCount(et, req) {
    const s = talkSql(et, req, "", null);
    return db.prepare("SELECT COUNT(*) n " + s.from + " AND (SELECT COALESCE(author_type,'admin') FROM comments WHERE id=a.last_id) <> 'admin'").get(...s.args).n;
  }
  const peopleOf = {};
  // oid — одна сущность (превью справа): та же сводка, что у строки списка.
  function talkList(et, req, q, c, lim, oid) {
    const T = TALK[et];
    const s = talkSql(et, req, q, c, oid);
    const rows = db.prepare(`SELECT t.id, ${T.title} title, t.status, t.project_id, t.client_slug, pr.name project_name,
        datetime(a.last_at) last_at, a.n replies, a.last_id
        ${s.from}${s.cur}
        ORDER BY datetime(a.last_at) DESC, t.id DESC LIMIT ${lim}`).all(...s.args);
    if (!rows.length) return [];
    const lastQ = db.prepare("SELECT text, author_type, author_name FROM comments WHERE id=?");
    const ppl = peopleOf[et] || (peopleOf[et] = db.prepare(`SELECT author_name, author_type FROM comments
      WHERE entity_type='${et}' AND entity_id=? AND deleted=0 AND COALESCE(author_name,'')<>''
      GROUP BY author_name ORDER BY MAX(id) DESC LIMIT 3`));
    const tkLbl = et === "ticket" ? labelMap("ticket_status", TICKET_ST_RU) : null;
    const tkClr = et === "ticket" ? colorMap("ticket_status", {}) : null;
    return rows.map(r => {
      const lc = lastQ.get(r.last_id) || {};
      const status = et === "task"
        ? { code: r.status || "", label: TS.labelOf(r.status), color: TS.colorOf(r.status), group: TS.groupOf(r.status) }
        : { code: r.status || "", label: own(tkLbl, r.status) ? tkLbl[r.status] : (r.status || ""), color: own(tkClr, r.status) ? tkClr[r.status] : "" };
      return {
        kind: "talk", sub: et, id: et + ":" + r.id, ref: et === "task" ? "#" + r.id : "TIC-" + r.id,
        title: r.title || (T.label + " " + r.id), source: T.label, project: r.project_name || r.client_slug || "",
        project_id: r.project_id || null,
        participants: ppl.all(r.id).map(p => ({ name: p.author_name, role: p.author_type === "admin" ? "team" : "client" })),
        last_text: str(lc.text, 240), last_author: lc.author_name || (lc.author_type === "admin" ? "" : "Клиент"),
        last_at: iso(r.last_at), unread: null, awaiting: !!lc.author_type && lc.author_type !== "admin",
        replies: r.replies, status, url: T.url(r.id), ext: false,
        _t: r.last_at || "", _k: et + ":" + String(r.id).padStart(9, "0"),
      };
    });
  }

  // ---------- чаты CRM (Telegram / WhatsApp / MAX) ----------
  // Тот же набор, что видит /crm/chats по умолчанию: не архив, не заблокированные, группы — только подключённые.
  const CHAT_BASE = `COALESCE(c.is_archived,0)=0 AND COALESCE(c.is_ignored,0)=0
    AND (COALESCE(c.chat_type,'user')<>'group' OR COALESCE(c.is_enabled,1)=1)`;
  const chatQ = q => q ? ` AND (instr(lower_ru(COALESCE(c.client_name,'') || ' ' || COALESCE(c.custom_name,'') || ' ' ||
      COALESCE(c.client_username,'') || ' ' || COALESCE(l.name,'') || ' ' || COALESCE(l.last_name,'') || ' ' || COALESCE(pr.name,'')), lower_ru(@q)) > 0
    OR EXISTS (SELECT 1 FROM business_messages m WHERE m.business_chat_id=c.id AND m.deleted_at IS NULL
      AND instr(lower_ru(COALESCE(m.text,'')), lower_ru(@q)) > 0))` : "";
  const CHAT_FROM = `FROM business_chats c
    LEFT JOIN business_connections k ON k.business_connection_id = c.business_connection_id
    LEFT JOIN crm_leads l ON l.id = c.crm_lead_id
    LEFT JOIN projects pr ON pr.id = c.project_id`;
  function chatCount(q) {
    return db.prepare(`SELECT COUNT(*) n ${CHAT_FROM} WHERE ${CHAT_BASE}${chatQ(q)}`).get(q ? { q } : {}).n;
  }
  function chatUnread() {
    // число диалогов с непрочитанным и сумма сообщений — то же поле, что у бейджа «Чаты» в меню
    const r = db.prepare(`SELECT COUNT(*) chats, COALESCE(SUM(c.unread_count),0) msgs
      FROM business_chats c WHERE ${CHAT_BASE} AND COALESCE(c.unread_count,0) > 0`).get();
    return r || { chats: 0, msgs: 0 };
  }
  function chatAwaitingCount() {
    return db.prepare(`SELECT COUNT(*) n FROM business_chats c WHERE ${CHAT_BASE}
      AND (SELECT m.direction FROM business_messages m WHERE m.business_chat_id=c.id AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT 1)='in'`).get().n;
  }
  function mediaText(type, text) {
    const t = String(text || "").trim();
    if (t) return t;
    return own(MEDIA_LBL, type) ? MEDIA_LBL[type] : (type && type !== "text" ? "Вложение" : "");
  }
  function chatTitle(r) {
    const fn = app.locals.chatDisplayName;   // одна функция имени чата на платформу (crm_chats.js)
    let n = "";
    try { if (typeof fn === "function") n = fn(r, r.crm_lead_id ? { name: r.lead_name, last_name: r.lead_last_name } : null); } catch (e) {}
    return n || r.client_name || (r.client_username ? "@" + String(r.client_username).replace(/^@+/, "") : "Чат " + r.id);
  }
  function chatList(q, c, lim, oid) {
    const rows = db.prepare(`SELECT c.id, c.client_name, c.custom_name, c.name_src, c.client_username, c.crm_lead_id, c.chat_type,
        c.unread_count, c.project_id, k.source conn_source, l.name lead_name, l.last_name lead_last_name, pr.name project_name,
        datetime(COALESCE(c.last_message_at, c.created_at)) last_at,
        (SELECT COUNT(*) FROM business_messages m WHERE m.business_chat_id=c.id AND m.deleted_at IS NULL) msgs,
        (SELECT m.id FROM business_messages m WHERE m.business_chat_id=c.id AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT 1) last_mid
      ${CHAT_FROM} WHERE ${CHAT_BASE}${chatQ(q)}${c ? " AND datetime(COALESCE(c.last_message_at, c.created_at)) <= @ct" : ""}${oid ? " AND c.id=@oid" : ""}
      ORDER BY datetime(COALESCE(c.last_message_at, c.created_at)) DESC, c.id DESC LIMIT ${lim}`)
      .all(Object.assign({}, q ? { q } : {}, c ? { ct: c.t } : {}, oid ? { oid } : {}));
    const lastQ = db.prepare("SELECT direction, text, message_type, sender_name FROM business_messages WHERE id=?");
    return rows.map(r => {
      const m = r.last_mid ? (lastQ.get(r.last_mid) || {}) : {};
      const ch = chanOf(r.conn_source);
      const body = mediaText(m.message_type, m.text);
      const title = chatTitle(r);
      return {
        kind: "chat", sub: ch, id: "chat:" + r.id, ref: "", title, source: CH_LBL[ch],
        project: r.project_name || "", project_id: r.project_id || null,
        participants: [{ name: title, role: "client" }],
        last_text: str(m.direction === "out" ? "Вы: " + body : (r.chat_type === "group" && m.sender_name ? m.sender_name + ": " : "") + body, 240),
        last_author: m.direction === "out" ? "Вы" : (m.sender_name || title), media: !String(m.text || "").trim() ? (m.message_type || "") : "",
        last_at: iso(r.last_at), unread: +r.unread_count || 0, awaiting: m.direction === "in",
        replies: r.msgs, status: null, url: "/crm/chats?chat=" + r.id, ext: false,
        _t: r.last_at || "", _k: "chat:" + String(r.id).padStart(9, "0"),
      };
    });
  }

  // ---------- лента Threads: кэш постов threads.js (app.locals.threads.posts), без своих запросов в Meta ----------
  function feedSnap() {
    const T = app.locals.threads;
    if (!T || typeof T.posts !== "function") return { state: "off", items: [] };
    let s = null;
    try { s = T.posts(); } catch (e) { s = null; }
    if (!s) return { state: "loading", items: [] };           // первый запрос — кэш ещё собирается в фоне
    return { state: s.state || (s.ok ? "ok" : "error"), items: Array.isArray(s.items) ? s.items : [], username: s.username || "" };
  }
  function feedItems(snap, q) {
    const ql = String(q || "").toLowerCase();
    return snap.items.map(p => {
      const ms = Date.parse(p.timestamp || "");
      if (!isFinite(ms) || !p.id) return null;
      const at = sqlTs(ms);
      const name = p.username || snap.username || "";
      return {
        kind: "feed", sub: "threads", id: "post:" + String(p.id).replace(/[^\w-]/g, ""), ref: "", title: name ? "@" + name : "Threads",
        source: "Threads", project: "", project_id: null, participants: name ? [{ name: "@" + name, role: "team" }] : [],
        last_text: str(p.text, 400), last_author: name ? "@" + name : "", media: p.media_type && p.media_type !== "TEXT_POST" ? String(p.media_type).toLowerCase() : "",
        last_at: iso(at), unread: null, awaiting: false, replies: null, status: null,
        url: /^https:\/\/(www\.)?threads\.(net|com)\//.test(String(p.permalink || "")) ? String(p.permalink) : "/threads", ext: true,
        _t: at, _k: "post:" + String(p.id),
      };
    }).filter(it => it && (!ql || (it.last_text + " " + it.title).toLowerCase().includes(ql)));
  }

  // ---------- GET /api/discuss/list ----------
  app.get("/api/discuss/list", (req, res) => {
    if (!pauth(req, res)) return;
    if (!db) return res.status(503).json({ ok: false, error: "База недоступна на чтение — смотри лог [discuss]" });
    const type = str(req.query.type, 10) || "all";
    if (!TYPES.includes(type)) return res.status(422).json({ ok: false, error: "type: all | talks | feed | chats", code: "bad_type" });
    const c = cursorIn(req.query.cursor);
    if (c === undefined) return res.status(422).json({ ok: false, error: "Неверный cursor — начни список заново", code: "bad_cursor" });
    const q = str(req.query.q, Q_MAX);
    const lim = Math.min(Math.max(parseInt(req.query.limit, 10) || LIMIT_DEF, 1), LIMIT_MAX);
    const A = access(req);
    try {
      const want = k => type === "all" || type === k;
      let pool = [];
      const snap = A.feed ? feedSnap() : { state: "no_access", items: [] };
      if (want("talks")) {
        if (A.task) pool = pool.concat(talkList("task", req, q, c, lim + 1));
        if (A.ticket) pool = pool.concat(talkList("ticket", req, q, c, lim + 1));
      }
      if (want("chats") && A.chats) pool = pool.concat(chatList(q, c, lim + 1));
      if (want("feed") && A.feed) pool = pool.concat(feedItems(snap, q));
      pool = pool.filter(it => before(it, c)).sort(byRecent);
      const page = pool.slice(0, lim);
      const more = pool.length > lim;
      // Счётчики чипов — от поиска, но НЕ от выбранного чипа и курсора (правило ui.md «Фильтры… два числа»).
      const counts = {
        talks: (A.task ? talkCount("task", req, q) : 0) + (A.ticket ? talkCount("ticket", req, q) : 0),
        chats: A.chats ? chatCount(q) : 0,
        feed: A.feed ? feedItems(snap, q).length : 0,
      };
      counts.all = counts.talks + counts.chats + counts.feed;
      const un = A.chats ? chatUnread() : { chats: 0, msgs: 0 };
      const awaiting = (A.task ? talkAwaitingCount("task", req) : 0) + (A.ticket ? talkAwaitingCount("ticket", req) : 0) + (A.chats ? chatAwaitingCount() : 0);
      res.json({
        ok: true, type, q,
        items: page.map(({ _t, _k, ...it }) => it),
        next_cursor: more && page.length ? cursorOut(page[page.length - 1]) : null,
        counts, unread: { chats: un.chats || 0, messages: un.msgs || 0 }, awaiting,
        feed_state: snap.state, access: A,
      });
    } catch (e) {
      console.error("[discuss] list:", e.message);
      res.status(500).json({ ok: false, error: "Список не собрался: " + e.message });
    }
  });

  // ---------- GET /api/discuss/item — превью справа (только чтение; прочитанным НЕ отмечает) ----------
  app.get("/api/discuss/item", (req, res) => {
    if (!pauth(req, res)) return;
    if (!db) return res.status(503).json({ ok: false, error: "База недоступна на чтение — смотри лог [discuss]" });
    const m = /^(task|ticket|chat|post):([\w-]{1,40})$/.exec(String(req.query.id || ""));
    if (!m) return res.status(422).json({ ok: false, error: "id: task:N | ticket:N | chat:N | post:ID", code: "bad_id" });
    const [, kind, rawId] = m;
    const A = access(req);
    const deny = () => res.status(403).json({ ok: false, error: "Раздел источника закрыт для вашей роли", code: "no_access" });
    const gone = () => res.status(422).json({ ok: false, error: "Запись не найдена — её удалили или она вне вашей области", code: "gone" });
    try {
      if (kind === "task" || kind === "ticket") {
        if (!A[kind]) return deny();
        const id = parseInt(rawId, 10);
        if (!(id > 0)) return res.status(422).json({ ok: false, error: "Номер записи — число", code: "bad_id" });
        const sc = scopeSql(req, "t.project_id");
        const T = TALK[kind];
        const row = db.prepare(`SELECT t.*, pr.name project_name FROM ${T.table} t LEFT JOIN projects pr ON pr.id=t.project_id WHERE t.id=?${sc.sql}`).get(id, ...sc.args);
        if (!row) return gone();
        const total = db.prepare("SELECT COUNT(*) n FROM comments WHERE entity_type=? AND entity_id=? AND deleted=0").get(kind, id).n;
        const today = db.prepare("SELECT COUNT(*) n FROM comments WHERE entity_type=? AND entity_id=? AND deleted=0 AND date(created_at)=date('now')").get(kind, id).n;
        const msgs = db.prepare(`SELECT id, author_type, author_name, text, visibility, datetime(created_at) at FROM comments
          WHERE entity_type=? AND entity_id=? AND deleted=0 ORDER BY id DESC LIMIT ${MSG_MAX}`).all(kind, id).reverse();
        const base = talkList(kind, req, "", null, 1, id)[0]
          || { kind: "talk", sub: kind, id: kind + ":" + id, ref: kind === "task" ? "#" + id : "TIC-" + id, title: kind === "task" ? row.task : row.title,
               source: T.label, project: row.project_name || row.client_slug || "", participants: [], last_text: "", last_at: iso(row.updated_at || row.created_at),
               unread: null, awaiting: false, replies: 0, status: null, url: T.url(id), ext: false };
        delete base._t; delete base._k;
        const tiles = [{ l: "Ответов", v: total, s: today ? "+" + today + " сегодня" : "" }];
        if (kind === "task") {
          const it = parseItems(row.comment || "").filter(x => !x.cancelled);
          if (it.length) tiles.push({ l: "Чек-лист", v: it.filter(x => x.done).length + "/" + it.length, s: "пунктов" });
          const fm = +row.fact_min || 0;
          tiles.push({ l: "Время", v: Math.floor(fm / 60) ? Math.floor(fm / 60) + " ч " + (fm % 60) : String(fm), s: "мин" });
          if (row.deadline) tiles.push({ l: "Срок", v: String(row.deadline).slice(8, 10) + "." + String(row.deadline).slice(5, 7), s: "", date: String(row.deadline).slice(0, 10) });
        } else {
          tiles.push({ l: "Единиц", v: Math.round((+row.minutes || 0) / 15), s: "по 15 мин" });
          tiles.push({ l: "Создан", v: String(row.created_at || "").slice(8, 10) + "." + String(row.created_at || "").slice(5, 7), s: "", date: String(row.created_at || "").slice(0, 10) });
        }
        return res.json({ ok: true, item: Object.assign(base, {
          tiles, total,
          messages: msgs.map(x => ({ id: x.id, author: x.author_name || (x.author_type === "admin" ? "Команда" : "Клиент"),
            role: x.author_type === "admin" ? "team" : "client", internal: x.visibility === "internal", text: String(x.text || ""), at: iso(x.at) })),
        }) });
      }
      if (kind === "chat") {
        if (!A.chats) return deny();
        const id = parseInt(rawId, 10);
        if (!(id > 0)) return res.status(422).json({ ok: false, error: "Номер чата — число", code: "bad_id" });
        const base = chatList("", null, 1, id)[0];
        if (!base) return gone();
        delete base._t; delete base._k;
        const msgs = db.prepare(`SELECT m.id, m.direction, m.text, m.message_type, m.sender_name, m.transcript, datetime(m.created_at) at,
            (SELECT name FROM staff WHERE id=m.author_id) author_name
          FROM business_messages m WHERE m.business_chat_id=? AND m.deleted_at IS NULL AND COALESCE(m.hidden_local,0)=0
          ORDER BY m.created_at DESC, m.id DESC LIMIT ${MSG_MAX}`).all(id).reverse();
        const tiles = [
          { l: "Сообщений", v: base.replies, s: "" },
          { l: "Непрочитано", v: base.unread, s: "" },
          { l: "Канал", v: base.source, s: "" },
        ];
        if (base.project) tiles.push({ l: "Проект", v: base.project, s: "" });
        return res.json({ ok: true, item: Object.assign(base, {
          tiles, total: base.replies,
          messages: msgs.map(x => ({ id: x.id, author: x.direction === "out" ? (x.author_name || "Вы") : (x.sender_name || base.title),
            role: x.direction === "out" ? "team" : "client", internal: x.message_type === "system",
            text: mediaText(x.message_type, x.text) + (x.transcript ? "\n«" + String(x.transcript).slice(0, 400) + "»" : ""), at: iso(x.at) })),
        }) });
      }
      // post
      if (!A.feed) return deny();
      const snap = feedSnap();
      const it = feedItems(snap, "").find(x => x.id === "post:" + rawId);
      if (!it) return gone();
      delete it._t; delete it._k;
      return res.json({ ok: true, item: Object.assign(it, { tiles: [], total: 0,
        messages: [{ id: it.id, author: it.title, role: "team", internal: false, text: it.last_text, at: it.last_at }] }) });
    } catch (e) {
      console.error("[discuss] item:", e.message);
      res.status(500).json({ ok: false, error: "Превью не собралось: " + e.message });
    }
  });
}
