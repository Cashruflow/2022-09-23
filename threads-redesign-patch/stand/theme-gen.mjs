const THEME_DEFAULTS = { ui_brand: "#00a0ff", ui_danger: "#f87171", ui_ico: "#e8e8e8", ui_ico_opacity: "0.55", ui_ico_size: "15px", ui_radius: "8px", ui_pass: "#facc15",
  // ===== КНОПКИ (/set → «Кнопки») =====
  // Три роли + модификатор размера. Значение любого цветового ключа — ЛЮБОЙ валидный CSS-цвет,
  // включая transparent и var(--ui-brand): так основная кнопка по умолчанию следует за акцентом,
  // но её можно отвязать, вписав конкретный hex.
  // Вторичная (класс .tbtn) — исторические ключи ui_btn_*, переименовывать нельзя: они уже в БД.
  ui_btn_bg: "transparent",
  // 28.09.2026 (базовые стили форм): вторичная — БЕЗ заливки, 1px рамка, текст основным цветом темы.
  ui_btn_text: "var(--ui-tx)", ui_btn_border: "#333333", ui_btn_hover_bg: "#1f1f1f", ui_btn_hover_text: "#ffffff", ui_btn_hover_border: "#00a0ff",
  // Основная (класс .btn). 28.09.2026: синяя заливка с ТЁМНЫМ текстом #04121e (белый на #00a0ff — 2.6:1).
  // Ховер больше не прозрачный: прозрачная заливка + тёмный текст = тёмное на тёмном. Ховер —
  // та же заливка чуть светлее (color-mix от --ui-btn1-bg, поэтому следует и за своим hex из /set).
  ui_btn1_bg: "var(--ui-brand)", ui_btn1_text: "#04121e", ui_btn1_border: "var(--ui-brand)",
  ui_btn1_hover_bg: "color-mix(in srgb, var(--ui-btn1-bg) 85%, #ffffff)", ui_btn1_hover_text: "#04121e",
  ui_btn1_hover_border: "color-mix(in srgb, var(--ui-btn1-bg) 85%, #ffffff)",
  // Опасная (класс .btn-danger)
  ui_btnd_bg: "#3a1010", ui_btnd_text: "#f87171", ui_btnd_border: "#7a2e2e",
  ui_btnd_hover_bg: "#4a1414", ui_btnd_hover_text: "#ffb4b4", ui_btnd_hover_border: "var(--ui-danger)",
  // Иконочная (класс .ibtn) — кнопка без подписи, внутри ровно один <svg>. Своя квадратная геометрия.
  // Канон в разметке — именно .ibtn. Автоподхват по значку действия внутри (BTN_ICO_HAS) остаётся
  // страховкой для старых «btn btn-sm», но роль-модификатор (btn-cancel, btn-danger) он не перебивает:
  // такая кнопка красится как вторичная/опасная. Поэтому иконки в разметке пишутся классом .ibtn.
  // По умолчанию — ГОЛЫЙ значок: без фона и кантовки, ровно как значки-<span> в строках таблиц
  // на /crm, /projects, /contacts и в кабинетах. Один вид иконки на всей платформе (ADR-069).
  // #8a8a8a — это то, во что и раньше превращался #e8e8e8 при opacity .55 на тёмном фоне;
  // теперь он записан честно, потому что значок внутри .ibtn рисуется без приглушения:
  // что стоит в /set#btns → «Цвет иконки», то и видно на экране.
  ui_btni_bg: "transparent", ui_btni_text: "#8a8a8a", ui_btni_border: "transparent",
  ui_btni_hover_bg: "transparent", ui_btni_hover_text: "var(--ui-brand)", ui_btni_hover_border: "transparent",
  ui_btni_pad: "4px", ui_btni_radius: "4px", ui_btni_ico: "15px",
  // Геометрия и типографика — общие для всех ролей, отдельно для модификатора .btn-sm
  ui_btn_py: "10px", ui_btn_px: "18px", ui_btn_fs: "13px", ui_btn_fw: "500", ui_btn_gap: "7px", ui_btn_ico: "15px",
  ui_btn_sm_py: "6px", ui_btn_sm_px: "12px", ui_btn_sm_fs: "12px",
  // 1 = вид кнопок объявляется через !important и перебивает локальный CSS страниц.
  // Ради этого всё и затевалось: иначе каждая новая страница со своим .btn снова ломает настройки.
  ui_btn_force: "1",
  // ===== ПОЛЯ ВВОДА (/set → «Поля») =====
  // Вид input/select/textarea на всех страницах портала и в кабинетах — см. inpCss() ниже.
  // Дефолты подобраны под то, как поля выглядели до появления этого раздела (#1a1a1a / #333 / 13px),
  // чтобы включение единого источника ничего не перекрасило.
  // ui_inp_ph 28.09.2026: #666 на #1a1a1a давал 3:1 — плейсхолдер теперь цветом вторичного текста
  // темы (#8b8b8b на #1a1a1a — 5.3:1). Он же — имя поля (плавающая подпись, /ui-forms.js).
  ui_inp_bg: "#1a1a1a", ui_inp_text: "#ffffff", ui_inp_border: "#333333", ui_inp_ph: "var(--ui-tx-2)",
  ui_inp_focus: "var(--ui-brand)", ui_inp_fs: "13px", ui_inp_fw: "400",
  ui_inp_py: "9px", ui_inp_px: "11px", ui_inp_radius: "8px",
  // подпись поля: не навязывается глобальным правилом, страницы берут её через var(--ui-inp-lbl-fs)
  ui_inp_lbl_fs: "13px", ui_inp_lbl: "#8a8a8a",
  // 1 = вид полей объявляется через !important и перебивает локальный CSS страниц.
  // По умолчанию 0: у страниц полно точечной вёрстки полей (поля в строках таблиц, инпуты внутри
  // чипов), и жёсткий режим их сплющит. Включать осознанно, после прогона по страницам.
  ui_inp_force: "0",
  ui_gap: "22px", ui_card_pad: "20px", ui_card_radius: "12px", ui_page_pad: "44px",
  ui_page_pad_m: "14px", // боковой отступ страниц на мобиле (медкарта и др.)
  // ===== ВИДЖЕТЫ И СВОРАЧИВАНИЕ (/set → «Размеры») =====
  // Плитка-виджет .ui-tiles/.ui-tile из ui.css: сводка денег в карточке лида и далее.
  // Колонок в строке — 2 или 3. Трекер привычек прибил себе двойку локально (.hab-tiles),
  // эта настройка его не двигает.
  ui_tile_cols: "3", ui_tile_gap: "8px",
  // ===== КОЛОНКИ (/set → «Карточки и сетка» → «Колонки»), 11.09.2026 =====
  // Раньше — константы в sb-resize.js (230/200/420), tbl-resize.js (MIN_W 40) и ui.css
  // (.w12 gap 16px, data-wmin 2). Модули читают токены через getComputedStyle, литералы
  // в них остались только фолбэком на случай, если /theme.css не доехал.
  // Ширина, которую человек сам утянул мышью, живёт в localStorage и сильнее этих чисел:
  // тут — значение по умолчанию и рамки, в которых тянуть.
  ui_sb_w: "230px", ui_sb_min: "200px", ui_sb_max: "420px",
  ui_tbl_col_min: "40px",
  ui_w12_gap: "16px", ui_w12_min: "2",
  // Цвет шеврона сворачивания в списках и карточках. Раньше был литерал #666 в .ui-fold-chev
  // и инлайном на страницах; белый читается как «сюда можно нажать» (04.09.2026).
  ui_fold_chev: "#ffffff",
  // Размер заголовка H1 на мобиле (30.08.2026) — единый источник правды для «AI-шапки»
  // (см. ADR/шаблон mobile-header-template): раньше 24px лежали литералом в medcard_mobile.css
  // (.ui-page h1), а трекер привычек (habits.html) вообще жил на своих 30px мимо этого правила —
  // отсюда разный размер на одинаковых по смыслу шапках. Обе точки теперь читают этот токен.
  ui_h1_fs: "25px",
  // Подзаголовок шапки (вторая строка под H1 — название текущей вкладки/раздела, класс .ph1-sub).
  // Тот же принцип: одна настройка вместо литералов font-size на каждой странице.
  ui_sub_fs: "15px",
  // ===== МОБИЛЬНАЯ МОДАЛКА ЗАДАЧИ (/set → «Карточки» → Модалка), задача 217 =====
  // Раньше отступы шторки были литералами в tasks.html и их нельзя было подкрутить без правки кода.
  // Читаются только внутри @media (max-width:768px) под #modal — десктоп и другие страницы не задеты.
  ui_modal_pad: "14px",     // боковые поля шторки
  ui_modal_gap: "12px",     // расстояние между секциями
  // Высота поля и кнопки = минимальный тач-таргет. С 28.09.2026 — на ВСЕХ ширинах, не только в
  // мобильной шторке: из неё считается --ui-ctl-h (ui.css), а от неё — height полей в inpCss() и
  // min-height ролей в btnCss(). 56px — только лендинги и вход (auth-theme.css, --field-h).
  ui_field_h: "44px",
  ui_sheet_radius: "22px",  // скругление верхних углов шторки
  // Верхний зазор шторки — от кромки окна до верха экрана (/set → «Карточки» → Модалка).
  // Смысл числа: шторка не залезает под кнопку ☰ шапки страницы, иначе из окна не выйти.
  // Бургер стоит top:12px высотой 42px, то есть занимает экран до 54px; 64 = 54 + 10 зазора.
  // Двигается бургер — двигается ОДНА эта настройка, а не двенадцать литералов «64px»,
  // разъехавшихся по страницам (ADR-202 решение 1, вынесено в токен 19.09.2026).
  ui_sheet_top: "64px", ui_sheet_gap: "32px",
  // ===== ШТОРКА (/set → «Шторка»), 27.09.2026 =====
  // Один компонент шторки на всю платформу — .mdl-* и .sheet-* в ui.css (ADR про единую шторку).
  // Кнопки шапки шторки: размер квадрата (он же зона тапа), окантовка (толщина + цвет) и заливка.
  // Дефолты — ссылки на роль .ibtn из /set#btns, то есть по умолчанию вид прежний, пока
  // значения не тронули здесь. Кегль заголовка шапки — тот, что был у .mdl-head__t.
  ui_sheet_btn: "44px",
  ui_sheet_btn_bw: "1px",
  ui_sheet_btn_bc: "var(--ui-btni-border)",
  ui_sheet_btn_bg: "var(--ui-btni-bg)",
  ui_sheet_title_fs: "14px",
  // Ручка шторки (полоска сверху, 29.09.2026). Раньше рисовалась на --ui-card-border и почти
  // не читалась в обеих темах. Пара тёмная/светлая, как у палитры «Тема»: в /theme.css одно
  // имя --ui-grip, значение подставляет themeVars() под текущую тему. Цель — ≥1.8:1 к --ui-surface-2.
  ui_grip: "#4a4a4a", ui_l_grip: "#aab6c5",
  // ===== ИНФОРМАЦИЯ «i» (/set → «Информация (i)»), 27.09.2026 =====
  // Общая кнопка .ui-info (ui.css) и текст окна uiInfo() (ui-dialogs.js). Дефолты — вид кнопки
  // правил ввода из чатов (crm-chats.html). Шапку, отступ и кнопки окна задаёт «Шторка снизу».
  ui_info_size: "26px",
  ui_info_bw: "1px",
  ui_info_bc: "var(--ui-card-border)",
  ui_info_bg: "transparent",
  ui_info_tx: "var(--ui-tx-2)",
  ui_info_hover: "var(--ui-brand)",
  ui_info_fs: "13.5px",
  // ===== НИЖНИЙ ДОК С ГНЕЗДОМ (/set → «Меню снизу»), 29.08.2026 =====
  // Геометрию гнезда под центральной кнопкой Константин крутит сам, поэтому она
  // не константы в bottom-nav.js, а токены. Док читает их через getComputedStyle
  // и САМ ЗАЖИМАЕТ значения в безопасный диапазон: ползунки могут задать
  // сочетание, при котором гнездо глубже дока или плечо уходит выше кромки, и
  // путь развалился бы. Правило простое — сервер отдаёт что просили, док чинит.
  // Глубина гнезда ОТДЕЛЬНОЙ ручкой не задаётся: она выводится как
  // 2*радиус_кнопки + зазор − выступ, иначе четыре числа противоречат друг другу.
  ui_dock_h: "72px",        // высота дока
  ui_dock_btn: "64px",      // диаметр центральной кнопки
  ui_dock_gap: "7px",       // зазор между кнопкой и стенкой гнезда (кольцевой, ровный)
  ui_dock_lift: "30px",     // на сколько кнопка выступает над кромкой
  ui_dock_soft: "68",       // угол схода дуги в плечо, градусы: меньше — мягче и шире
  ui_dock_side: "14px",     // отступ дока от краёв экрана
  ui_dock_bottom: "14px",   // отступ дока от кромки экрана (safe-area растит док вниз, не поднимает — bottom-nav.js)
  ui_dock_radius: "36px",   // скругление торцов дока
  // Подсветка активной вкладки дока (.cfbn-pill, 44×44), 29.09.2026. Дефолты = прежний вид:
  // круг (22px = половина стороны) и обводка 1.5px. 0px радиус — квадрат, 0px обводка — только
  // заливка. Зажимает bottom-nav.js: радиус 0..22, обводка 0..4.
  ui_dock_sel_radius: "22px",
  ui_dock_sel_bw: "1.5px",
  // Три уровня тени (/set#shadows, docs/DESIGN-TOKENS.md «Тени»), 30.09.2026. Числа без единиц:
  // y/blur/spread — px, a — непрозрачность в тёмной теме, la — в светлой, %. X всегда 0.
  // Дефолты = прежние литералы themeVars. Зажимает shadowVars() (диапазоны — SH_RANGE).
  ui_sh_sm_y: "2", ui_sh_sm_blur: "6", ui_sh_sm_spread: "-1", ui_sh_sm_a: "25", ui_sh_sm_la: "8",
  ui_sh_md_y: "6", ui_sh_md_blur: "18", ui_sh_md_spread: "-2", ui_sh_md_a: "30", ui_sh_md_la: "10",
  ui_sh_lg_y: "16", ui_sh_lg_blur: "40", ui_sh_lg_spread: "-8", ui_sh_lg_a: "35", ui_sh_lg_la: "14",
  ui_check_size: "16px", ui_check_radius: "4px", ui_check_color: "#00a0ff", ui_check_all: "0",
  // Меню и иконки (/set → «Меню и иконки»): толщина штриха всех иконок платформы + геометрия пунктов сайдбара.
  // Геометрия по умолчанию ПУСТАЯ и в /theme.css не выводится: у сайдбара портала и у кабинета
  // исторически разные размеры (18/11/8/14 против 17/9/9/13), и каждый должен остаться при своих,
  // пока пользователь сам не задал единое значение на /set. Пустые значения сервер не сохраняет.
  ui_ico_stroke: "2", ui_nav_ico: "", ui_nav_gap: "", ui_nav_pad: "", ui_nav_fs: "",
  // ===== AI-ответ (/set → «Кнопки», раздел «AI-ответ») =====
  // Единый признак текста, который написал не человек, а AI-агент, по всему порталу.
  // Молния (i-zap) + пунктирная рамка. Цвета по умолчанию = --ui-brand (бесплатно для темы,
  // отдельно перекрашивать не обязательно, но можно через /set).
  ui_ai_border: "var(--ui-brand)", ui_ai_bg: "rgba(0,160,255,.06)", ui_ai_text: "var(--ui-brand)",
  // ===== БЕЙДЖИ И СЧЁТЧИКИ (/set → «Бейджи»), 08.09.2026 =====
  // Красный кружок с числом непрочитанного. До этого он был литералом в трёх местах
  // (#e05252 в sidebar.js и client.html, --ui-brand в crm-chats.html) — три разных бейджа
  // на одну и ту же мысль «тебя ждут». Правила компонента — .ui-badge в ui.css,
  // значения — здесь. Разбор правил (когда бейдж вообще уместен) — /refs → «Бейджи и счётчики».
  // ui_badge_cap — на каком числе счётчик превращается в «N+»: ширина перестаёт расти,
  // соседи в строке не разъезжаются. Читается скриптами через var(--ui-badge-cap).
  ui_badge_bg: "#e05252", ui_badge_text: "#ffffff", ui_badge_fs: "10px", ui_badge_fw: "600",
  ui_badge_h: "18px", ui_badge_px: "5px", ui_badge_radius: "9px",
  ui_badge_dot: "8px", ui_badge_cap: "99",
  // ===== ВКЛАДКИ (/set → «Вкладки»), 23.09.2026 =====
  // Единый компонент .ui-tabs > .ui-tab (.is-on — активная) в ui.css. Вид по умолчанию —
  // сегментированная «таблетка» (личные модули), модификатор .is-line — подчёркнутые
  // вкладки (реестры бизнес-раздела). Цвета по умолчанию — ссылки на токены темы, поэтому
  // светлая тема подхватывается сама. Локального CSS вкладкам на страницах НЕ писать.
  ui_tab_h: "36px", ui_tab_fs: "13px", ui_tab_fw: "600", ui_tab_px: "12px",
  ui_tab_radius: "8px", ui_tab_gap: "4px",
  ui_tab_bg: "var(--ui-surface-2)", ui_tab_tx: "var(--ui-tx-2)",
  ui_tab_on_bg: "var(--ui-card-border)", ui_tab_on_tx: "var(--ui-tx)", ui_tab_line: "var(--ui-brand)",
  // ===== ЧИПЫ СЧЁТА (/set → «Чипы счёта»), 12.09.2026 =====
  // Чипы под строкой «Всего наименований…» в PDF счёта: Проект · Период · Аккаунт (по чипу на
  // каждый аккаунт). До этого период и аккаунт дописывались прямо в НАЗВАНИЕ позиции, и счёт
  // читался как каша. Счёт печатают и шлют бухгалтерии, поэтому палитра здесь ТОЛЬКО серая:
  // на ч/б принтере цветной чип выцветает в нечитаемое пятно. Размер и перенос не настраиваются —
  // чип всегда 11.5px Arial, не влез в строку — уходит на следующую целиком (см. /refs → «Чипы»).
  // Значения читает invoice_pdf.js напрямую из настроек, CSS-переменных тут нет.
  ui_ichip_lbl_bg: "#bdbdbd", ui_ichip_lbl_tx: "#000000",
  ui_ichip_acc_bg: "#8f8f8f", ui_ichip_acc_tx: "#ffffff",
  ui_ichip_bg: "#ededed", ui_ichip_tx: "#000000", ui_ichip_border: "#555555",
  // ===== ЧИПЫ НА ЭКРАНЕ (/set → «Чипы»), 12.09.2026 =====
  // Всплывающая плашка uiToast (ui-dialogs.js) и общий тост pltToast (toast.js) — то, что на
  // платформе называют «чипом»: тёмная карточка с текстом, крестиком и обратным отсчётом.
  // До этого её координаты были литералом в ui-dialogs.js: left = ширина сайдбара + 18px.
  // На телефоне сайдбар уезжает в нижнюю шторку, а --sb-w остаётся 230px — и чип вставал
  // не слева сверху, а В ПРАВОМ верхнем углу, ровно на кнопки шапки карточки лида: пока не
  // досчитает до нуля, «Сохранить» и «Скачать» нажать нельзя (12.09.2026, Константин).
  // Теперь угол выбирается ОТДЕЛЬНО для ПК и для телефона, а ширина сайдбара складывается
  // только там, где сайдбар реально стоит сбоку. Коды углов — TOAST_ANCHORS ниже:
  // tl tc tr — верх слева / по центру / справа, rc lc — середина правого / левого края,
  // bl bc br — низ слева / по центру / справа.
  ui_toast_pos: "tl", ui_toast_pos_m: "tl",
  // Кегль чипа. Было 13px литералом и на ПК, и на телефоне — на телефоне это мелко
  // (та же жалоба, что и по углу). Крестик и счётчик «7 с» считаются от этого размера в em,
  // поэтому ползунок двигает плашку целиком, а не один абзац текста.
  ui_toast_fs: "14px", ui_toast_fs_m: "15px",
  // ===== ПОВЕРХНОСТИ И ТЕМА (/set → «Тема»), 28.08.2026, ADR-142 =====
  // До этого фон страницы, карточки, линии и цвет текста были ЛИТЕРАЛАМИ в <style> каждой
  // страницы (#0a0a0a / #141414 / #262626 / #e8e8e8 и т.п.) — поэтому светлой темы у портала
  // не могло быть в принципе. Теперь это токены: страница пишет var(--ui-bg), а значение
  // приезжает отсюда и меняется вместе с темой.
  // ui_theme_mode: dark | light | auto (auto = системная настройка устройства).
  // Человек может переключить тему сам (кнопка в сайдбаре) — его выбор живёт в localStorage
  // и сильнее этой настройки; настройка задаёт значение по умолчанию для всех устройств.
  ui_theme_mode: "dark",
  ui_bg: "#0a0a0a", ui_surface: "#141414", ui_surface2: "#1a1a1a", ui_surface3: "#111111",
  ui_line: "#262626", ui_line2: "#1e1e1e",
  ui_tx: "#e8e8e8", ui_tx2: "#8b8b8b", ui_tx3: "#6a6a6a",
  ui_ok: "#4ade80", ui_warn: "#fbbf24",
  // «Заморозка» (снежинка, пометки заморозки в трекере привычек), 29.09.2026. Раньше светлое
  // значение считал JS в medcard_habits.js (--hab-frz); теперь пара ui_frz / ui_l_frz → --ui-frz.
  ui_frz: "#7cc9ff",
  // Жёлтый номер записи в реестрах (ADR-019/092). На белом фоне #fbbf24 нечитаем (1.7:1),
  // поэтому в светлой теме он темнеет до янтарного.
  ui_id: "#fbbf24", ui_l_id: "#a16207",
  // Цвета типов файлов в дереве проекта (/structure, ADR-144). Здесь по той же причине,
  // что и ui_id: на белом фоне тёмной пары нет — #4ade80 на белом даёт 1.6:1 и нечитаем.
  // dir — папка, code — .js/.mjs, page — .html, doc — .md.
  ui_ft_dir: "#6ab0f5", ui_ft_code: "#4ade80", ui_ft_page: "#fb923c", ui_ft_doc: "#c084fc",
  ui_l_ft_dir: "#1d63a8", ui_l_ft_code: "#15803d", ui_l_ft_page: "#b45309", ui_l_ft_doc: "#7e22ce",
  // Светлая пара тех же поверхностей. Значения — те же, что на публичных страницах
  // (auth-theme.css), чтобы портал и посадочные не выглядели с разных сайтов.
  ui_l_bg: "#f6f8fb", ui_l_surface: "#ffffff", ui_l_surface2: "#eef2f7", ui_l_surface3: "#f3f6fa",
  ui_l_line: "#dde5ee", ui_l_line2: "#e6ecf3",
  ui_l_tx: "#0f1c2e", ui_l_tx2: "#5a6b80", ui_l_tx3: "#8595a8",
  ui_l_ok: "#15803d", ui_l_warn: "#b45309", ui_l_frz: "#0369a1",
  // Акцент в светлой теме темнеет: #00a0ff на белом даёт 2.5:1 и нечитаем как ТЕКСТ.
  // Заливка кнопки остаётся яркой — для неё ниже отдельно переопределяется --ui-btn1-bg.
  ui_l_brand: "#0072c6" };
// ===== ВАЛИДАЦИЯ ЗНАЧЕНИЙ ТЕМЫ ПРИ ЗАПИСИ (04.10.2026) =====
// Значения ключей темы пишутся в БД и подставляются в /theme.css БЕЗ экранирования. Раньше их никто не
// проверял: строка `64px;}body{display:none}` дописывала произвольный CSS в /theme.css всех страниц.
// Проверка — ТОЛЬКО при записи (/api/settings/theme, /api/tenant/:slug/theme, /api/profile/:id/theme):
// то, что уже лежит в БД, при чтении не фильтруется, иначе страница осталась бы без темы.
// Формат значения берётся из ДЕФОЛТА в THEME_DEFAULTS (дефолт — образец), поэтому новый ключ получает
// проверку сам. Размер ("64px") → размер; число ("0.55", "400") → число; цвет (#hex, rgba(), var(--ui-…),
// color-mix(…), transparent) → цвет; слово ("dark", "tl") → слово из списка; пустой дефолт (ui_nav_*) →
// размер или число. Всё остальное — 422.
const SH_RANGE = { y: [0, 40], blur: [0, 80], spread: [-20, 20], a: [0, 100], la: [0, 100] };
const SH_KEYS = ["sm", "md", "lg"].flatMap(l => Object.keys(SH_RANGE).map(p => `ui_sh_${l}_${p}`));
// Число ключа ui_sh_<lvl>_<part>, зажатое в SH_RANGE; мусор → null.
function shClamp(key, v) {
  const r = SH_RANGE[key.split("_").pop()];
  const n = Math.round(parseFloat(v));
  return r && Number.isFinite(n) ? Math.min(r[1], Math.max(r[0], n)) : null;
}
// --ui-shadow-sm/-md/-lg одной строкой: тёмная ветка берёт *_a (чёрный rgba), светлая — *_la.
// 30.09.2026: светлая ветка красится --ui-shadow-c (rgba(15,28,46,.35), тёплый сине-серый),
// а не чёрным. *_la по-прежнему = итоговая альфа в процентах, поэтому доля в color-mix
// N = min(100, round(la / 0.35)): 8→23 (≈.08), 10→29 (≈.10), 14→40 (.14). Потолок la≈35.
// Та же формула — в живом превью /set#shadows (set.html) и в /refs#shadows.
const SH_LIGHT_C_ALPHA = 0.35;
function shadowVars(t, light) {
  return ["sm", "md", "lg"].map(l => {
    const g = p => { const k = `ui_sh_${l}_${p}`; const n = shClamp(k, t[k]); return n === null ? +THEME_DEFAULTS[k] : n; };
    const geo = `0 ${g("y")}px ${g("blur")}px ${g("spread")}px`;
    if (!light) return `--ui-shadow-${l}:${geo} rgba(0,0,0,${g("a") / 100});`;
    const n = Math.min(100, Math.round(g("la") / SH_LIGHT_C_ALPHA));
    return `--ui-shadow-${l}:${geo} color-mix(in srgb, var(--ui-shadow-c,#000) ${n}%, transparent);`;
  }).join("");
}
const BTN_OPTOUT = ":not(.no-ui-btn):not([hidden])";                       // полный отказ от платформенного вида
const BTN_OPTOUT_C = ":not(.no-ui-btn):not(.pm-only):not([hidden])";       // ...только цвета (pm-only красится в ui.css)
// модификаторы размера вычитаем из общей геометрии, иначе .btn перебьёт .btn-sm
const BTN_SM_NOT = ":not(.btn-sm):not(.sm):not(.mbtn-sm):not(.s)";
const BTN_MAIN_NOT = [".gh", ".ghost", ".btn-ghost", ".btn-gh", ".btn-cancel", ".btn-danger", ".btn2", ".tbtn"]
  .map(c => `:not(${c})`).join("");
// Кнопка без подписи. Ловится по классу значка действия внутри — это давняя договорённость
// ui.css: i-show/i-edit/i-del/i-copy/i-hide/i-link ставятся ТОЛЬКО в самостоятельную иконочную
// кнопку, а у кнопки с подписью значок идёт голым <svg><use…></svg>.
// Через :has(> svg:only-child) ловить нельзя: подпись рядом с <svg> — текстовый узел, а не
// элемент, поэтому «Сохранить» с иконкой тоже попала бы под иконочное правило.
// Приклеивается к селекторам роли «Основная» → иконочные правила на один класс специфичнее.
const BTN_ICO_HAS = ":has(> :is(.i-del,.i-edit,.i-copy,.i-nocopy,.i-show,.i-hide,.i-link))";
const BTN_ROLES = {
  primary: {
    title: "Основная", canon: ".btn", hint: "Главное действие на экране: сохранить, создать, отправить.",
    sel: [".btn" + BTN_MAIN_NOT, ".btn-sm" + BTN_MAIN_NOT, ".btn-primary", ".mbtn-primary", ".tbtn.primary",
          ".tc-btn:not(.g):not(.r)", ".cf-btn", ".rw-btn:not(.gh)"]
  },
  ghost: {
    title: "Вторичная", canon: ".tbtn", hint: "Всё остальное: отмена, импорт, «найти», «добрать», мелкие действия в строках.",
    sel: [".tbtn:not(.primary)", ".btn-gh", ".btn.gh", ".btn.ghost", ".btn-ghost", ".btn2", ".btn-cancel",
          ".mbtn:not(.mbtn-primary):not(.mbtn-danger)", ".mbtn-ghost", ".cal-btn", ".rw-btn.gh",
          ".tc-btn.g", "button.mini", "button.add"]
  },
  danger: {
    title: "Опасная", canon: ".btn-danger", hint: "Необратимое: удалить, закрыть навсегда, сбросить.",
    sel: [".btn-danger", ".mbtn-danger", ".tc-btn.r"]
  },
  icon: {
    title: "Иконочная", canon: ".ibtn",
    hint: "Кнопка без подписи: глаз, карандаш, корзина в строке таблицы. По умолчанию — голый значок: ни фона, ни кантовки, ровно как значки-<span> на остальных страницах и в кабинетах. Серый значок, ховер — акцентный цвет, у корзины и запрета копирования красный. Фон, кантовку, отступ и скругление можно включить в /set#btns. Ловится и автоматически — «основная» кнопка со значком действия внутри (i-show, i-edit, i-del, i-copy, i-hide, i-link).",
    sel: [".ibtn", ".btn-ico",
          ".btn" + BTN_MAIN_NOT + BTN_ICO_HAS, ".btn-sm" + BTN_MAIN_NOT + BTN_ICO_HAS,
          ".btn-primary" + BTN_ICO_HAS, ".tbtn.primary" + BTN_ICO_HAS]
  },
  small: {
    title: "Маленькая", canon: ".btn-sm", hint: "Модификатор поверх любой роли: те же цвета, компактнее паддинги и шрифт.",
    sel: [".btn-sm", ".btn.sm", ".mbtn-sm", ".tc-btn.s"]
  }
};
const BTN_ALL_SEL = [].concat(BTN_ROLES.ghost.sel, BTN_ROLES.primary.sel, BTN_ROLES.danger.sel);
function btnCss(t) {
  const I = String(t.ui_btn_force) === "1" ? " !important" : "";
  const sel = (list, tail, skip) => list.map(s => s + (tail || "") + (skip || BTN_OPTOUT)).join(",");
  const geom = `display:inline-flex;align-items:center;justify-content:center;gap:var(--ui-btn-gap)${I};`
    + `border-radius:var(--ui-radius)${I};border-style:solid${I};border-width:1px${I};font-family:inherit${I};line-height:1.2${I};`
    + `font-weight:var(--ui-btn-fw)${I};white-space:nowrap;cursor:pointer;text-decoration:none;`
    + `transition:background .15s,color .15s,border-color .15s,transform .12s ease-out;`;
  const paint = (list, bg, fg, bd) =>
    `\n${sel(list, "", BTN_OPTOUT_C)}{background:${bg}${I};color:${fg}${I};border:1px solid ${bd}${I};}`;
  const hover = (list, bg, fg, bd) =>
    `\n${sel(list, ":hover:not(:disabled)", BTN_OPTOUT_C)}{background:${bg}${I};color:${fg}${I};border-color:${bd}${I};}`;
  return ""
    // 1. геометрия — одна на все роли, кроме «маленьких»
    // min-height — одна высота с полями ввода (--ui-ctl-h = --ui-field-h, 44px на всех ширинах,
    // 28.09.2026). min-, а не height: двухстрочная подпись и перенос ряда кнопок остаются живыми.
    + `\n${sel(BTN_ALL_SEL, BTN_SM_NOT)}{${geom}padding:var(--ui-btn-py) var(--ui-btn-px)${I};font-size:var(--ui-btn-fs)${I};`
    + `min-height:var(--ui-ctl-h,44px)${I};box-sizing:border-box;}`
    // 2. «маленькая» — тот же вид, своя геометрия
    + `\n${sel(BTN_ROLES.small.sel)}{${geom}padding:var(--ui-btn-sm-py) var(--ui-btn-sm-px)${I};font-size:var(--ui-btn-sm-fs)${I};}`
    // 3. цвета по ролям (порядок важен)
    + paint(BTN_ROLES.ghost.sel, "var(--ui-btn-bg)", "var(--ui-btn-text)", "var(--ui-btn-border)")
    + hover(BTN_ROLES.ghost.sel, "var(--ui-btn-hover-bg)", "var(--ui-btn-hover-text)", "var(--ui-btn-hover-border)")
    + paint(BTN_ROLES.primary.sel, "var(--ui-btn1-bg)", "var(--ui-btn1-text)", "var(--ui-btn1-border)")
    + hover(BTN_ROLES.primary.sel, "var(--ui-btn1-hover-bg)", "var(--ui-btn1-hover-text)", "var(--ui-btn1-hover-border)")
    + paint(BTN_ROLES.danger.sel, "var(--ui-btnd-bg)", "var(--ui-btnd-text)", "var(--ui-btnd-border)")
    + hover(BTN_ROLES.danger.sel, "var(--ui-btnd-hover-bg)", "var(--ui-btnd-hover-text)", "var(--ui-btnd-hover-border)")
    // 4. иконка внутри кнопки и неактивное состояние
    + `\n${BTN_ALL_SEL.map(s => s + BTN_OPTOUT + " svg").join(",")}{width:var(--ui-btn-ico)${I};height:var(--ui-btn-ico)${I};flex-shrink:0;}`
    + `\n${sel(BTN_ALL_SEL, ":disabled")}{opacity:.5${I};cursor:not-allowed${I};}`
    // 4а. Базовые состояния форм (28.09.2026). Нажатие — лёгкое сжатие; фокус с клавиатуры —
    //     кольцо 2px цветом бренда с отступом; загрузка (.is-busy, uiBusy() из /ui-forms.js) —
    //     кнопка disabled, но НЕ бледнеет: спиннер рисует ui.css, здесь только снимаем .5.
    //     Селекторы той же специфичности, что :disabled выше, и идут позже — поэтому выигрывают.
    + `\n${sel(BTN_ALL_SEL.concat(BTN_ROLES.icon.sel), ":active:not(:disabled)")}{transform:scale(.98);}`
    + `\n${sel(BTN_ALL_SEL.concat(BTN_ROLES.icon.sel), ":focus-visible")}{outline:2px solid var(--ui-brand,#00a0ff)${I};outline-offset:2px${I};}`
    + `\n${sel(BTN_ALL_SEL, ".is-busy")},${sel(BTN_ALL_SEL, ".is-done")}{opacity:1${I};cursor:progress${I};}`
    // 5. иконочная кнопка — идёт ПОСЛЕ всех ролей и на один элемент специфичнее (BTN_ICO_HAS),
    //    поэтому перебивает «основную». Геометрия объявляется дважды: с вычетом модификаторов
    //    размера (иначе п.1 перебивает квадрат у голого `.btn`) и без него (иначе п.2 перебивает
    //    квадрат у `btn btn-sm`). Объявления одинаковые, выигрывает то, что специфичнее.
    + [BTN_SM_NOT, ""].map(tail =>
        `\n${sel(BTN_ROLES.icon.sel, tail)}{display:inline-flex${I};align-items:center${I};justify-content:center${I};`
        // width/height:auto — явно, чтобы перебить локальные размеры страниц. Квадрата у иконки нет:
        // размер задаёт сам значок плюс отступ, как у значков-<span> в ui.css (padding:4px).
        + `width:var(--ui-btni-w,auto)${I};height:var(--ui-btni-h,auto)${I};padding:var(--ui-btni-pad)${I};`
        + `border-radius:var(--ui-btni-radius)${I};border-style:solid${I};border-width:var(--ui-btni-bw,1px)${I};`
        + `cursor:pointer;text-decoration:none;transition:background .15s,color .15s,border-color .15s;}`).join("")
    // «основная» со значком действия внутри (автоподхват иконочной роли) не должна получать
    // min-height 44 из п.1 — у голого значка своя геометрия. Сам .ibtn/.btn-ico не трогаем:
    // странице разрешено растягивать его min-height до зоны тапа (ADR-068).
    + `\n${sel(BTN_ROLES.icon.sel.slice(2), BTN_SM_NOT)}{min-height:var(--ui-btni-minh,0)${I};}`
    + paint(BTN_ROLES.icon.sel, "var(--ui-btni-bg)", "var(--ui-btni-text)", "var(--ui-btni-border)")
    + hover(BTN_ROLES.icon.sel, "var(--ui-btni-hover-bg)", "var(--ui-btni-hover-text)", "var(--ui-btni-hover-border)")
    + `\n${BTN_ROLES.icon.sel.map(s => s + BTN_OPTOUT + " svg").join(",")}{width:var(--ui-btni-ico)${I};height:var(--ui-btni-ico)${I};flex-shrink:0;}`
    // Цвет значка. Значки i-* красит ui.css через !important, поэтому без этих правил поля
    // «Цвет иконки» в /set#btns были бы мёртвыми. В покое красятся ВСЕ значки, включая корзину:
    // раньше .i-del был исключён ради красного ховера, и в ряду корзина светилась ярче соседей.
    // opacity:1 — приглушение .55 из ui.css здесь снято намеренно: цвет из /set должен совпадать
    // с тем, что на экране, поэтому дефолт ui_btni_text и есть готовый приглушённый серый.
    + `\n${BTN_ROLES.icon.sel.map(s => s + BTN_OPTOUT_C + " > svg").join(",")}{color:var(--ui-btni-text)${I};opacity:1${I};}`
    + `\n${BTN_ROLES.icon.sel.map(s => s + ":hover:not(:disabled)" + BTN_OPTOUT_C + " > svg:not(.i-del):not(.i-nocopy)").join(",")}{color:var(--ui-btni-hover-text)${I};opacity:1${I};}`
    // Красный ховер корзины — единственная подсказка «действие необратимо». Раньше он держался
    // на правиле ui.css, которое проигрывало бы покрасочному правилу выше; теперь объявлен явно.
    // То же у запрета копирования (i-nocopy): значок означает «дальше хода нет», цвет тот же.
    + `\n${BTN_ROLES.icon.sel.map(s => s + ":hover:not(:disabled)" + BTN_OPTOUT_C + " > svg:is(.i-del,.i-nocopy)").join(",")}{color:var(--ui-danger)${I};opacity:1${I};}`
    // Включённое состояние (.ico-on на самой кнопке): значок горит красным и в покое.
    // Объявляется здесь, а не только в ui.css: покрасочное правило выше специфичнее и гасило бы его.
    + `\n${BTN_ROLES.icon.sel.map(s => s + ".ico-on" + BTN_OPTOUT_C + " > svg:is(.i-del,.i-nocopy)").join(",")}{color:var(--ui-danger)${I};opacity:1${I};}`
    + `\n${sel(BTN_ROLES.icon.sel, ":disabled")}{opacity:.5${I};cursor:not-allowed${I};}`
    // Скрытие кнопки. Роли объявляют display через !important, поэтому inline style.display='none'
    // его не перебивает — прятать кнопку нужно атрибутом hidden. Селекторы ролей его вычитают
    // (BTN_OPTOUT), а это правило добивает случай, когда display пришёл из локального CSS страницы.
    + `\n${BTN_ALL_SEL.concat(BTN_ROLES.icon.sel).map(s => s + "[hidden]").join(",")}{display:none${I};}`
    // 6. мобильный таймер в ленте задач — квадратная кнопка со скруглением платформы (--ui-radius),
    //    один элемент, без вложенного кружка. Ghost-роль (.tbtn) выше по специфичности из-за цепочки
    //    :not(), поэтому здесь принудительно (!important), а не за счёт специфичности селектора.
    + `\n@media (max-width:768px){`
    + `.task-timer > .tbtn${BTN_OPTOUT}{width:var(--ui-tap) !important;height:var(--ui-tap) !important;padding:0 !important;`
    + `display:grid !important;place-items:center !important;background:none !important;`
    + `border:1px solid var(--ui-btn-border,#333) !important;border-radius:var(--ui-radius,10px) !important;`
    + `color:var(--ui-btn-text,#bbb) !important;}`
    + `.task-timer > .tbtn.is-stop${BTN_OPTOUT}{color:var(--ui-danger) !important;`
    + `border-color:color-mix(in srgb, var(--ui-danger) 45%, transparent) !important;}}`;
}
// ============================================================
// ВИД ПОЛЕЙ ВВОДА ПЛАТФОРМЫ — единственный источник правды (аналог btnCss).
//
// Правило: размер шрифта, отступы, фон и рамку полей на странице локально НЕ пишем —
// они приезжают отсюда и слушаются /set#inputs. Нужно исключение (поле-«невидимка» внутри
// чипа, узкий инпут в ячейке таблицы) — класс no-ui-inp, тогда платформа поле не трогает.
//
// Про специфичность: селекторы завёрнуты в :where(), поэтому весят ровно как голый тег.
// Значит, правило страницы вида `input{...}` перебивается (theme.css грузится последним),
// а более точное (`.frow input`, `#modal input`, инлайновый style) продолжает работать.
// Так единый вид приезжает туда, где своей вёрстки полей нет, и не ломает ту, что есть.
// Чекбоксы, радио, ползунки, выбор цвета и файла, кнопки-инпуты не трогаем вовсе:
// у чекбоксов свой раздел настроек, остальное рисует система.
// ============================================================
const INP_SKIP = ":not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color])"
  + ":not([type=file]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not(.no-ui-inp)";
const INP_SEL = [`input:where(${INP_SKIP})`, "select:where(:not(.no-ui-inp))", "textarea:where(:not(.no-ui-inp))"];
function inpCss(t) {
  const I = String(t.ui_inp_force) === "1" ? " !important" : "";
  const sel = INP_SEL.join(",");
  return ""
    + `\n${sel}{background:var(--ui-inp-bg,#1a1a1a)${I};color:var(--ui-inp-text,#fff)${I};`
    + `border:1px solid var(--ui-inp-border,#333)${I};border-radius:var(--ui-inp-radius,8px)${I};`
    + `padding:var(--ui-inp-py,9px) var(--ui-inp-px,11px)${I};font-family:inherit${I};`
    // outline:none — не «без замены»: фокус рисует кольцо ниже (рамка + box-shadow 1px = 2px).
    + `font-size:var(--ui-inp-fs,13px)${I};font-weight:var(--ui-inp-fw,400)${I};outline:none;`
    + `transition:border-color .15s ease-out,box-shadow .15s ease-out;}`
    // Фокус-кольцо 2px цветом бренда (28.09.2026): 1px рамки + 1px тени снаружи, без сдвига вёрстки.
    + `\n${INP_SEL.map(s => s + ":focus").join(",")}{border-color:var(--ui-inp-focus,var(--ui-brand,#00a0ff))${I};`
    + `box-shadow:0 0 0 1px var(--ui-inp-focus,var(--ui-brand,#00a0ff))${I};}`
    + `\n${INP_SEL.map(s => s + "::placeholder").join(",")}{color:var(--ui-inp-ph,var(--ui-tx-2,#8b8b8b))${I};opacity:1;}`
    + `\n${INP_SEL.map(s => s + ":disabled").join(",")}{opacity:.55;cursor:not-allowed;}`
    // Однострочное поле и select — ровно высоты кнопки: --ui-ctl-h (ui.css) = --ui-field-h из /set,
    // 44px. 17.09.2026 правило было только для ПК и давало 38px; 28.09.2026 — все ширины, 44px.
    // :where() — нулевая специфичность: страница, задавшая полю свою высоту, её сохраняет.
    + `\n:where(input:where(${INP_SKIP}),select:where(:not(.no-ui-inp):not([multiple]):not([size]))){`
    + `height:var(--ui-ctl-h,44px);box-sizing:border-box;}`
    // Анти-зум iOS (ADR-081, ADR-082) сильнее любой настройки и идёт последним: на телефоне поле
    // не может быть мельче 16px, иначе Safari зумит страницу при фокусе и зум не откатывается.
    + `\n@media (max-width:768px){${sel}{font-size:16px !important;}}`;
}
// ===== ЧИПЫ НА ЭКРАНЕ (/set → «Чипы»), 12.09.2026 =====
// Восемь точек по краям экрана: четыре угла и четыре середины сторон. Координаты живут
// ЗДЕСЬ и нигде больше — правила самого компонента (фон, кромка, тень) в ui.css, а
// ui-dialogs.js координат не знает вовсе и своих inline-стилей положения не пишет.
// Отдаются переменными, которые #ui-toasts подставляет в top/bottom/left/right/transform/
// align-items (ui.css). Положение нижнего тоста pltToast сюда НЕ завязано — он снизу по
// центру над доком и за один угол с чипом не спорит; от этого набора ему достаётся только
// кегль --ui-toast-fs. Коды углов такие же, как в /set: tl tc tr rc br bc bl lc.
const TOAST_ANCHORS = ["tl", "tc", "tr", "rc", "br", "bc", "bl", "lc"];
function toastAnchor(code) {
  return TOAST_ANCHORS.includes(String(code || "").trim()) ? String(code).trim() : "tl";
}
// opts.sbw — складывать ли ширину сайдбара к левому краю. На ПК сайдбар стоит слева и
// плашка обязана начинаться ЗА ним; на телефоне его там нет (он нижняя/верхняя шторка),
// и то же слагаемое уносило чип за середину экрана — из-за этого он и лез на кнопки.
// opts.top / opts.bottom — базовые отступы от краёв: на телефоне сверху добавляется
// safe-area, снизу — высота нижнего дока (--cfbn-pad), иначе чип ложится на его кнопки.
function toastVars(code, opts) {
  const o = opts || {};
  // Отступ от края: на ПК 18px, на телефоне 12px (там же, где висит бургер и кромка дока).
  // Левый край на ПК дополнительно отодвинут за сайдбар, правый — нет, справа сайдбара нет.
  const edge = o.side || (o.sbw ? "18px" : "12px");
  const side = o.sbw ? "calc(var(--sb-w, 0px) + 18px)" : edge;
  const top = o.top || "14px";
  const bottom = o.bottom || "14px";
  const V = {
    tl: ["top", "left"], tc: ["top", "center"], tr: ["top", "right"],
    rc: ["middle", "right"], br: ["bottom", "right"], bc: ["bottom", "center"],
    bl: ["bottom", "left"], lc: ["middle", "left"]
  }[toastAnchor(code)];
  const [vert, horiz] = V;
  const css = [];
  // вертикаль
  // Направление стопки: у нижних углов вторая плашка растёт ВВЕРХ, а не за край экрана.
  if (vert === "top") css.push("--ui-toast-top:" + top, "--ui-toast-bottom:auto", "--ui-toast-ty:0", "--ui-toast-dir:column");
  else if (vert === "bottom") css.push("--ui-toast-top:auto", "--ui-toast-bottom:" + bottom, "--ui-toast-ty:0", "--ui-toast-dir:column-reverse");
  else css.push("--ui-toast-top:50%", "--ui-toast-bottom:auto", "--ui-toast-ty:-50%", "--ui-toast-dir:column");
  // горизонталь
  if (horiz === "left") css.push("--ui-toast-left:" + side, "--ui-toast-right:auto", "--ui-toast-tx:0", "--ui-toast-align:flex-start");
  else if (horiz === "right") css.push("--ui-toast-left:auto", "--ui-toast-right:" + edge, "--ui-toast-tx:0", "--ui-toast-align:flex-end");
  else css.push("--ui-toast-left:50%", "--ui-toast-right:auto", "--ui-toast-tx:-50%", "--ui-toast-align:center");
  return css.join(";") + ";";
}
function toastCss(t) {
  const pc = toastAnchor(t.ui_toast_pos);
  const mob = toastAnchor(t.ui_toast_pos_m);
  // Телефон: сверху — вырез камеры (safe-area), в правом верхнем углу — кнопка ☰ (12px + 42px,
  // sidebar.js). Поэтому у правого верхнего угла на мобиле отступ сверху не 14px, а под бургер:
  // иначе выбранный угол честно совпадёт с кнопкой меню — ровно та беда, от которой ушли.
  const mobTop = "calc(env(safe-area-inset-top, 0px) + " + (mob === "tr" ? "64px" : "14px") + ")";
  const mobBottom = "calc(env(safe-area-inset-bottom, 0px) + var(--cfbn-pad, 0px) + 14px)";
  return "\n:root{" + toastVars(pc, { sbw: true, top: "calc(env(safe-area-inset-top, 0px) + 14px)" })
    + "--ui-toast-fs:" + t.ui_toast_fs + ";}"
    + "\n@media (max-width:768px){:root{"
    + toastVars(mob, { sbw: false, top: mobTop, bottom: mobBottom })
    + "--ui-toast-fs:" + t.ui_toast_fs_m + ";}}";
}
// Справочник ролей и классов для /refs#btns — чтобы справочник не расходился с кодом.
// Под pauth: это правило разработки, клиенту в кабинете знать про классы незачем.
function softVars(light) {
  const o = ["brand", "ok", "warn", "danger"].map(n =>
    `--ui-${n}-soft:color-mix(in srgb, var(--ui-${n}) 9%, var(--ui-card-bg));`
    + `--ui-${n}-soft-line:color-mix(in srgb, var(--ui-${n}) 22%, var(--ui-card-bg));`
    + `--ui-${n}-soft-tx:${light ? `color-mix(in srgb, var(--ui-${n}) 90%, var(--ui-tx))` : `var(--ui-${n})`};`);
  // Шапка: вариант A — плоская, фон карточки, без стекла (blur 0) и без нижней линии.
  o.push(`--ui-header-bg:var(--ui-card-bg);--ui-header-blur:0px;--ui-header-line:transparent;`);
  return o.join("");
}
// Токены одной темы строкой. light=true — светлая пара ключей ui_l_*.
function themeVars(t, light) {
  if (!light) {
    return `color-scheme:dark;`
      + `--ui-bg:${t.ui_bg};--ui-surface:${t.ui_surface};--ui-surface-2:${t.ui_surface2};--ui-surface-3:${t.ui_surface3};`
      + `--ui-line:${t.ui_line};--ui-line-2:${t.ui_line2};--ui-tx:${t.ui_tx};--ui-tx-2:${t.ui_tx2};--ui-tx-3:${t.ui_tx3};`
      + `--ui-ok:${t.ui_ok};--ui-warn:${t.ui_warn};--ui-id:${t.ui_id};`
      // ручка шторки и «заморозка» (29.09.2026) — пара ключей, как ok/warn; симметрично светлой ветке
      + `--ui-grip:${t.ui_grip || "#4a4a4a"};--ui-frz:${t.ui_frz || "#7cc9ff"};`
      + `--ui-ft-dir:${t.ui_ft_dir};--ui-ft-code:${t.ui_ft_code};--ui-ft-page:${t.ui_ft_page};--ui-ft-doc:${t.ui_ft_doc};`
      + `--ui-brand:${t.ui_brand};--ui-btn1-bg:${t.ui_btn1_bg};--ui-btn1-border:${t.ui_btn1_border};--ui-btn1-text:${t.ui_btn1_text};`
      + `--ui-btn1-hover-bg:${t.ui_btn1_hover_bg};--ui-btn1-hover-text:${t.ui_btn1_hover_text};--ui-btn1-hover-border:${t.ui_btn1_hover_border};`
      + `--ui-btn-text:${t.ui_btn_text};--ui-btn-border:${t.ui_btn_border};--ui-btn-hover-bg:${t.ui_btn_hover_bg};--ui-btn-hover-text:${t.ui_btn_hover_text};`
      + `--ui-btni-text:${t.ui_btni_text};`
      + `--ui-btnd-bg:${t.ui_btnd_bg};--ui-btnd-text:${t.ui_btnd_text};--ui-btnd-border:${t.ui_btnd_border};`
      + `--ui-btnd-hover-bg:${t.ui_btnd_hover_bg};--ui-btnd-hover-text:${t.ui_btnd_hover_text};--ui-danger:${t.ui_danger};`
      + `--ui-inp-bg:${t.ui_inp_bg};--ui-inp-text:${t.ui_inp_text};--ui-inp-border:${t.ui_inp_border};--ui-inp-ph:${t.ui_inp_ph};--ui-inp-lbl:${t.ui_inp_lbl};`
      + `--ui-ico:${t.ui_ico};--ui-ai-bg:${t.ui_ai_bg};`
      // --ui-tx3 (без дефиса) — историческое имя, им пишут .hab-* в ui.css; без алиаса
      // оно никогда не видело темы и всегда падало в литерал (ERR-56, 15.09.2026)
      + `--ui-tx3:${t.ui_tx3};`
      // СИММЕТРИЯ НАБОРОВ (18.09.2026). Эти десять токенов светлая ветка объявляет, а тёмная —
      // нет. Из-за этого переключение в тёмную их НЕ откатывало: при mode=light набор L сидит
      // на :root, а :root[data-theme="dark"]{D} перекрывает только то, что перечисляет. Итог —
      // чёрное полотно с БЕЛЫМИ карточками на /medcard/life и в любом разделе с .ui-card.
      // Правило: набор КЛЮЧЕЙ в обеих ветках обязан совпадать (второй раз за двое суток, см.
      // ERR-56 выше). Значения здесь равны тем, что и так рисовались (ui.css :root и фолбэки
      // в var()), поэтому вид тёмной темы не меняется.
      + `--ui-page-bg:#0e0e0e;--ui-card-bg:${t.ui_surface};--ui-card-border:${t.ui_line};`
      + `--ui-row-hover:#161616;--ui-muted:${t.ui_tx3};`
      // шеврон в тёмной теме белый — явный запрос Константина 04.09.2026 (ui.css:14),
      // в светлой он уходит в ui_l_tx2; ui_tx2 здесь дал бы серую галку на тёмном
      + `--ui-fold-chev:#ffffff;`
      + `--ui-seg-on:#1f1f1f;--ui-sheet-bg:#1c1c1e;`
      + `--ui-island-bg:#000;--ui-island-line:#1f1f1f;`
      // 29.09.2026: светлая тема. Цвет тени (--ui-shadow-c: тени пишутся как
      // color-mix(in srgb, var(--ui-shadow-c,#000) N%, transparent) — в тёмной ровно
      // rgba(0,0,0,N), в светлой мягкая тёмно-синяя) и плашки pltToast (.plt-toast в ui.css).
      // Тёмные значения = прежние литералы, вид тёмной темы не меняется.
      + `--ui-shadow-c:#000;--ui-toast-ok-bg:#14351f;--ui-toast-ok-line:#1e5230;`
      + `--ui-toast-err-bg:#3a1416;--ui-toast-err-line:#63252a;`
      // 29.09.2026: три уровня тени (docs/DESIGN-TOKENS.md «Тени», /refs#shadows).
      // sm — кнопки/чипы, md — меню/тосты/FAB/CTA, lg — модалки/шторки/панели.
      // 30.09.2026: ключи /set#shadows (ui_sh_*); геометрия общая, светлая ветка берёт свою альфу.
      + shadowVars(t, false)
      + softVars(false);
  }
  return `color-scheme:light;`
    + `--ui-bg:${t.ui_l_bg};--ui-surface:${t.ui_l_surface};--ui-surface-2:${t.ui_l_surface2};--ui-surface-3:${t.ui_l_surface3};`
    + `--ui-line:${t.ui_l_line};--ui-line-2:${t.ui_l_line2};--ui-tx:${t.ui_l_tx};--ui-tx-2:${t.ui_l_tx2};--ui-tx-3:${t.ui_l_tx3};`
    + `--ui-ok:${t.ui_l_ok};--ui-warn:${t.ui_l_warn};--ui-id:${t.ui_l_id};`
    + `--ui-grip:${t.ui_l_grip || "#aab6c5"};--ui-frz:${t.ui_l_frz || "#0369a1"};`
    + `--ui-ft-dir:${t.ui_l_ft_dir};--ui-ft-code:${t.ui_l_ft_code};--ui-ft-page:${t.ui_l_ft_page};--ui-ft-doc:${t.ui_l_ft_doc};`
    // Акцент как ТЕКСТ темнеет (яркий #00a0ff на белом — 2.5:1, нечитаем), как ЗАЛИВКА кнопки
    // остаётся фирменным: тёмная подпись на нём даёт 8:1.
    // Ховер основной — та же заливка светлее, текст остаётся тёмным (28.09.2026): прозрачный
    // ховер с тёмной подписью на тёмной теме давал тёмное на тёмном.
    + `--ui-brand:${t.ui_l_brand};--ui-btn1-bg:${t.ui_brand};--ui-btn1-border:${t.ui_brand};--ui-btn1-text:#04121e;`
    + `--ui-btn1-hover-bg:color-mix(in srgb, var(--ui-btn1-bg) 85%, #ffffff);--ui-btn1-hover-text:#04121e;`
    + `--ui-btn1-hover-border:color-mix(in srgb, var(--ui-btn1-bg) 85%, #ffffff);`
    + `--ui-btn-text:${t.ui_l_tx};--ui-btn-border:${t.ui_l_line};--ui-btn-hover-bg:${t.ui_l_surface2};--ui-btn-hover-text:${t.ui_l_tx};`
    + `--ui-btni-text:${t.ui_l_tx2};`
    + `--ui-btnd-bg:rgba(220,38,38,.07);--ui-btnd-text:#b91c1c;--ui-btnd-border:rgba(220,38,38,.3);`
    + `--ui-btnd-hover-bg:rgba(220,38,38,.12);--ui-btnd-hover-text:#991b1b;--ui-danger:#dc2626;`
    // плейсхолдер = вторичный текст (#5a6b80 на белом — 5.3:1; прежний ui_l_tx3 давал 3:1)
    + `--ui-inp-bg:${t.ui_l_surface};--ui-inp-text:${t.ui_l_tx};--ui-inp-border:${t.ui_l_line};--ui-inp-ph:${t.ui_l_tx2};--ui-inp-lbl:${t.ui_l_tx2};`
    + `--ui-ico:${t.ui_l_tx2};--ui-ai-bg:rgba(0,114,198,.07);`
    // ERR-56 (15.09.2026): токены карточек из ui.css (:root) светлая тема не трогала —
    // карточки привычек, задач, лидов оставались #141414 под тёмным текстом. Своих ключей
    // в /set не заводим: карточка = поверхность, рамка = линия из вкладки «Тема».
    + `--ui-page-bg:${t.ui_l_bg};--ui-card-bg:${t.ui_l_surface};--ui-card-border:${t.ui_l_line};`
    + `--ui-row-hover:${t.ui_l_surface2};--ui-muted:${t.ui_l_tx3};--ui-tx3:${t.ui_l_tx3};--ui-fold-chev:${t.ui_l_tx2};`
    // активный сегмент фильтра, шторка/модалка, острова-снапы — в тёмной теме у них
    // фолбэк в var(), в светлой берут поверхность
    + `--ui-seg-on:${t.ui_l_surface};--ui-sheet-bg:${t.ui_l_surface};`
    + `--ui-island-bg:${t.ui_l_surface};--ui-island-line:${t.ui_l_line};`
    // 29.09.2026: светлая тема — та же пара ключей, что в тёмной ветке (симметрия наборов):
    // тень ~втрое легче и не чёрная, тост успеха/ошибки — светлая плашка с тёмным текстом.
    + `--ui-shadow-c:rgba(15,28,46,.35);--ui-toast-ok-bg:#ecfdf3;--ui-toast-ok-line:#b7e4c7;`
    + `--ui-toast-err-bg:#fef2f2;--ui-toast-err-line:#fecaca;`
    // тени — та же геометрия, что в тёмной ветке, альфа из ui_sh_*_la (симметрия наборов)
    + shadowVars(t, true)
    + softVars(true);
}

// Сборка темы для конкретного запроса. mode: dark | light | auto (из /set), но выбор человека
// (кука cftheme) сильнее — её ставит переключатель в сайдбаре.
//
// ПОЧЕМУ ТЕМА РЕШАЕТСЯ В CSS, А НЕ СКРИПТОМ В <head>. Скрипт пришлось бы вписать в каждую из
// ~35 страниц (или подмешивать в HTML на лету), и до его выполнения экран успевал бы мигнуть
// чужой темой. /theme.css подключён на всех страницах и приходит ДО отрисовки — значит и
// выбирать тему должен он. Атрибутные правила отдаются ВСЕГДА: по ним переключатель меняет
// тему мгновенно, не перезагружая страницу, а кука закрепляет выбор для следующих заходов.
function themeCss(t, mode) {
  const L = themeVars(t, true), D = themeVars(t, false);
  // Страницы, ещё НЕ переведённые на токены, держат фон и цвет текста литералом в своём
  // <style>. Это правило перекрывает ровно эти два свойства у body, чтобы в светлой теме не
  // оставалось чёрного полотна под светлыми карточками. Точечный !important (ADR-064
  // разрешает точечные): два свойства, один селектор — ковровой перекраски здесь нет.
  const bodyFix = sel => `\n${sel} body{background:var(--ui-bg) !important;color:var(--ui-tx) !important;}`;
  // Тёмный набор — БАЗА корня, а не только ответ на атрибут (19.09.2026, ADR-216).
  // Раньше при mode="dark" на :root не приезжало ничего: тёмная тема держалась на литералах
  // ui.css и фолбэках в var(), то есть ключи /set → «Тема» для тёмной ветки были мертвы, а
  // color-scheme не объявлялся вовсе — нативные пикеры даты и времени браузер рисовал светлыми.
  // :not([data-theme="light"]) снимает базу, когда человек выбрал светлую руками; светлый набор
  // ниже идёт ПОЗЖЕ при равной специфичности (0,2,0), поэтому в режимах light и auto выигрывает он.
  let out = `\n:root[data-theme="light"]{${L}}` + bodyFix(`:root[data-theme="light"]`)
          + `\n:root[data-theme="dark"],:root:not([data-theme="light"]){${D}}`;
  // Светлый набор едет тем же селектором, что и bodyFix рядом: :root:not([data-theme="dark"]).
  // Голый :root (специфичность 0,1,0) равен :root в ui.css — кто победит, решал порядок
  // подключения, а на страницах, где theme.css стоит ДО ui.css (home, clients, indexing,
  // crm-tenant), светлая тема не бралась вовсе. С :not() специфичность 0,2,0: набор выигрывает
  // у ui.css при любом порядке и полностью снимается ручным выбором тёмной (18.09.2026).
  if (mode === "light") out += `\n:root:not([data-theme="dark"]){${L}}` + bodyFix(`:root:not([data-theme="dark"])`);
  else if (mode === "auto") {
    out += `\n@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){${L}}`
        + bodyFix(`:root:not([data-theme="dark"])`) + `}`;
  }
  return out;
}

// CSS-оверрайд поверх ui.css — подключается на всех страницах
const sheetThemeCss = () => "";
export function gen(mode){ const t = { ...THEME_DEFAULTS }; const themeMode = mode;
  const _css = (
    `:root{--ui-brand:${t.ui_brand};--ui-danger:${t.ui_danger};--ui-ico:${t.ui_ico};--ui-ico-opacity:${t.ui_ico_opacity};--ui-ico-size:${t.ui_ico_size};--ui-radius:${t.ui_radius};--ui-pass:${t.ui_pass};`
    + `--ui-btn-bg:${t.ui_btn_bg};--ui-btn-text:${t.ui_btn_text};--ui-btn-border:${t.ui_btn_border};--ui-btn-hover-bg:${t.ui_btn_hover_bg};--ui-btn-hover-text:${t.ui_btn_hover_text};--ui-btn-hover-border:${t.ui_btn_hover_border};`
    + `--ui-btn1-bg:${t.ui_btn1_bg};--ui-btn1-text:${t.ui_btn1_text};--ui-btn1-border:${t.ui_btn1_border};`
    + `--ui-btn1-hover-bg:${t.ui_btn1_hover_bg};--ui-btn1-hover-text:${t.ui_btn1_hover_text};--ui-btn1-hover-border:${t.ui_btn1_hover_border};`
    + `--ui-btnd-bg:${t.ui_btnd_bg};--ui-btnd-text:${t.ui_btnd_text};--ui-btnd-border:${t.ui_btnd_border};`
    + `--ui-btnd-hover-bg:${t.ui_btnd_hover_bg};--ui-btnd-hover-text:${t.ui_btnd_hover_text};--ui-btnd-hover-border:${t.ui_btnd_hover_border};`
    + `--ui-btni-bg:${t.ui_btni_bg};--ui-btni-text:${t.ui_btni_text};--ui-btni-border:${t.ui_btni_border};`
    + `--ui-btni-hover-bg:${t.ui_btni_hover_bg};--ui-btni-hover-text:${t.ui_btni_hover_text};--ui-btni-hover-border:${t.ui_btni_hover_border};`
    + `--ui-btni-pad:${t.ui_btni_pad};--ui-btni-radius:${t.ui_btni_radius};--ui-btni-ico:${t.ui_btni_ico};`
    + `--ui-btn-py:${t.ui_btn_py};--ui-btn-px:${t.ui_btn_px};--ui-btn-fs:${t.ui_btn_fs};--ui-btn-fw:${t.ui_btn_fw};--ui-btn-gap:${t.ui_btn_gap};--ui-btn-ico:${t.ui_btn_ico};`
    + `--ui-btn-sm-py:${t.ui_btn_sm_py};--ui-btn-sm-px:${t.ui_btn_sm_px};--ui-btn-sm-fs:${t.ui_btn_sm_fs};`
    + `--ui-gap:${t.ui_gap};--ui-card-pad:${t.ui_card_pad};--ui-card-radius:${t.ui_card_radius};--ui-page-pad:${t.ui_page_pad};--ui-page-pad-m:${t.ui_page_pad_m};`
    + `--ui-h1-fs:${t.ui_h1_fs};--ui-sub-fs:${t.ui_sub_fs};`
    + `--ui-tile-cols:${t.ui_tile_cols};--ui-tile-gap:${t.ui_tile_gap};--ui-fold-chev:${t.ui_fold_chev};`
    + `--ui-sb-w:${t.ui_sb_w};--ui-sb-min:${t.ui_sb_min};--ui-sb-max:${t.ui_sb_max};--ui-tbl-col-min:${t.ui_tbl_col_min};--ui-w12-gap:${t.ui_w12_gap};--ui-w12-min:${t.ui_w12_min};`
    + `--ui-modal-pad:${t.ui_modal_pad};--ui-modal-gap:${t.ui_modal_gap};--ui-field-h:${t.ui_field_h};--ui-sheet-radius:${t.ui_sheet_radius};--ui-sheet-top:${t.ui_sheet_top};--ui-sheet-gap:${t.ui_sheet_gap};`
    // Шторка (/set → «Шторка», 27.09.2026). Правила компонента — .mdl-*/.sheet-* в ui.css.
    + `--ui-sheet-btn:${t.ui_sheet_btn || "44px"};--ui-sheet-btn-bw:${t.ui_sheet_btn_bw || "1px"};`
    + `--ui-sheet-btn-bc:${t.ui_sheet_btn_bc || "var(--ui-btni-border)"};--ui-sheet-btn-bg:${t.ui_sheet_btn_bg || "var(--ui-btni-bg)"};`
    + `--ui-sheet-title-fs:${t.ui_sheet_title_fs || "14px"};`
    // Информация «i» (/set → «Информация (i)», 27.09.2026). Правила — .ui-info в ui.css.
    + `--ui-info-size:${t.ui_info_size || "26px"};--ui-info-bw:${t.ui_info_bw || "1px"};`
    + `--ui-info-bc:${t.ui_info_bc || "var(--ui-card-border)"};--ui-info-bg:${t.ui_info_bg || "transparent"};`
    + `--ui-info-tx:${t.ui_info_tx || "var(--ui-tx-2)"};--ui-info-hover:${t.ui_info_hover || "var(--ui-brand)"};`
    + `--ui-info-fs:${t.ui_info_fs || "13.5px"};`
    + `--ui-dock-h:${t.ui_dock_h};--ui-dock-btn:${t.ui_dock_btn};--ui-dock-gap:${t.ui_dock_gap};--ui-dock-lift:${t.ui_dock_lift};`
    + `--ui-dock-soft:${t.ui_dock_soft};--ui-dock-side:${t.ui_dock_side};--ui-dock-bottom:${t.ui_dock_bottom};--ui-dock-radius:${t.ui_dock_radius};`
    // Подсветка активной вкладки дока. Без || по умолчанию: "0px" — законное значение
    // (квадрат / без обводки), пустое значение сохранение и так не пропускает.
    + `--ui-dock-sel-radius:${t.ui_dock_sel_radius};--ui-dock-sel-bw:${t.ui_dock_sel_bw};`
    + `--ui-inp-bg:${t.ui_inp_bg};--ui-inp-text:${t.ui_inp_text};--ui-inp-border:${t.ui_inp_border};--ui-inp-ph:${t.ui_inp_ph};`
    + `--ui-inp-focus:${t.ui_inp_focus};--ui-inp-fs:${t.ui_inp_fs};--ui-inp-fw:${t.ui_inp_fw};`
    + `--ui-inp-py:${t.ui_inp_py};--ui-inp-px:${t.ui_inp_px};--ui-inp-radius:${t.ui_inp_radius};`
    + `--ui-inp-lbl-fs:${t.ui_inp_lbl_fs};--ui-inp-lbl:${t.ui_inp_lbl};`
    + `--ui-check-size:${t.ui_check_size};--ui-check-radius:${t.ui_check_radius};--ui-check-color:${t.ui_check_color};`
    + `--ui-ico-stroke:${t.ui_ico_stroke};`
    + `--ui-ai-border:${t.ui_ai_border};--ui-ai-bg:${t.ui_ai_bg};--ui-ai-text:${t.ui_ai_text};`
    // Бейджи (/set → «Бейджи»). Правила компонента — .ui-badge в ui.css.
    + `--ui-badge-bg:${t.ui_badge_bg};--ui-badge-text:${t.ui_badge_text};--ui-badge-fs:${t.ui_badge_fs};--ui-badge-fw:${t.ui_badge_fw};`
    + `--ui-badge-h:${t.ui_badge_h};--ui-badge-px:${t.ui_badge_px};--ui-badge-radius:${t.ui_badge_radius};`
    + `--ui-badge-dot:${t.ui_badge_dot};--ui-badge-cap:${t.ui_badge_cap};`
    // Вкладки (/set → «Вкладки», 23.09.2026). Правила компонента — .ui-tabs/.ui-tab в ui.css.
    + `--ui-tab-h:${t.ui_tab_h || "36px"};--ui-tab-fs:${t.ui_tab_fs || "13px"};--ui-tab-fw:${t.ui_tab_fw || "600"};--ui-tab-px:${t.ui_tab_px || "12px"};`
    + `--ui-tab-radius:${t.ui_tab_radius || "8px"};--ui-tab-gap:${t.ui_tab_gap || "4px"};`
    + `--ui-tab-bg:${t.ui_tab_bg || "var(--ui-surface-2)"};--ui-tab-tx:${t.ui_tab_tx || "var(--ui-tx-2)"};`
    + `--ui-tab-on-bg:${t.ui_tab_on_bg || "var(--ui-card-border)"};--ui-tab-on-tx:${t.ui_tab_on_tx || "var(--ui-tx)"};--ui-tab-line:${t.ui_tab_line || "var(--ui-brand)"};`
    // незаданные переменные не выводим вовсе — иначе `--ui-nav-ico:` сломает объявление,
    // а сайдбары должны остаться на своих фолбэках из var(..., 17px/18px)
    + ["ui_nav_ico", "ui_nav_gap", "ui_nav_pad", "ui_nav_fs"]
        .filter(k => String(t[k] || "").trim())
        .map(k => `--${k.replace(/_/g, "-")}:${t[k]};`).join("")
    + `--ui-bg:${t.ui_bg};--ui-surface:${t.ui_surface};--ui-surface-2:${t.ui_surface2};--ui-surface-3:${t.ui_surface3};`
    + `--ui-line:${t.ui_line};--ui-line-2:${t.ui_line2};--ui-tx:${t.ui_tx};--ui-tx-2:${t.ui_tx2};--ui-tx-3:${t.ui_tx3};`
    + `--ui-ok:${t.ui_ok};--ui-warn:${t.ui_warn};color-scheme:dark;`
    // Тёмный набор цветов типов файлов (/structure) — в базовый :root, как ok/warn:
    // при mode=dark themeCss на голый :root ничего не пишет, и без этой строки
    // переменной бы не существовало вовсе.
    + `--ui-ft-dir:${t.ui_ft_dir};--ui-ft-code:${t.ui_ft_code};--ui-ft-page:${t.ui_ft_page};--ui-ft-doc:${t.ui_ft_doc};`
    + `}`
    + themeCss(t, themeMode)
    // ===== Меню и иконки (/set → «Меню и иконки») =====
    // Толщину штриха задаёт <style> внутри самого спрайта assets/icons.svg — он читает --ui-ico-stroke.
    // Геометрия сайдбаров: правила ниже идут в theme.css, но сайдбары рисуются скриптами
    // (sidebar.js, cab-sidebar.js) и вставляют свой <style> в head ПОЗЖЕ — при равной специфичности
    // выигрывает их правило. Поэтому там значения тоже заведены через var(), а здесь — только
    // страховка для client.html, где CSS сайдбара лежит инлайном в самом файле.
    + `\n.cl-sb a.cl-nav,.cl-sb .cl-nav,.cl-nav{gap:var(--ui-nav-gap,9px);padding:var(--ui-nav-pad,9px) 10px;font-size:var(--ui-nav-fs,13px);}`
    + `\n.cl-nav .ico,.cl-sb .ico{width:var(--ui-nav-ico,17px);height:var(--ui-nav-ico,17px);}`
    + `\n#app-sidebar a.sb-link{gap:var(--ui-nav-gap,11px);padding-top:var(--ui-nav-pad,8px);padding-bottom:var(--ui-nav-pad,8px);font-size:var(--ui-nav-fs,14px);}`
    + `\n#app-sidebar a.sb-link .ico{width:var(--ui-nav-ico,18px);height:var(--ui-nav-ico,18px);}`
    // Вид ВСЕХ кнопок платформы — см. btnCss() и BTN_ROLES выше. Здесь ничего про кнопки не пишем.
    + btnCss(t)
    // Вид ВСЕХ полей ввода — см. inpCss() выше. Идёт после кнопок: у input[type=submit] и
    // прочих кнопок-инпутов роль кнопки, и они из селекторов полей вычтены.
    + inpCss(t)
    // Высота шторки (ui_sheet_h/_min) и нативный вид по устройству (ui_os_*): только если заданы (sheet_theme.js)
    + sheetThemeCss(t)
    // Чипы на экране (/set → «Чипы»): пять координатных переменных + кегль, отдельно для
    // ПК и телефона. Сами правила #ui-toasts / #plt-toast-stack — в ui.css.
    + toastCss(t)
    // ===== Заголовок H1 и подзаголовок шапки — единый источник правды для ВСЕЙ платформы
    // (30.08.2026). Раньше размер H1 был литералом в каждой странице (18px на служебных,
    // 22-30px на карточных, 34px на медкарте) — правка требовала лезть в файл каждой
    // страницы. !important здесь бьёт даже инлайн-стили в разметке (font-size:34px и т.п.),
    // поэтому достаточно одной настройки в /set, чтобы поменять размер сразу везде.
    // Исключение — класс .no-ui-h1: страницы входа/регистрации (auth) со своей маркетинговой
    // типографикой — /patient-auth (единый вход медкарты и трекера привычек), /crm/auth
    // (вход в CRM). У них отзывчивый font-size:clamp(...) и трогать его этой настройкой не нужно.
    // index.html (дашборд платформы) и policy.html (политика данных) — обычные страницы портала,
    // тоже подчиняются этой настройке, никакого исключения у них нет.
    + `\nh1:not(.no-ui-h1){font-size:var(--ui-h1-fs,25px) !important;}`
    // Подзаголовок шапки — вторая строка под H1 (название текущей вкладки/раздела),
    // класс .ph1-sub. Не трогаем голый h2/.sub — они заняты под модалки, карточки и т.п.
    // в десятках страниц, единый подзаголовок живёт только на выделенном классе.
    + `\n.ph1-sub:not(.no-ui-h1){font-size:var(--ui-sub-fs,15px) !important;}`
    // единый чекбокс на всей платформе — системный вид, брендовый цвет
    + `\ninput[type=checkbox]{accent-color:var(--ui-check-color,var(--ui-brand,#00a0ff));width:var(--ui-check-size,16px);height:var(--ui-check-size,16px);cursor:pointer;}`
    // «Фирменный вид ко всем чекбоксам» (/set → Чекбоксы). Исключение — .no-ui-check (тумблеры-переключатели)
    + (String(t.ui_check_all) === "1"
        ? `\ninput[type=checkbox]:not(.no-ui-check){appearance:none;-webkit-appearance:none;flex:0 0 var(--ui-check-size,16px);margin:0;`
          + `border:1px solid #3a3a3a;border-radius:var(--ui-check-radius,4px);background:#151515;vertical-align:-3px;`
          + `display:inline-grid;place-content:center;transition:background .15s,border-color .15s;}`
          + `\ninput[type=checkbox]:not(.no-ui-check)::before{content:"";width:56%;height:56%;background:#fff;transform:scale(0);transition:transform .12s;`
          + `clip-path:polygon(14% 44%,0 65%,50% 100%,100% 16%,80% 0%,43% 62%);}`
          + `\ninput[type=checkbox]:not(.no-ui-check):hover:not(:disabled){border-color:var(--ui-check-color,var(--ui-brand,#00a0ff));}`
          + `\ninput[type=checkbox]:not(.no-ui-check):checked{background:var(--ui-check-color,var(--ui-brand,#00a0ff));border-color:var(--ui-check-color,var(--ui-brand,#00a0ff));}`
          + `\ninput[type=checkbox]:not(.no-ui-check):checked::before{transform:scale(1);}`
          + `\ninput[type=checkbox]:not(.no-ui-check):disabled{opacity:.45;cursor:not-allowed;}`
        : ``)
    // кнопки и элементы, которые видит только супер-админ — красные, как баннер режима ПМ
    + `\n.tbtn.pm-only,.pm-only{background:#3a0d0d;color:#f87171;border-color:#7a2e0b;}`
    + `\n.tbtn.pm-only:hover{background:#4a1010;color:#ff8f8f;border-color:#a03c0e;}`
    // рамка по краям экрана — видно, что ты в кабинете клиента под супер-админом
    + `\n#pm-frame{position:fixed;inset:0;border:3px solid var(--ui-brand,#00a0ff);pointer-events:none;z-index:99998;}`
    // 17.09.2026: подпись режима — компактная плашка в правом верхнем углу (на ПК не мешает шапке)
    + `\n#pm-frame::after{content:attr(data-label);position:absolute;top:10px;right:14px;`
    + `background:rgba(224,82,82,.14);color:#f87171;border:1px solid rgba(224,82,82,.5);font-size:11px;font-weight:600;letter-spacing:.02em;`
    + `padding:4px 12px;border-radius:999px;font-family:-apple-system,sans-serif;white-space:nowrap;}`
    + `\n@media (max-width:768px){#pm-frame::after{top:0;right:auto;left:50%;transform:translateX(-50%);border-radius:0 0 8px 8px;border-top:0;padding:2px 10px;font-size:10px;}}`
    // ===== AI-ответ (/set → «Кнопки» → «AI-ответ») =====
    // Единый визуальный признак текста, который сгенерировал AI-агент, а не написал человек:
    // пунктирная рамка + значок молнии (i-zap из assets/icons.svg). Заведён здесь, а не
    // локальным CSS страницы — чтобы новые места (KPI-агент, med-analiz-bot, генерации,
    // трекер привычек) подключались одним классом, а не копипастили стили.
    // .ai-note — блок текста; .ai-badge — маленькая пилюля-ярлык (AI / СЧЁТ и т.п.).
    + `\n.ai-note{display:flex;gap:10px;background:var(--ui-ai-bg,rgba(0,160,255,.06));`
    + `border:1px dashed var(--ui-ai-border,var(--ui-brand,#00a0ff));border-radius:var(--ui-radius,8px);`
    + `padding:11px 12px;}`
    + `\n.ai-note svg{width:15px;height:15px;stroke:var(--ui-ai-text,var(--ui-brand,#00a0ff));fill:none;`
    + `stroke-width:2;flex-shrink:0;margin-top:1px;}`
    + `\n.ai-note b{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ui-ai-text,var(--ui-brand,#00a0ff));margin-bottom:3px;font-weight:600;}`
    + `\n.ai-note span{font-size:12px;color:var(--ui-tx-2,#8b8b8b);line-height:1.5;}`
    + `\n.ai-badge{font-size:9.5px;font-weight:700;letter-spacing:.04em;color:var(--ui-ai-text,var(--ui-brand,#00a0ff));`
    + `background:var(--ui-ai-bg,rgba(0,160,255,.12));border:1px solid var(--ui-ai-border,var(--ui-brand,#00a0ff));`
    + `border-radius:4px;padding:1px 5px;flex-shrink:0;}`
  );
return _css; }
