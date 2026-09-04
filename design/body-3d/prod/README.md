# Что уехало в прод

Копия того, что залито на ai.cashruflow.ru — для истории ветки. Правится всё
равно на сервере через MCP, здесь просто снимок.

| Файл на сервере | Что сделано |
|---|---|
| `web/public/medcard_body3d.js` | новый, весь виджет «Состав тела 2» |
| `web/public/medcard_profile.js` | `<div id="body3d">` после `#segBody`; вызов `window.body3d(rows, segs)` в `loadWeight()`; `b3dCard` в `FOLDS`. Виджет «Состав по зонам» не тронут |
| `web/public/medcard.html` | подключён `medcard_body3d.js?v=1`, `medcard_profile.js` поднят до `v=30` |
| `web/public/medcard-sw.js` | кэш `medcard-v7` → `medcard-v8` |

Норма берётся с бланка: у каждой зоны есть `fat_pct` — процент от нормы прибора,
избыток зоны = `kg * (1 - 100/pct)`. Своих порогов не считаем, у DDX они свои.

Карточка появляется только когда есть `body_segments` за какую-нибудь дату.
