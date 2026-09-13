  <style>
    body { margin:0; background:#0a0a0a; color:#e8e8e8;
      font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing:antialiased; }
    a { color:#00a0ff; text-decoration:none; } a:hover { color:#4cc0ff; }
    .art { display:flex; flex-direction:column; height:100%; box-sizing:border-box; }
    .cap { padding:18px 18px 13px; }
    .cap .tag { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:#00a0ff; font-weight:600; }
    .cap h2 { margin:5px 0 0; font-size:17px; font-weight:700; letter-spacing:-.01em; color:#e8e8e8; }
    .cap p { margin:7px 0 0; font-size:12.5px; line-height:1.5; color:#8b8b8b; }
    .mock { flex:1 1 auto; min-height:0; display:flex; position:relative;
      border-top:1px solid #1a1a1a; border-bottom:1px solid #1a1a1a; background:#0a0a0a; overflow:hidden; }
    .sb { width:230px; flex:0 0 230px; background:#0a0a0a; border-right:1px solid #1a1a1a;
      display:flex; flex-direction:column; padding:14px 0 0; min-height:0; }
    .logo { width:22px; height:22px; flex:0 0 auto; }
    .brand { display:flex; align-items:center; gap:8px; padding:0 14px 12px; }
    .brand .nm { font-size:14px; font-weight:700; color:#e8e8e8; }
    .brand .v { font-size:11px; color:#555; font-weight:400; }
    .ibtn { width:26px; height:26px; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#8a8a8a; flex:0 0 auto; }
    .srch { margin:0 14px 10px; display:flex; align-items:center; gap:8px;
      background:#101010; border:1px solid #1e1e1e; border-radius:8px; padding:8px 10px; color:#666; font-size:13px; }
    .nav { flex:1 1 auto; min-height:0; overflow:hidden; position:relative; }
    .grp { padding:13px 20px 6px; font-size:10px; letter-spacing:.08em; color:#555; text-transform:uppercase;
      display:flex; align-items:center; justify-content:space-between; }
    .row { display:flex; align-items:center; gap:11px; padding:8px 12px; font-size:14px; color:#aaa;
      margin:0 10px; border-radius:8px; }
    .row.act { color:#00a0ff; font-weight:600; background:linear-gradient(90deg, rgba(0,160,255,.14), rgba(0,160,255,.03)); }
    .row .lbl { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ico { width:18px; height:18px; flex:0 0 auto; color:#8a8a8a; }
    .row.act .ico { color:#00a0ff; }
    .badge { margin-left:auto; flex:0 0 auto; background:#e05252; color:#fff; font-size:10px; font-weight:600;
      min-width:18px; height:18px; border-radius:9px; display:flex; align-items:center; justify-content:center; padding:0 5px; }
    .kbd { margin-left:auto; font-size:11px; color:#4d4d4d; letter-spacing:.04em; }
    .sep { height:1px; background:#1a1a1a; margin:10px 20px; }
    .foot { flex:0 0 auto; border-top:1px solid #1a1a1a; padding:8px 0 0; background:#0a0a0a; }
    .me { display:flex; align-items:center; gap:10px; padding:9px 12px; margin:6px 10px 10px; border-radius:8px; background:#101010; border:1px solid #1a1a1a; }
    .ava { width:28px; height:28px; border-radius:50%; flex:0 0 auto; background:#16222b; border:1px solid #24333d;
      display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#00a0ff; }
    .me .nm { font-size:12.5px; font-weight:600; color:#e8e8e8; line-height:1.25; }
    .me .sub { font-size:10.5px; color:#666; line-height:1.3; }
    .page { flex:1 1 auto; min-width:0; background:#0c0c0c; padding:18px 16px; }
    .page h3 { margin:0 0 4px; font-size:15px; font-weight:700; color:#2e2e2e; }
    .page .skel { height:10px; border-radius:5px; background:#141414; margin-top:10px; }
    .notes { flex:0 0 auto; padding:12px 18px 14px; display:flex; flex-direction:column; gap:6px; }
    .notes div { font-size:11.5px; line-height:1.45; color:#7d7d7d; display:flex; gap:7px; }
    .notes b { flex:0 0 auto; font-weight:700; }
    .plus b { color:#4ade80; } .minus b { color:#f87171; } .ask b { color:#7d7d7d; }
  </style>
