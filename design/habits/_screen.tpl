<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    /* Экран /habits, телефон 390px. Палитра и геометрия — дефолты токенов /set,
       как в ui.css: карточка #141414 / #262626 / 14px, бренд #00a0ff, ok #4ade80,
       warn #facc15, текст #e8e8e8 / #8b8b8b / #666, радиус полей 8px, зона тапа 44px. */
    body{margin:0;background:#0a0a0a;color:#e8e8e8;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;}
    a{color:#00a0ff;text-decoration:none;} a:hover{color:#31b6ff;}
    .phone{position:relative;width:390px;min-height:844px;overflow:hidden;background:#0a0a0a;}
    .sb-burger{position:absolute;top:12px;right:12px;z-index:600;width:42px;height:42px;border-radius:10px;
      background:#1a1a1a;border:1px solid #2a2a2a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;}
    .bs-float{float:right;width:54px;height:46px;}
    .wrap{padding:18px 20px 60px;}
    h1{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0;
      display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;}
    h1 .mv{font-size:13px;color:#666;font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}
    h1 .mv svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:-2px;margin-left:4px;}

    .toolbar{display:flex;align-items:center;gap:10px;margin:16px 0;min-width:0;}
    .tabs-scroll{flex:1 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none;
      padding:3px;background:#111;border:1px solid #262626;border-radius:9px;}
    .tabs-scroll::-webkit-scrollbar{display:none;}
    .tabs-row{display:flex;gap:4px;width:max-content;}
    .tabs-row span{padding:9px 14px;border-radius:6px;font-size:12.5px;color:#8b8b8b;white-space:nowrap;}
    .tabs-row span.on{background:#1f1f1f;color:#e8e8e8;}
    .add{flex:0 0 auto;width:44px;height:44px;border-radius:12px;background:#00a0ff;border:none;color:#fff;
      display:flex;align-items:center;justify-content:center;}
    .add svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;}

    .hab-card{position:relative;background:#141414;border:1px solid #262626;border-radius:14px;padding:16px;margin-bottom:14px;}
    /* шеврон сворачивания — правый верхний угол карточки, зона тапа 44px */
    .chev{position:absolute;top:4px;right:4px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;
      border:none;background:transparent;padding:0;cursor:pointer;}
    .chev svg{width:18px;height:18px;color:#666;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;
      transition:color .15s;}
    .chev:hover svg{color:#00a0ff;}

    .hab-card__top{display:flex;align-items:center;gap:10px;min-width:0;padding-right:34px;}
    .hab-card__head{flex:1 1 auto;display:flex;align-items:center;gap:12px;min-width:0;}
    .hab-card__ico{flex-shrink:0;width:46px;height:46px;border-radius:50%;background:#00a0ff;
      display:flex;align-items:center;justify-content:center;}
    .hab-card__ico svg{width:21px;height:21px;color:#fff;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
    .hab-card__body{min-width:0;}
    .hab-card__title{font-size:17px;font-weight:700;color:#e8e8e8;line-height:1.25;}
    .hab-card__sub{font-size:12.5px;color:#8b8b8b;margin-top:3px;font-variant-numeric:tabular-nums;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .hab-ring{position:relative;flex:0 0 auto;width:76px;height:76px;}
    .hab-ring svg{width:100%;height:100%;transform:rotate(-90deg);}
    .hab-ring circle{fill:none;}
    .hab-ring circle.track{stroke:#262626;stroke-width:7;}
    .hab-ring circle.val{stroke:#00a0ff;stroke-width:7;stroke-linecap:round;}
    .hab-ring__txt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;}
    .hab-ring__pct{font-size:19px;font-weight:700;color:#e8e8e8;line-height:1.1;font-variant-numeric:tabular-nums;}
    .hab-ring__cap{font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:#666;line-height:1.1;}

    /* ===== СВЁРНУТАЯ КАРТОЧКА — только текущий день ===== */
    .hab-card.is-short{padding:14px 16px 16px;}
    .short-row{display:flex;align-items:center;gap:12px;min-width:0;padding-right:34px;}
    .short-row .hab-card__body{flex:1 1 auto;min-width:0;}
    .short-sub{font-size:13px;color:#8b8b8b;margin-top:3px;font-variant-numeric:tabular-nums;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .short-sub b{color:#e8e8e8;font-weight:700;font-size:15px;}
    .short-sub .ok{color:#4ade80;font-weight:700;}
    .quick{flex:0 0 auto;width:44px;height:44px;border-radius:12px;cursor:pointer;
      background:color-mix(in srgb, #00a0ff 12%, transparent);border:1px solid rgba(0,160,255,.35);
      display:flex;align-items:center;justify-content:center;}
    .quick svg{width:20px;height:20px;color:#00a0ff;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;}
    .bar.short{margin-top:12px;height:8px;}

    .today{margin-top:14px;padding-top:12px;border-top:1px solid #1e1e1e;}
    .today__head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;
      font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;}
    .today__head .v{font-size:12.5px;letter-spacing:0;text-transform:none;color:#8b8b8b;font-variant-numeric:tabular-nums;}
    .today__head .v b{color:#e8e8e8;font-weight:700;}
    .today__hero{margin-top:5px;font-size:14px;color:#8b8b8b;display:flex;align-items:baseline;gap:7px;}
    .today__hero b{font-size:30px;font-weight:800;letter-spacing:-.02em;color:#e8e8e8;line-height:1;font-variant-numeric:tabular-nums;}
    .bar{position:relative;height:10px;border-radius:5px;background:#1e1e1e;margin-top:11px;overflow:hidden;}
    .bar .fill{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:#00a0ff;}
    .bar .min{position:absolute;top:-1px;bottom:-1px;width:2px;background:#facc15;}
    .legend{position:relative;height:14px;margin-top:5px;font-size:10.5px;color:#666;font-variant-numeric:tabular-nums;}
    .legend .l-now{position:absolute;left:0;}
    .legend .l-min{position:absolute;left:50%;transform:translateX(-50%);color:#facc15;}
    .legend .l-plan{position:absolute;right:0;}

    .tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;}
    .tile{background:#191919;border:1px solid #262626;border-radius:8px;padding:9px 10px;min-width:0;}
    .tile.wide{grid-column:1 / -1;}
    .tl{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#666;}
    .tv{margin-top:2px;font-size:16px;font-weight:700;color:#e8e8e8;font-variant-numeric:tabular-nums;
      display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;}
    .tv .u{font-size:12px;font-weight:500;color:#8b8b8b;}
    .tv .d{font-size:13px;font-weight:700;color:#4ade80;}
    .ts{margin-top:2px;font-size:11px;color:#666;line-height:1.35;}

    .week{margin-top:12px;display:flex;justify-content:space-between;}
    .hab-day{display:flex;flex-direction:column;align-items:center;gap:6px;}
    .hab-day__lbl{font-size:10px;color:#666;}
    .hab-day__mark{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #333;}
    .hab-day__mark svg{width:13px;height:13px;color:#fff;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}
    .hab-day__mark.is-full{background:#00a0ff;border-color:#00a0ff;}
    .hab-day__mark.is-partial{background:#facc15;border-color:#facc15;}
    .hab-day__mark.is-partial svg{color:#3a2e00;}
    .hab-day.is-today .hab-day__lbl{color:#e8e8e8;font-weight:700;}
    .hab-day.is-today .hab-day__mark{box-shadow:0 0 0 2px #141414,0 0 0 3.5px #00a0ff;}

    .last{margin-top:12px;display:flex;align-items:center;gap:8px;min-width:0;background:#191919;
      border:1px solid #262626;border-radius:8px;padding:0 6px 0 10px;min-height:44px;font-size:12px;color:#8b8b8b;}
    .last > svg{width:14px;height:14px;flex:0 0 auto;color:#666;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
    .last .txt{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums;}
    .last .txt b{color:#e8e8e8;font-weight:700;}
    .last .fix{flex:0 0 auto;min-height:36px;background:transparent;border:1px solid #333;color:#ccc;
      border-radius:8px;padding:0 12px;font-size:12px;font-family:inherit;cursor:pointer;}
    .last .win{flex:0 0 auto;font-size:10.5px;color:#666;padding-right:4px;font-variant-numeric:tabular-nums;}

    .hab-card__actions{display:flex;align-items:center;gap:6px;margin-top:12px;}
    .hab-abtn{width:44px;height:44px;display:flex;align-items:center;justify-content:center;
      border:none;background:transparent;flex-shrink:0;padding:0;cursor:pointer;}
    .hab-abtn svg{width:24px;height:24px;color:#00a0ff;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
    .hab-abtn.is-danger svg{color:#f87171;}
    .hab-btn-result{flex:1;margin-left:6px;display:inline-flex;align-items:center;justify-content:center;gap:8px;
      height:46px;border-radius:12px;border:none;background:#00a0ff;color:#fff;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;}
    .hab-btn-result svg{width:18px;height:18px;color:#fff;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}

    .notes{width:100%;box-sizing:border-box;padding:16px 16px 20px;display:flex;flex-direction:column;gap:9px;background:#0a0a0a;}
    .note-row{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.45;color:#8b8b8b;}
    .note-row .n{flex:0 0 auto;width:17px;height:17px;border-radius:50%;font-size:10px;font-weight:700;
      display:flex;align-items:center;justify-content:center;margin-top:1px;
      background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.42);color:#4ade80;}
    .note-row b{color:#e8e8e8;font-weight:600;}
  </style>
</helmet>
<div class="phone">
  <div class="sb-burger">☰</div>
  <div class="wrap">
    <div class="bs-float"></div>
    <h1>Ai-трекер привычек<span class="mv">v1.6.1<svg viewBox="0 0 24 24"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg></span></h1>

    <div class="toolbar">
      <div class="tabs-scroll"><div class="tabs-row"><span class="on">Активные</span><span>Выполненные</span><span>Проваленные</span><span>Сданные</span></div></div>
      <button class="add"><svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
    </div>

@@CARDS@@
  </div>
</div>

<div class="notes">
@@NOTES@@
</div>
</x-dc>
</body>
</html>
