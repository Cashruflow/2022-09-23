# -*- coding: utf-8 -*-
# Main.dc.html и Compact.dc.html собираются из одного шаблона (_screen.tpl),
# чтобы свёрнутая карточка в обоих была буквально одной и той же вёрсткой.
ICO = {
 'act':'<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
 'drop':'<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
 'book':'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
 'clock':'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 'globe':'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
}
CHEV_DOWN = '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>'
CHEV_UP   = '<svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>'
CHECK     = '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>'
PLUS      = '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg>'

def collapsed(icon, title, left, unit, done, plan, pct, minpct, ok=False):
    sub = ('<span class="ok">готово</span> · ' + done + ' из ' + plan + ' ' + unit) if ok \
          else ('осталось <b>' + left + '</b> из ' + plan + ' ' + unit)
    fill = '#4ade80' if ok else '#00a0ff'
    return ('''      <div class="hab-card is-short">
        <button class="chev" title="Развернуть">''' + CHEV_DOWN + '''</button>
        <div class="short-row">
          <div class="hab-card__ico"><svg viewBox="0 0 24 24">''' + ICO[icon] + '''</svg></div>
          <div class="hab-card__body">
            <div class="hab-card__title">''' + title + '''</div>
            <div class="short-sub">''' + sub + '''</div>
          </div>
          <button class="quick">''' + PLUS + '''</button>
        </div>
        <div class="bar short"><span class="fill" style="width:''' + str(pct) + '%;background:' + fill + ''';"></span><span class="min" style="left:''' + str(minpct) + '''%;"></span></div>
      </div>
''')

DAYS = [('Пн','is-full'),('Вт','is-full'),('Ср','is-full'),('Чт','is-partial'),
        ('Пт','is-full'),('Сб','is-full'),('Вс','is-partial')]
week = '\n'.join(
  '          <div class="hab-day' + (' is-today' if l == 'Вс' else '') + '"><span class="hab-day__lbl">' + l
  + '</span><span class="hab-day__mark ' + c + '">' + CHECK + '</span></div>' for l, c in DAYS)

expanded = ('''      <div class="hab-card">
        <button class="chev" title="Свернуть">''' + CHEV_UP + '''</button>
        <div class="hab-card__top">
          <div class="hab-card__head">
            <div class="hab-card__ico"><svg viewBox="0 0 24 24">''' + ICO['act'] + '''</svg></div>
            <div class="hab-card__body">
              <div class="hab-card__title">Отжимания</div>
              <div class="hab-card__sub">2 640 из 3 600 раз</div>
            </div>
          </div>
          <div class="hab-ring">
            <svg viewBox="0 0 104 104"><circle class="track" cx="52" cy="52" r="48"/><circle class="val" cx="52" cy="52" r="48" stroke-dasharray="301.6" stroke-dashoffset="81.4"/></svg>
            <div class="hab-ring__txt"><span class="hab-ring__pct">73%</span><span class="hab-ring__cap">цель</span></div>
          </div>
        </div>

        <div class="today">
          <div class="today__head">
            <span>Сегодня · вс, 23 авг</span>
            <span class="v">сделано <b>40</b> из 120</span>
          </div>
          <div class="today__hero">осталось <b>80</b> раз</div>
          <div class="bar"><span class="fill" style="width:33.3%;"></span><span class="min" style="left:50%;"></span></div>
          <div class="legend"><span class="l-now">40</span><span class="l-min">минимум 60</span><span class="l-plan">план 120</span></div>
        </div>

        <div class="tiles">
          <div class="tile wide">
            <div class="tl">Темп</div>
            <div class="tv">137 <span class="u">раз в день при плане 120</span> <span class="d">+14%</span></div>
            <div class="ts">среднее за последние 7 дней</div>
          </div>
          <div class="tile">
            <div class="tl">Ритм</div>
            <div class="tv">86% <span class="u">19 из 22</span></div>
            <div class="ts">дней с минимумом</div>
          </div>
          <div class="tile">
            <div class="tl">Прогноз</div>
            <div class="tv">30 авг</div>
            <div class="ts">цель — ровно в срок</div>
          </div>
        </div>

        <div class="week">
''' + week + '''
        </div>

        <div class="last">
          <svg viewBox="0 0 24 24">''' + ICO['clock'] + '''</svg>
          <span class="txt">Последняя <b>+20 раз</b> · 14:32</span>
          <button class="fix">Исправить</button>
          <span class="win">27 мин</span>
        </div>

        <div class="hab-card__actions">
          <button class="hab-abtn"><svg viewBox="0 0 24 24"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="hab-abtn is-danger"><svg viewBox="0 0 24 24"><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/></svg></button>
          <button class="hab-btn-result">''' + PLUS + '''<span>Результат</span></button>
        </div>
      </div>
''')

SHORT = {
 'water':   collapsed('drop',  'Вода',       '0,9', 'л',   '1,6', '2,5',  64, 60),
 'reading': collapsed('book',  'Чтение',     '0',   'стр', '30',  '30',  100, 50, ok=True),
 'plank':   collapsed('clock', 'Планка',     '3:00','мин', '0',   '3:00',  0, 50),
 'english': collapsed('globe', 'Английский', '12',  'мин', '8',   '20',   40, 50),
 'pushups': collapsed('act',   'Отжимания',  '80',  'раз', '40',  '120',  33, 50),
}

MAIN_NOTES = '''    <div class="note-row"><span class="n">1</span><span><b>Шеврон — в правом верхнем углу карточки</b>, зона тапа 44px. Развёрнута — «крышей» вверх, свёрнута — вниз.</span></div>
    <div class="note-row"><span class="n">2</span><span><b>Свёрнутый вид — только текущий день:</b> сколько осталось, полоса «сделано / минимум / план» и кнопка записи. Цель, темп, ритм, неделя и история — за шевроном.</span></div>
    <div class="note-row"><span class="n">3</span><span>Записать результат можно <b>не разворачивая</b> — «+» рядом с шевроном, те же 44px.</span></div>
    <div class="note-row"><span class="n">4</span><span>Состояние каждой карточки <b>запоминается</b> — localStorage по id миссии, как уже сделано с офлайн-очередью трекера.</span></div>'''

COMPACT_NOTES = '''    <div class="note-row"><span class="n">1</span><span><b>Пять привычек на одном экране</b> вместо одной: свёрнутая карточка — 94px против 515px.</span></div>
    <div class="note-row"><span class="n">2</span><span>Видно всё, ради чего экран открывают: <b>сколько осталось по каждой</b> и взят ли минимум — жёлтая засечка на полосе.</span></div>
    <div class="note-row"><span class="n">3</span><span>«Чтение» на сегодня закрыто — полоса зелёная, вместо «осталось» стоит <b>готово</b>.</span></div>
    <div class="note-row"><span class="n">4</span><span>«Планка» ещё не начата: полоса пустая, минимум впереди — <b>видно сразу, без разворачивания</b>.</span></div>'''

tpl = open('_screen.tpl', encoding='utf-8').read()
for fname, cards, notes in (
    ('Main.dc.html',    expanded + SHORT['water'] + SHORT['reading'], MAIN_NOTES),
    ('Compact.dc.html', SHORT['pushups'] + SHORT['water'] + SHORT['reading'] + SHORT['plank'] + SHORT['english'], COMPACT_NOTES)):
    open(fname, 'w', encoding='utf-8').write(tpl.replace('@@CARDS@@', cards).replace('@@NOTES@@', notes))
    print(fname, 'собран')
