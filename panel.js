/* © Сергей Гуров · Михаил Матвеев · Александр Копинов, 2026 · панель стендов · метод «Основа» · stendy.vercel.app */
/* ────────────────────────────────────────────────────────────────────
   Панель стенда — единая логика (пара к /panel.css).

   Подключение в стенде:
     <link rel="stylesheet" href="/panel.css">
     <script src="/panel.js"></script>

   Вызов:
     StendPanel.build({
       storageKey: 'имя-стенда-params',  // где живут значения
       params: P,                        // живой объект параметров
       defaults: DEFAULTS,               // исходные значения
       defs: [                           // строки панели по порядку
         ['h', 'Секция'],                //   заголовок секции
         [key, 'Подпись', min, max, шаг],//   слайдер
         [key, 'Подпись', 'ease'],       //   изинг: селект + редактор безье
         [key, 'Подпись', 'color'],      //   цвет: квадрат-пипетка ('#rrggbb')
       ],
       desc: { key: 'описание...' },     // всплывающие подсказки
       eases: EASES,                     // словарь пресетов-изингов
       evalEase: fn(name, bez, t),       // вычислитель изинга слота
       bezApprox: { name: [x1,y1,x2,y2] } // безье-приближения пресетов
     });

   Для изинг-слота key вида fooEase рукоятки безье живут в params.fooBez.
   Темы: «Эпл» (по умолчанию) и «Нотхинг», переключатель в подвале панели,
   выбор хранится в localStorage 'stend-panel-theme' и общий для всех стендов.
   ──────────────────────────────────────────────────────────────────── */
(function () {
  var THEME_KEY = 'stend-panel-theme';

  // Точный ввод числа — единые клавиши для всех полей панели и органов:
  // стрелки ±1, с Shift ±10 (как в Фигме), запятая читается как точка.
  /* ── ПИКЕР ЦВЕТА (устройство Миши Матвеева, 03.09) ────────────────
     Квадрат насыщенность×яркость, полоса тона, пипетка, поле HEX.
     Числа с его мастера: поле 8, ряд тона 28, зазор до пипетки 4,
     пипетка квадратная 28. Квадрат — во всю ширину строки и такой же
     высоты: обе оси квадрата равноправны, сплющивать нечего. */
  function hslVCvet(h, s2, v) {          // тон 0…360, насыщенность и яркость 0…1
    var f = function (n) {
      var k = (n + h / 60) % 6;
      return v - v * s2 * Math.max(0, Math.min(k, 4 - k, 1));
    };
    var d2 = function (x) { return ('0' + Math.round(x * 255).toString(16)).slice(-2); };
    return '#' + d2(f(5)) + d2(f(3)) + d2(f(1));
  }
  function cvetVHsv(hex) {
    var m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
    if (!m) return [0, 0, 1];
    var r = parseInt(m[1], 16) / 255, g2 = parseInt(m[2], 16) / 255, b2 = parseInt(m[3], 16) / 255;
    var mx = Math.max(r, g2, b2), mn = Math.min(r, g2, b2), dl = mx - mn;
    var h = 0;
    if (dl) {
      if (mx === r) h = 60 * (((g2 - b2) / dl) % 6);
      else if (mx === g2) h = 60 * ((b2 - r) / dl + 2);
      else h = 60 * ((r - g2) / dl + 4);
    }
    if (h < 0) h += 360;
    return [h, mx ? dl / mx : 0, mx];
  }
  /* Пикер отдан наружу целиком (StendPanel.piker): стенды рисовали свой
   цвет нативным input[type=color], и тот поднимал системное окно macOS
   поверх стенда — чужая раскладка вместо своей (диагональ, 03.09).
   Значение читается и пишется колбэками, поэтому пикер годится и ручке
   панели, и любому месту стенда.
     opt = { znachenie: fn → '#rrggbb', postavit: fn(hex) }
   Отдаёт { svotch, pole, obnovit }. */
  function pikerCveta(opt) {
    var chitat = opt.znachenie, pisat = opt.postavit;
    var hsv = cvetVHsv(chitat());
    var svotch = document.createElement('button');
    svotch.type = 'button'; svotch.className = 'st-svotch';
    svotch.setAttribute('aria-expanded', 'false');
    svotch.title = 'открыть пикер';
    var pole = document.createElement('div');
    pole.className = 'st-cvet'; pole.hidden = true;

    var kv = document.createElement('canvas');       // квадрат насыщенность×яркость
    kv.className = 'st-cvet-kv'; kv.width = 272; kv.height = 272;
    var kvTochka = document.createElement('i'); kvTochka.className = 'st-cvet-tochka';
    var kvObl = document.createElement('div'); kvObl.className = 'st-cvet-obl';
    kvObl.appendChild(kv); kvObl.appendChild(kvTochka);

    var ryad = document.createElement('div'); ryad.className = 'st-cvet-ryad';
    var ton = document.createElement('div'); ton.className = 'st-cvet-ton';
    var tonTochka = document.createElement('i'); tonTochka.className = 'st-cvet-tt';
    ton.appendChild(tonTochka);
    var pipetka = document.createElement('button');
    pipetka.type = 'button'; pipetka.className = 'st-cvet-pip';
    pipetka.title = 'снять цвет с экрана';
    pipetka.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true">' +
      '<path d="M13.5 3.2a2 2 0 0 1 2.8 2.8l-1.4 1.4-2.8-2.8 1.4-1.4z"/>' +
      '<path d="M11.4 5.3 13.5 7.4 7 13.9l-2.8.7.7-2.8L11.4 5.3z"/></svg>';
    // пипетка есть не везде: без неё ряд просто короче, а не сломан
    if (!window.EyeDropper) pipetka.hidden = true;
    ryad.appendChild(ton); ryad.appendChild(pipetka);

    var niz = document.createElement('div'); niz.className = 'st-cvet-niz';
    var hexPole = document.createElement('input');
    hexPole.type = 'text'; hexPole.className = 'st-cvet-hex'; hexPole.spellcheck = false;
    hexPole.setAttribute('aria-label', 'цвет шестнадцатеричным числом');
    niz.appendChild(hexPole);

    pole.appendChild(kvObl); pole.appendChild(ryad); pole.appendChild(niz);

    function risovatKvadrat() {
      var g = kv.getContext('2d'), w = kv.width, h = kv.height;
      g.fillStyle = 'hsl(' + hsv[0] + ',100%,50%)'; g.fillRect(0, 0, w, h);
      var gb = g.createLinearGradient(0, 0, w, 0);
      gb.addColorStop(0, '#fff'); gb.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gb; g.fillRect(0, 0, w, h);
      var gc = g.createLinearGradient(0, 0, 0, h);
      gc.addColorStop(0, 'rgba(0,0,0,0)'); gc.addColorStop(1, '#000');
      g.fillStyle = gc; g.fillRect(0, 0, w, h);
    }
    function pokazat() {
      var hex = chitat();
      svotch.style.background = hex;
      hexPole.value = hex.toUpperCase();
      kvTochka.style.left = (hsv[1] * 100) + '%';
      kvTochka.style.top = ((1 - hsv[2]) * 100) + '%';
      kvTochka.style.background = hex;
      tonTochka.style.left = (hsv[0] / 360 * 100) + '%';
      risovatKvadrat();
    }
    function polozhit() {
      pisat(hslVCvet(hsv[0], hsv[1], hsv[2]));
      pokazat();
    }
    // тяга по квадрату и по полосе тона — одним приёмом
    function tyaga(el, shag) {
      function hod(e) {
        var r = el.getBoundingClientRect();
        shag(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
             Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
        polozhit();
      }
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault(); el.setPointerCapture(e.pointerId); hod(e);
        function dv(e2) { if (el.hasPointerCapture(e2.pointerId)) hod(e2); }
        el.addEventListener('pointermove', dv);
        el.addEventListener('pointerup', function up() {
          el.removeEventListener('pointermove', dv);
          el.removeEventListener('pointerup', up);
        });
      });
    }
    tyaga(kvObl, function (x, y) { hsv[1] = x; hsv[2] = 1 - y; });
    tyaga(ton, function (x) { hsv[0] = x * 360; });

    /* HEX принимается и коротким: «#fff» — та же запись цвета, что и
       «#ffffff», и рука её пишет чаще. Разворачиваем сами, а кривой ввод
       не молчит: поле краснеет и остаётся (правка 03.09). */
    hexPole.addEventListener('input', function () {
      hexPole.classList.remove('oshibka'); hexPole.removeAttribute('aria-invalid');
    });
    hexPole.addEventListener('change', function () {
      var v = hexPole.value.trim().replace(/^#/, '');
      if (/^[\da-f]{3}$/i.test(v)) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
      if (!/^[\da-f]{6}$/i.test(v)) {
        hexPole.classList.add('oshibka'); hexPole.setAttribute('aria-invalid', 'true');
        return;
      }
      pisat('#' + v.toLowerCase()); hsv = cvetVHsv(chitat()); pokazat();
    });
    pipetka.addEventListener('click', function () {
      if (!window.EyeDropper) return;
      new window.EyeDropper().open().then(function (r) {
        pisat(r.sRGBHex.toLowerCase()); hsv = cvetVHsv(chitat()); pokazat();
      }).catch(function () {});
    });
    svotch.addEventListener('click', function () {
      pole.hidden = !pole.hidden;
      svotch.setAttribute('aria-expanded', String(!pole.hidden));
      if (!pole.hidden) risovatKvadrat();
    });
    function obnovit() { hsv = cvetVHsv(chitat()); pokazat(); }
    obnovit();
    return { svotch: svotch, pole: pole, obnovit: obnovit };
  }


  /* ── ПОЛЕ ВВОДА ОДНИМ БЛОКОМ (Г5, Г8, Г9) ──────────────────────────
     Собирает плашку «подпись внутри слева, число справа». Нажатие в любое
     место плашки — включая подпись и пустое место — ставит курсор в поле и
     ВЫДЕЛЯЕТ число целиком: клик в середину числа ставил курсор между цифр,
     и правка начиналась с попадания в букву (жалоба Сергея 03.09).
     Отдаёт { box, inp }. */
  /* ── ЧИСЛО НА ЭТАЖЕ ИМЕНИ — ОБЩИЙ БЛОК ЯДРА (Г9, ход 65) ────────────
     Пара нитке. Нитка тянется, число вводят здесь: показатель стоит всегда
     обычным текстом (Г3), клик поднимает плашку с полем ровно на его месте —
     габариты одни, правый край не едет, вертикаль рифмовки цела (эталон
     Сергея 03.09). Поле принимает выражения, стрелки шагают ШАГОМ ВЕЛИЧИНЫ
     и правят сразу, кривой ввод по Enter краснеет, уход из поля отменяет.

     Прежде это жило только в строителе строк, и у органов со своей ниткой
     точного ввода не было — его добирали кликом по числу в пилюле. Два дела
     на одной цели: ровно то, от чего ушли, сняв стрелки с пилюли (03.09).
     Теперь у числа своё место, и клик по пилюле снят везде (слово Сергея
     04.09).

     Вызов:
       var c = StendPanel.chisloBlok({
         imya, min, max, shag,        — подпись для голоса и границы
         znachenie: () => число,      — откуда читать
         postavit:  (v) => {},        — куда писать (принято полем)
         tekst:     (v) => строка,    — как показывать (не обязательно)
         znak                         — элемент внутрь плашки слева (точка увода)
       });
       c.obl        — .st-imya-pole-obl, класть на этаж имени
       c.obnovit()  — перечитать значение */
  function chisloBlok(o) {
    var obl = document.createElement('div');
    obl.className = 'st-imya-pole-obl';
    var pokaz = document.createElement('button');
    pokaz.type = 'button'; pokaz.className = 'st-imya-chislo';
    pokaz.setAttribute('aria-label', (o.imya || '') + ': ввести число');
    pokaz.title = 'клик — ввести число; выражения: 700/2, +25';
    var pole = document.createElement('input');
    pole.type = 'text'; pole.inputMode = 'decimal';
    pole.className = 'st-imya-pole'; pole.hidden = true;
    pole.setAttribute('aria-label', (o.imya || '') + ': ввести число');

    function chitat() { return +o.znachenie(); }
    function tekst() { return o.tekst ? o.tekst(chitat()) : String(parseFloat(chitat().toFixed(4))); }
    function obnovit() {
      var t = tekst();
      pokaz.textContent = t;
      if (document.activeElement !== pole) pole.value = t;
    }
    function otkryt() {
      if (!pole.hidden) return;
      pokaz.hidden = true; pole.hidden = false;
      obl.classList.add('vvod');
      pole.value = tekst();
      pole.focus(); pole.select();
    }
    function zakryt() {
      pole.hidden = true; pokaz.hidden = false;
      obl.classList.remove('vvod');
      pole.classList.remove('oshibka'); pole.removeAttribute('aria-invalid');
      obnovit();
    }
    function prinyat(myagko) {
      var v = vyrazhenie(pole.value, chitat());
      if (isNaN(v)) v = chislo(pole.value);
      if (isNaN(v)) {
        // кривой ввод по Enter не молчит: поле остаётся и краснеет
        if (myagko) { pole.classList.add('oshibka'); pole.setAttribute('aria-invalid', 'true'); }
        return false;
      }
      var lo = parseFloat(o.min), hi = parseFloat(o.max);
      if (!isNaN(lo)) v = Math.max(lo, v);
      if (!isNaN(hi)) v = Math.min(hi, v);
      o.postavit(v);
      obnovit();
      return true;
    }
    pokaz.addEventListener('click', otkryt);
    pole.addEventListener('input', function () {
      pole.classList.remove('oshibka'); pole.removeAttribute('aria-invalid');
    });
    pole.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); if (prinyat(true)) zakryt(); return; }
      if (ev.key === 'Escape') { ev.preventDefault(); zakryt(); pokaz.focus(); return; }
      if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
      /* Стрелки шагают ШАГОМ ВЕЛИЧИНЫ и правят сразу. Общий помощник
         klavishiChisla шагал единицей и только переписывал текст: у кегля с
         шагом 0.2 щелчок прыгал впятеро, а нитка стояла до ухода из поля
         (правка 03.09). */
      ev.preventDefault();
      var krupno = (parseFloat(o.shag) || 1) * (ev.shiftKey ? 10 : 1);
      pole.value = parseFloat((chitat() + (ev.key === 'ArrowUp' ? krupno : -krupno)).toFixed(4));
      prinyat(true);
    });
    pole.addEventListener('blur', function () { prinyat(false); zakryt(); });
    /* Г4: знак увода — ВНУТРИ плашки, раз поле есть. Снаружи он стоял бы в
       другом месте, чем у строк с полем ввода, а два места для одного знака —
       грязь (правка Сергея 03.09). */
    if (o.znak) obl.appendChild(o.znak);
    obl.appendChild(pokaz); obl.appendChild(pole);
    obnovit();                       // число стоит сразу, а не после первой правки
    return { obl: obl, pokaz: pokaz, pole: pole, obnovit: obnovit };
  }

  /* ── НИТКА — ОБЩИЙ БЛОК ЯДРА (Г9, ход 64) ──────────────────────────
     Эталон Сергея 03.09: трек и заливка — свои элементы, родная шайба
     прозрачна и равна пилюле по ширине, число едет в пилюле. Пять органов
     рисовали свой `<input type=range>` и красили его сокращённым
     свойством `background` — оно затирает трёхпиксельную дорожку из
     `panel.css`, и градиент заливал всю высоту: толстая синяя полоса
     старого образца (снимки Сергея 04.09, ход 61). Своей нитки больше нет
     ни у кого: орган берёт блок.

     Вызов:
       var n = StendPanel.nitkaBlok({
         min, max, shag,            — границы и шаг
         znachenie: () => число,    — откуда читать
         postavit:  (v) => {},      — куда писать (тяга, стрелки, колесо)
         tekst:     (v) => строка,  — что показывать в пилюле (не обязательно)
         umolchanie:() => число,    — дабл-клик по пилюле, насечка на дорожке
                                      и магнит к ней (не обязательно)
         inp, val                   — готовые элементы, если они уже есть
       });
       n.obl        — .st-nitka, класть в строку
       n.inp, n.val — нитка и число в пилюле
       n.obnovit()  — перечитать значение и перекрасить
     Заливка и ход пилюли считаются ОДНИМ законом: пилюля ходит от половины
     своей ширины до W минус половина, и заливка кончается там же, где её
     центр (правка 03.09 — иначе синяя то не доходит, то вылезает). */
  function nitkaBlok(o) {
    var obl = document.createElement('div'); obl.className = 'st-nitka';
    var fill = document.createElement('div'); fill.className = 'st-nitka-fill';
    var inp = o.inp || document.createElement('input');
    inp.type = 'range';
    if (o.min !== undefined) inp.min = o.min;
    if (o.max !== undefined) inp.max = o.max;
    if (o.shag !== undefined) inp.step = o.shag;
    var val = o.val || document.createElement('span');
    if (!val.className) val.className = 'val';
    var pil = document.createElement('span'); pil.className = 'st-pil';
    /* ОДНА ЦЕЛЬ — ОДНА ФУНКЦИЯ (правка Сергея 03.09, подтверждена 04.09):
       пилюля показывает и тянется, число вводят блоком `chisloBlok` на этаже
       имени. Клика по числу в пилюле нет ни у ядра, ни у органов — второе
       дело на той же цели и есть то, от чего ушли, сняв с пилюли стрелки. */
    val.style.pointerEvents = 'none'; val.tabIndex = -1;
    val.removeAttribute('role'); val.title = '';
    pil.appendChild(val);
    /* НАСЕЧКА УМОЛЧАНИЯ (11.09, снято с панели Миши: «трек рисует насечку на
       дефолте и магнитится к ней»). Точка увода говорит, ЧТО ручка уведена;
       насечка говорит, ОТКУДА. Пока значение стоит на умолчании, её нет —
       показывать место, на котором и так стоишь, незачем. */
    var zarubka = null;
    if (o.umolchanie) {
      zarubka = document.createElement('i'); zarubka.className = 'st-zarubka';
      zarubka.hidden = true; obl.appendChild(zarubka);
    }
    obl.appendChild(fill); obl.appendChild(inp); obl.appendChild(pil);

    function chitat() { return o.znachenie ? +o.znachenie() : parseFloat(inp.value); }
    function pisat(v) { if (o.postavit) o.postavit(v); }
    function pokrasit() {
      var lo = parseFloat(inp.min), hi = parseFloat(inp.max);
      var p = hi > lo ? (parseFloat(inp.value) - lo) / (hi - lo) * 100 : 0;
      p = Math.max(0, Math.min(100, p));
      var hw = (pil.offsetWidth || 39) / 2;
      inp.style.setProperty('--st-pill', hw * 2 + 'px');
      var hod = 'calc(' + hw + 'px + ' + (p / 100) + ' * (100% - ' + hw * 2 + 'px))';
      pil.style.left = hod;
      fill.style.width = hod;
      /* Насечка идёт тем же законом, что пилюля и заливка: одна формула хода
         на все три, иначе метка разъезжается с тем, что метит. */
      if (zarubka) {
        var u = o.umolchanie();
        if (u === undefined || !(hi > lo)) zarubka.hidden = true;
        else {
          var pu = Math.max(0, Math.min(1, (u - lo) / (hi - lo)));
          zarubka.style.left = 'calc(' + hw + 'px + ' + pu + ' * (100% - ' + hw * 2 + 'px))';
          var sh0 = parseFloat(inp.step) || 1;
          zarubka.hidden = Math.abs(parseFloat(inp.value) - u) < sh0 / 2;
        }
      }
    }
    function obnovit() {
      var v = chitat();
      if (!isNaN(v) && document.activeElement !== inp) inp.value = v;
      val.textContent = o.tekst ? o.tekst(chitat()) : String(parseFloat((+inp.value).toFixed(4)));
      pokrasit();
    }
    inp.addEventListener('input', function () { pisat(parseFloat(inp.value)); obnovit(); });
    pil.addEventListener('pointerdown', function (ev) {
      ev.preventDefault(); pil.setPointerCapture(ev.pointerId); pil.classList.add('tyanem');
    });
    pil.addEventListener('pointermove', function (ev) {
      if (!pil.hasPointerCapture(ev.pointerId)) return;
      var r = obl.getBoundingClientRect(), hw = pil.offsetWidth / 2;
      var q = Math.max(0, Math.min(1, (ev.clientX - r.left - hw) / ((r.width - 2 * hw) || 1)));
      var lo = parseFloat(inp.min), hi = parseFloat(inp.max), sh = parseFloat(inp.step) || 1;
      var v = lo + Math.round(q * (hi - lo) / sh) * sh;
      /* МАГНИТ К УМОЛЧАНИЮ. Радиус берётся В ПИКСЕЛЯХ ДОРОЖКИ, а не долей
         величины: рука метит в место на экране, и на ручке с вилкой до трёх
         тысяч доля дала бы притяжение во весь экран. Alt снимает магнит —
         иначе значение рядом с умолчанием стало бы недостижимым. */
      if (o.umolchanie && !ev.altKey && hi > lo) {
        var uz = o.umolchanie();
        if (uz !== undefined) {
          var shirPx = (r.width - 2 * hw) || 1;
          if (Math.abs((v - uz) / (hi - lo) * shirPx) <= 5) v = uz;
        }
      }
      inp.value = parseFloat(v.toFixed(6));
      inp.dispatchEvent(new Event('input'));
    });
    pil.addEventListener('pointerup', function () { pil.classList.remove('tyanem'); });
    pil.addEventListener('dblclick', function () {
      if (!o.umolchanie) return;
      var v = o.umolchanie();
      if (v === undefined) return;
      inp.value = v; pisat(v); obnovit();
    });
    // ширина пилюли меняется с числом — ход и заливка идут за ней
    if (window.ResizeObserver) new ResizeObserver(pokrasit).observe(pil);
    inp.__nitka = { pokrasit: pokrasit, obnovit: obnovit };
    /* Блок показывает величину С РОЖДЕНИЯ. Прежде первый показ был на
       совести органа, и пружина вышла с пустыми пилюлями и без заливки
       (поймано снимком 04.09): значение есть, а на экране его нет — ровно
       то, что Г3 запрещает. Ширины пилюли в этот миг ещё нет — её принесёт
       ResizeObserver, когда нитку положат в панель. */
    obnovit();
    return { obl: obl, inp: inp, val: val, pil: pil, obnovit: obnovit, pokrasit: pokrasit };
  }

  function poleBlok(podpis, opt) {
    opt = opt || {};
    var box = document.createElement('div');
    box.className = 'st-pole-blok';
    /* Два положения подписи, и оба законны (04.09):
         внутри (по умолчанию, Г5) — для ряда x/y/r, где подпись есть
           единица величины и снаружи съела бы ширину;
         сверху ({ sverhu: true }) — для коридора и пары, где подпись
           читается заголовком поля («от» / «до» на эталоне Сергея).
       Наружу отдаётся одна и та же пара { box, inp }: орган не выбирает
       разметку, он выбирает положение. */
    if (podpis && !opt.sverhu) {
      var i = document.createElement('i'); i.textContent = podpis; box.appendChild(i);
    }
    var inp = document.createElement('input');
    inp.type = 'text'; inp.inputMode = opt.celoe ? 'numeric' : 'decimal';
    inp.setAttribute('aria-label', opt.imya || podpis || '');
    box.appendChild(inp);
    // нажатие по плашке мимо поля — тот же жест, что и по полю
    box.addEventListener('pointerdown', function (e) {
      if (e.target === inp) return;
      e.preventDefault(); inp.focus();
    });
    // выделяем всё и по мыши, и с клавиатуры: правят число целиком
    inp.addEventListener('focus', function () { setTimeout(function () { inp.select(); }, 0); });
    if (opt.sverhu) {
      var stolb = document.createElement('div');
      stolb.className = 'st-pole-stolb';
      var nad = document.createElement(opt.dlyaPolya ? 'label' : 'span');
      if (!opt.dlyaPolya) nad.className = 'st-pole-nad';
      nad.textContent = podpis || '';
      stolb.appendChild(nad); stolb.appendChild(box);
      return { box: stolb, inp: inp, nad: nad, plashka: box };
    }
    return { box: box, inp: inp, plashka: box };
  }

  function klavishiChisla(ked) {
    ked.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
      ev.preventDefault();
      var v = parseFloat(String(ked.value).replace(',', '.')) || 0;
      var shag = ev.shiftKey ? 10 : 1;
      ked.value = parseFloat((v + (ev.key === 'ArrowUp' ? shag : -shag)).toFixed(4));
    });
  }
  function chislo(v) { return parseFloat(String(v).replace(',', '.')); }

  /* Математика в поле числа — снято с eval-number-expression из раздатки
     Михаила Матвеева: «700/2» → 350, «(3+1)*20» → 80, запятая как точка.
     Ведущий «+» — относительный ввод: «+50» прибавляет к текущему
     (поэтому «+50-20» прибавляет 30). Кривой ввод возвращает NaN —
     вызывающий решает, что делать с отказом. */
  function vyrazhenie(syroj, tekushchee) {
    var t = String(syroj).trim();
    if (!t) return NaN;
    var otnositelno = t.charAt(0) === '+';
    if (otnositelno) t = t.slice(1);
    t = t.replace(/,/g, '.');
    if (!/^[-+*/().\d\s]+$/.test(t)) return NaN;
    var poz = 0;
    function summa() {
      var v = proizvedenie();
      while (poz < t.length) {
        var z = t.charAt(poz);
        if (z === '+') { poz++; v += proizvedenie(); }
        else if (z === '-') { poz++; v -= proizvedenie(); }
        else break;
      }
      return v;
    }
    function proizvedenie() {
      var v = mnozhitel();
      while (poz < t.length) {
        var z = t.charAt(poz);
        if (z === '*') { poz++; v *= mnozhitel(); }
        else if (z === '/') { poz++; v /= mnozhitel(); }
        else break;
      }
      return v;
    }
    function mnozhitel() {
      while (t.charAt(poz) === ' ') poz++;
      var z = t.charAt(poz);
      if (z === '(') {
        poz++;
        var v = summa();
        if (t.charAt(poz) === ')') poz++;
        while (t.charAt(poz) === ' ') poz++;
        return v;
      }
      if (z === '-') { poz++; return -mnozhitel(); }
      var m = /^\d*\.?\d+/.exec(t.slice(poz));
      if (!m) return NaN;
      poz += m[0].length;
      while (t.charAt(poz) === ' ') poz++;
      return parseFloat(m[0]);
    }
    var itog = summa();
    if (poz < t.length || isNaN(itog) || !isFinite(itog)) return NaN;
    itog = otnositelno ? (tekushchee || 0) + itog : itog;
    return parseFloat(itog.toFixed(6));
  }
  // Реестр органов управления (библиотека /panel-lib): StendPanel.tip('имя', fn).
  // fn(row, d, P, api) строит строку панели; api = {save, host, bindTip, accent, repaints, controls}
  var TIPY = {};

  /* Значение → строка для query: массивы через запятую, объекты — JSON,
     иначе String. Без этого объекты дают литерал «[object Object]». */
  function znachenieVAdres(v) {
    if (Array.isArray(v)) return v.join(',');
    if (v != null && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  /* База ссылки: у file:// origin = «null», pathname — путь без схемы. */
  function bazovyjAdres() {
    if (location.protocol === 'file:' || !location.origin || location.origin === 'null')
      return location.href.split('#')[0].split('?')[0];
    return location.origin + location.pathname;
  }

  /* Строка query → значение по образцу из DEFAULTS. Невалидный JSON объекта — undefined. */
  function znachenieIzAdresa(s, obrazec) {
    if (obrazec != null && typeof obrazec === 'object' && !Array.isArray(obrazec)) {
      try { return JSON.parse(s); } catch (e) { return undefined; }
    }
    if (Array.isArray(obrazec)) {
      if (s.charAt(0) === '[') {
        try { return JSON.parse(s); } catch (e) { /* дальше — через запятую */ }
      }
      var chasti = s.split(',');
      if (obrazec.length && typeof obrazec[0] === 'number') {
        return chasti.map(function (x) { return parseFloat(x); });
      }
      return chasti;
    }
    if (typeof obrazec === 'number') return parseFloat(s);
    if (typeof obrazec === 'boolean') return s === 'true' || s === '1';
    return s;
  }

  var PROPUSTIT_ADRES = { moment: 1, theme: 1, mesto: 1, nabor: 1, panel: 1, reset: 1, diag: 1 };

  function primenitParametryAdresa(params, defaults) {
    var q = location.search;
    if (!q || q.length < 2) return;
    q.slice(1).split('&').forEach(function (para) {
      if (!para) return;
      var i = para.indexOf('=');
      var k = decodeURIComponent((i < 0 ? para : para.slice(0, i)).replace(/\+/g, ' '));
      if (PROPUSTIT_ADRES[k] || !Object.prototype.hasOwnProperty.call(defaults, k)) return;
      var syro = i < 0 ? '' : decodeURIComponent(para.slice(i + 1).replace(/\+/g, ' '));
      var v = znachenieIzAdresa(syro, defaults[k]);
      if (v === undefined) return;
      params[k] = v;
    });
  }

  function build(o) {
    /* ── ВИТРИННЫЙ ГЕЙТ (решение Сергея 02.09) ────────────────────────
       Публичные витрины показывают готовый результат — панель живёт на
       локалке: работаем дома, наружу уходит решённое. Спит панель только
       на НАШИХ адресах; студенческие и чужие домены не задеты — у них
       панель остаётся частью результата. Страница может оставить панель
       себе флагом window.STEND_PANEL_VSEGDA (каталог органов: его
       содержимое и есть панель). Возвращается пустышка с рабочим API —
       стенд, читающий P и зовущий obnovit, ничего не замечает. */
    var VITRINA = /stendy\.vercel\.app$|ocnova-lab\.github\.io$|xn--80apagbbfxgmuj4j|osnova-workshop\.vercel\.app$|gurovdsgn\.vercel\.app$|modulnyi-longread\.vercel\.app$|mdl-gr2\.vercel\.app$|mapa-grid\.vercel\.app$|osnova-gallery\.vercel\.app$|gurov-works\.vercel\.app$/;
    if (!window.STEND_PANEL_VSEGDA && VITRINA.test(location.hostname)) {
      var pusto = function () {};
      var pustNabor = pusto; pustNabor.vyhod = pusto;
      return {
        save: pusto, panel: document.createElement('div'), applyTheme: pusto,
        params: o.params, defaults: o.defaults, controls: {},
        obnovit: pusto, nabor: pustNabor, mesto: pusto, vyhod: pusto,
      };
    }

    // ?reset=1 — аварийный сброс сохранённых настроек ещё до применения
    if (/[?&]reset/.test(location.search)) {
      try { localStorage.removeItem(o.storageKey); } catch (e) {}
      Object.assign(o.params, o.defaults);
      Object.keys(o.defaults).forEach(function (k) { // массивы и объекты — копиями:
        // otkloneniya стилей по умолчанию — объект; ссылка дала бы правку DEFAULTS
        if (Array.isArray(o.defaults[k])) o.params[k] = o.defaults[k].slice();
        else if (o.defaults[k] && typeof o.defaults[k] === 'object') {
          o.params[k] = JSON.parse(JSON.stringify(o.defaults[k]));
        }
      });
    }
    // ?ключ=… — восстановить вид из «Ссылка на этот вид» / момента скраба
    primenitParametryAdresa(o.params, o.defaults);
    /* ОБЪЯВЛЕНИЕ вместо defs. Стенд может отдать не готовые строки панели, а
       объявление величин — что меряется и от чего. Границы, шаг, орган и
       единицу подставит таблица величин (/panel-lib/obyavlenie.js).

         zakon: [['h', 'Шрифт'], ['kegl', 'Кегль', 'кегль'],
                 ['btm', 'Кегль внизу', 'доля', { ot: 'кегль' }]]

       Механика живёт здесь, числа — в библиотеке: таблица ещё меняется от
       замера к замеру, и вшивать её в общий файл рано. Стенды на defs
       ничего не замечают — ветка включается только при наличии zakon. */
    if (o.zakon && !o.defs) {
      if (typeof StendPanel !== 'undefined' && StendPanel.izObyavleniya) {
        // mesta — словарь мест стенда: 'Строка': '.line'. Закон помечается
        // gde:'Строка' и попадает в карту StendPanel.karta.
        o.defs = StendPanel.izObyavleniya(o.zakon, o.mesta);
      } else {
        // Молча отдать пустую панель — худшее, что можно сделать: стенд
        // выглядит сломанным, а причина не названа.
        throw new Error('StendPanel: объявление (zakon) требует /panel-lib/obyavlenie.js');
      }
    }
    var P = o.params, DEFAULTS = o.defaults, DESC = o.desc || {};
    var EASES = o.eases || {};
    var evalEase = o.evalEase;
    var BEZ_APPROX = o.bezApprox || {};

    function save() {
      try { localStorage.setItem(o.storageKey, JSON.stringify(P)); } catch (e) {}
    }

    // Любая правка ручки проходит здесь: сохранение, уведомление стенда (o.onChange —
    // нужен DOM-стендам, canvas читает P каждый кадр сам) и событие для органов
    // вроде отката, которым нужно знать о правке, не зная, кто её сделал.
    var hozyaeva = {};   // хозяин фазы → чьи ручки он гасит; заполняется из карты
    var fazaKesh = {};   // последние виденные значения хозяев
    function izmenilos(key) {
      save();
      /* ОТРАЖЕНИЯ: одну величину можно показать в нескольких кластерах, и
         правка любого показа обязана тянуть остальные. Обновлялка ключа
         склеена из всех показов (svyazatControl), поэтому достаточно её
         позвать; тот показ, который правят руками, уже стоит верно, и
         повтор ему безвреден — значение то же. Флаг против рекурсии:
         обновлялка не шлёт событий правки, но пусть будет явно. */
      if (!vOtrazhenii && key && controls[key]) {
        vOtrazhenii = true;
        try { controls[key](); } finally { vOtrazhenii = false; }
      }
      /* Фаза: повернулся хозяин — часть ручек умерла или ожила. Сверяются
         ВСЕ хозяева, не только key: пресет меняет пачку параметров разом,
         а izmenilos приходит с ключом самого пресета. Хозяев единицы —
         сверка дешевле пропущенной фазы. */
      var smena = false;
      for (var h in hozyaeva) {
        if (P[h] !== fazaKesh[h]) { smena = true; fazaKesh[h] = P[h]; }
      }
      if (smena) perestroitVid();
      if (typeof o.onChange === 'function') o.onChange(key, P);
      svetlota();
      try {
        document.dispatchEvent(new CustomEvent('stend:izmenenie', {
          detail: { key: key, params: P, storageKey: o.storageKey },
        }));
      } catch (e) {}
    }

    /* ── каркас: кнопка панели, панель, подсказка ──
       КНОПКА ГОВОРИТ, ЧТО СДЕЛАЕТ (правка Сергея 03.09). Закрытая панель —
       ручки-ползунки: «здесь настройки». Открытая — крестик: «нажми, и
       закрою». Одна цель на оба хода, и рисунок на ней меняется вместе с
       делом; иконка настроек поверх открытой панели обещала бы открыть то,
       что уже открыто. */
    var ZNAK_RUCHKI =
      '<svg viewBox="0 0 17 17" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round">' +
      '<line x1="1.5" y1="3.5" x2="15.5" y2="3.5"/><circle cx="11" cy="3.5" r="2.1" fill="#141416"/>' +
      '<line x1="1.5" y1="8.5" x2="15.5" y2="8.5"/><circle cx="5.5" cy="8.5" r="2.1" fill="#141416"/>' +
      '<line x1="1.5" y1="13.5" x2="15.5" y2="13.5"/><circle cx="9" cy="13.5" r="2.1" fill="#141416"/>' +
      '</svg>';
    var ZNAK_KREST =
      '<svg viewBox="0 0 17 17" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round">' +
      '<line x1="4.2" y1="4.2" x2="12.8" y2="12.8"/><line x1="12.8" y1="4.2" x2="4.2" y2="12.8"/>' +
      '</svg>';
    var gear = document.createElement('button');
    gear.className = 'st-gear';
    gear.type = 'button';
    gear.innerHTML = ZNAK_RUCHKI;
    var panel = document.createElement('div');
    panel.className = 'st-panel';
    panel.hidden = true;

    /* ── ОКНО ПАНЕЛИ (правка приёмки 02.09) ───────────────────────────
       Панель закрывала собой куски макета — а клик по месту требует
       макет видеть. Теперь она окно: перенос за шапку, пропорции —
       системным уголком (правый нижний угол), дабл-клик по шапке
       возвращает на место. Привычка руки одна на все стенды —
       хранится глобально, как тема. На узком экране панель остаётся
       нижним листом, окна там нет. */
    var OKNO_KEY = 'stend-panel-okno';
    var uzkiy = function () { return window.innerWidth < 560; };
    function oknoPrivyazka() {
      // из прибитого низа — в свободный верх: до первого переноса панель
      // живёт как раньше, после — координатами окна
      if (panel.style.top) return;
      var r = panel.getBoundingClientRect();
      panel.style.top = r.top + 'px';
      panel.style.left = r.left + 'px';
      panel.style.bottom = 'auto';
    }
    function oknoSohranit() {
      try {
        localStorage.setItem(OKNO_KEY, JSON.stringify({
          left: panel.style.left, top: panel.style.top,
          w: panel.style.width, h: panel.style.height,
        }));
      } catch (e) {}
    }
    function oknoVernut() {
      panel.style.top = ''; panel.style.left = '';
      panel.style.bottom = ''; panel.style.width = ''; panel.style.height = '';
      try { localStorage.removeItem(OKNO_KEY); } catch (e) {}
      skrollObnovit();
    }
    (function oknoVosstanovit() {
      if (uzkiy()) return;
      var o2 = null;
      try { o2 = JSON.parse(localStorage.getItem(OKNO_KEY) || 'null'); } catch (e) {}
      if (!o2) return;
      if (o2.top) {
        // окно не должно восстановиться за кромкой экрана
        var t = Math.max(0, Math.min(parseFloat(o2.top) || 0, window.innerHeight - 80));
        var l = Math.max(0, Math.min(parseFloat(o2.left) || 0, window.innerWidth - 80));
        panel.style.top = t + 'px'; panel.style.left = l + 'px';
        panel.style.bottom = 'auto';
      }
      if (o2.w) panel.style.width = o2.w;
      if (o2.h) panel.style.height = o2.h;
    })();
    /* Пользовательский размер: системный уголок пишет inline width/height.
       Захват у правого нижнего угла переводит окно на верхнюю привязку —
       иначе прибитый низ рос бы вверх из-под курсора; отпускание руки
       сохраняет (ResizeObserver дублирует, но он спит там, где не гонятся
       кадры). */
    if (window.ResizeObserver) {
      var roT = null;
      new ResizeObserver(function () {
        if (!panel.style.width && !panel.style.height) return;
        oknoPrivyazka();
        clearTimeout(roT); roT = setTimeout(oknoSohranit, 300);
      }).observe(panel);
    }
    /* ── ТЕЛО ПАНЕЛИ ──────────────────────────────────────────────────
       Прокручивается тело, а не панель: полоса прокрутки вынесена наружу
       (правка Сергея 03.09). Внутри она отъедала правую колонку — панель
       садилась несимметрично, и рифмовка вертикалей ехала. */
    /* ПОИСК ПО РУЧКАМ. Панель растёт вместе со стендом, и на полутора сотнях
       величин в двух десятках подгрупп человек перестаёт понимать, ГДЕ искать
       нужную (Сергей 10.09: «открываю панели и просто не понимаю, где какая
       ручка»). Свёрнутость и порядок кластеров про привычку руки, а поиск —
       про вопрос «где то, что я ищу»: это разные задачи, и вторая до сих пор
       не была решена ничем.
       ПРЯЧЕМ СВОИМ КЛАССОМ, А НЕ hidden. Атрибутом пользуется сам стенд, а
       классом `st-vne` — перестроение вида; три механизма на одном атрибуте
       дрались бы, и первый же клик по панели стирал бы отбор (Сергей 10.09:
       «кликнул на панельку — всё исчезло»). Прячет тот, кто сказал прятать,
       остальные складываются.
       Ищем по трём слоям сразу: имя ручки на экране, её ключ в коде и текст
       подсказки. Подсказка тут не роскошь — человек помнит не имя ручки, а
       что она делает: «орбита», «моргает», «за оборот». */
    /* ПОИСК ПЕРЕЖИВАЕТ ПЕРЕЗАГРУЗКУ (Сергей 10.09: «нашёл панельку, перезагрузил
       — и ищи заново»). Отбор — это тоже привычка руки, как свёрнутость: если
       человек работает над орбитой, он работает над ней и после F5. Живёт
       рядом со свёрнутостью, своим ключом и не мешает значениям.
       ИСТОРИЯ — тот же список, только показанный: последние запросы отдаются
       нативным списком подсказок, он открывается и по клику, и при наборе.
       Своего выпадающего меню не пишем: браузер уже умеет это лучше. */
    var POISK_KEY = 'stend-panel-poisk:' + o.storageKey;
    var poiskPamyat = { q: '', ist: [] };
    try { poiskPamyat = JSON.parse(localStorage.getItem(POISK_KEY)) || poiskPamyat; } catch (e) {}
    /* Пустые в историю не пускаем ни на входе, ни на чтении: они попадали
       туда из прежних редакций и занимали места живых запросов. */
    poiskPamyat.ist = (poiskPamyat.ist || []).filter(function (q) { return q && q.trim(); });
    var poisk = document.createElement('input');
    poisk.type = 'search'; poisk.className = 'st-poisk';
    poisk.setAttribute('aria-label', 'найти ручку');
    poisk.placeholder = 'Поиск';
    /* СПИСОК СВОЙ, А НЕ НАТИВНЫЙ. У <datalist> подсказки открываются кликом по
       стрелке или набором — а нужно по НАВЕДЕНИЮ (Сергей 10.09: «наводим, и
       внизу появляется история; не надо кликать»). Своим списком это делается
       прямо, чужим — никак: браузер не отдаёт его показ наружу. */
    var spisok = document.createElement('div');
    spisok.className = 'st-poisk-ist'; spisok.hidden = true;
    function narisovatIstoriyu() {
      spisok.innerHTML = '';
      poiskPamyat.ist.forEach(function (q) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'st-poisk-ist-q'; b.textContent = q;
        b.addEventListener('click', function () {
          poisk.value = q; filtrPoiska(q); zapomnitPoisk(q, true); skryt();
        });
        spisok.appendChild(b);
      });
      /* Перерисовка не показывает список: он открывается ТОЛЬКО наведением.
         Прежде здесь стояло `hidden = !длина`, и при непустой истории список
         висел раскрытым с самой загрузки. */
      if (!poiskPamyat.ist.length) spisok.hidden = true;
    }
    /* ДЕРЖИТСЯ, ПОКА КУРСОР НА ПОЛЕ ИЛИ НА САМОМ СПИСКЕ: иначе из поля до
       подсказки не дойти — она исчезнет по дороге. Уход проверяется не сразу,
       а через кадр: переход между двумя соседями идёт через миг, когда
       курсор формально не на обоих. */
    var nadPolem = false, nadSpiskom = false, tProverki = 0;
    function pokazat() { if (poiskPamyat.ist.length) spisok.hidden = false; }
    function skryt() { spisok.hidden = true; }
    function proverit() {
      clearTimeout(tProverki);
      tProverki = setTimeout(function () {
        if (nadPolem || nadSpiskom) pokazat(); else skryt();
      }, 80);
    }
    poisk.addEventListener('pointerenter', function () { nadPolem = true; proverit(); });
    poisk.addEventListener('pointerleave', function () { nadPolem = false; proverit(); });
    poisk.addEventListener('focus', function () { nadPolem = true; proverit(); });
    spisok.addEventListener('pointerenter', function () { nadSpiskom = true; proverit(); });
    spisok.addEventListener('pointerleave', function () { nadSpiskom = false; proverit(); });
    function zapomnitPoisk(q, vIstoriyu) {
      poiskPamyat.q = q;
      if (vIstoriyu && q && q.trim()) {
        poiskPamyat.ist = [q].concat(poiskPamyat.ist.filter(function (x) { return x !== q; })).slice(0, 4);
        narisovatIstoriyu();
      }
      try { localStorage.setItem(POISK_KEY, JSON.stringify(poiskPamyat)); } catch (e) {}
    }
    narisovatIstoriyu(); spisok.hidden = true;
    /* Поле и список — в одной обёртке: список ложится ПОД полем вплотную,
       и переход курсора с одного на другой не рвётся зазором. */
    var poiskObl = document.createElement('div'); poiskObl.className = 'st-poisk-obl';
    poiskObl.appendChild(poisk); poiskObl.appendChild(spisok);
    panel.appendChild(poiskObl);
    var telo = document.createElement('div');
    telo.className = 'st-telo';
    panel.appendChild(telo);
    /* Свёрнутость до поиска запоминается и возвращается на пустой строке:
       поиск — гость, он не должен переставлять привычки руки. */
    var svyorntostDoPoiska = null, grpDoPoiska = null;
    function filtrPoiska(q) {
      q = (q || '').trim().toLowerCase();
      var kartochki = telo.querySelectorAll('.card');
      var gruppy = telo.querySelectorAll('.st-grp');
      if (!q) {
        for (var i = 0; i < kartochki.length; i++) {
          var c = kartochki[i], hh = c.previousElementSibling;
          c.classList.remove('st-naydeno');
          if (hh) hh.classList.remove('st-ne-nayden');
          var rr = c.querySelectorAll('.row');
          for (var j = 0; j < rr.length; j++) rr[j].classList.remove('st-ne-nayden');
          c.classList.remove('st-ne-nayden');
          if (svyorntostDoPoiska) c.hidden = !!svyorntostDoPoiska[i];
        }
        /* Подгруппы возвращаются к своей свёрнутости: она про привычку руки,
           и поиск, уходя, обязан её отдать в том же виде, в каком взял. */
        for (var g0 = 0; g0 < gruppy.length; g0++) {
          gruppy[g0].classList.remove('st-ne-nayden');
          if (grpDoPoiska) gruppy[g0].classList.toggle('st-grp-zakryta', !!grpDoPoiska[g0]);
        }
        svyorntostDoPoiska = null; grpDoPoiska = null;
        return;
      }
      if (!grpDoPoiska) {
        grpDoPoiska = [];
        for (var g1 = 0; g1 < gruppy.length; g1++)
          grpDoPoiska.push(gruppy[g1].classList.contains('st-grp-zakryta'));
      }
      if (!svyorntostDoPoiska) {
        svyorntostDoPoiska = [];
        for (var k = 0; k < kartochki.length; k++) svyorntostDoPoiska.push(kartochki[k].hidden);
      }
      for (var n = 0; n < kartochki.length; n++) {
        var card = kartochki[n], h = card.previousElementSibling;
        var imyaSek = ((h && h.textContent) || '').toLowerCase();
        var rows = card.querySelectorAll('.row'), naydeno = 0;
        for (var m = 0; m < rows.length; m++) {
          var row = rows[m];
          var klyuch = (row.getAttribute('data-k') || '').toLowerCase();
          var vidno = (row.textContent || '').toLowerCase();
          var podsk = '';
          var el = row.querySelector('[title]'); if (el) podsk = (el.getAttribute('title') || '').toLowerCase();
          if (!podsk && row.title) podsk = row.title.toLowerCase();
          var est = klyuch.indexOf(q) >= 0 || vidno.indexOf(q) >= 0 ||
                    podsk.indexOf(q) >= 0 || imyaSek.indexOf(q) >= 0;
          row.classList.toggle('st-ne-nayden', !est); if (est) naydeno++;
        }
        /* ПОДГРУППЫ РАСКРЫВАЮТСЯ ВМЕСТЕ С НАЙДЕННЫМ. Панель двухуровневая:
           скрыть строку мало, если подгруппа над ней свёрнута — человек
           по-прежнему не видит того, что нашлось. Пустые подгруппы уходят
           целиком: в отобранном списке им места нет. */
        var grp = card.querySelectorAll('.st-grp');
        for (var gi = 0; gi < grp.length; gi++) {
          var gr = grp[gi], grows = gr.querySelectorAll('.row'), gest = 0;
          for (var gj = 0; gj < grows.length; gj++) if (!grows[gj].classList.contains('st-ne-nayden')) gest++;
          gr.classList.toggle('st-ne-nayden', !gest);
          if (gest) gr.classList.remove('st-grp-zakryta');
        }
        card.classList.toggle('st-ne-nayden', !naydeno);
        if (naydeno) card.hidden = false;       // найденное раскрываем, свёрнутость вернём на выходе
        card.classList.toggle('st-naydeno', !!naydeno);
        if (h) h.classList.toggle('st-ne-nayden', !naydeno);
      }
    }
    /* В историю запрос идёт по ЗАВЕРШЁННОМУ вводу, а не на каждый знак:
       иначе «о», «ор», «орб» съели бы весь список из четырёх мест. */
    poisk.addEventListener('input', function () { filtrPoiska(poisk.value); zapomnitPoisk(poisk.value, false); });
    poisk.addEventListener('change', function () { zapomnitPoisk(poisk.value, true); });
    poisk.addEventListener('blur', function () { zapomnitPoisk(poisk.value, true); });
    poisk.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { zapomnitPoisk(poisk.value, true); poisk.blur(); }
      if (e.key === 'Escape') { poisk.value = ''; filtrPoiska(''); zapomnitPoisk('', false); poisk.blur(); }
    });
    /* Отбор возвращается ПОСЛЕ сборки секций: до неё фильтровать нечего. */
    function vernutPoisk() {
      if (!poiskPamyat.q) return;
      poisk.value = poiskPamyat.q;
      filtrPoiska(poiskPamyat.q);
    }

    /* Своя полоса прокрутки: справа за кромкой, от 10 сверху до 10 снизу —
       начинается там, где кончается закругление правого верхнего угла. */
    var skroll = document.createElement('div');
    skroll.className = 'st-skroll';
    var begunok = document.createElement('div');
    begunok.className = 'st-skroll-b';
    skroll.appendChild(begunok);
    panel.appendChild(skroll);

    function skrollObnovit() {
      var vidno = telo.clientHeight, vsego = telo.scrollHeight;
      if (vsego <= vidno + 1) { skroll.hidden = true; return; }
      skroll.hidden = false;
      var trekH = skroll.clientHeight;
      var h = Math.max(24, trekH * vidno / vsego);
      var hod = trekH - h;
      var p = telo.scrollTop / (vsego - vidno);
      begunok.style.height = h + 'px';
      begunok.style.top = (hod * p) + 'px';
      // у правого края экрана полосе не хватает места — уходит влево
      var r = panel.getBoundingClientRect();
      skroll.classList.toggle('sleva', r.right + 10 > window.innerWidth);
    }
    telo.addEventListener('scroll', skrollObnovit, { passive: true });
    window.addEventListener('resize', skrollObnovit);
    if (window.ResizeObserver) new ResizeObserver(skrollObnovit).observe(telo);
    (function begunokTyaga() {
      var y0 = 0, s0 = 0, tyanem = false;
      begunok.addEventListener('pointerdown', function (e) {
        e.preventDefault(); tyanem = true; y0 = e.clientY; s0 = telo.scrollTop;
        begunok.classList.add('tyanem'); skroll.classList.add('zhivaya');
      });
      document.addEventListener('pointermove', function (e) {
        if (!tyanem) return;
        var trekH = skroll.clientHeight, h = begunok.offsetHeight;
        var hod = trekH - h; if (hod <= 0) return;
        telo.scrollTop = s0 + (e.clientY - y0) * (telo.scrollHeight - telo.clientHeight) / hod;
      });
      document.addEventListener('pointerup', function () {
        if (!tyanem) return;
        tyanem = false; begunok.classList.remove('tyanem'); skroll.classList.remove('zhivaya');
      });
      // клик по треку — прыжок страницей
      skroll.addEventListener('pointerdown', function (e) {
        if (e.target !== skroll) return;
        var r = skroll.getBoundingClientRect();
        telo.scrollTop += (e.clientY < r.top + begunok.offsetTop ? -1 : 1) * telo.clientHeight * .9;
      });
    })();

    /* Кромка размера вместо системного уголка: засечку в правом нижнем углу
       Сергей снял 03.09, а тяга окна осталась — просто стала невидимой. */
    var tyaga = document.createElement('div');
    tyaga.className = 'st-tyaga';
    tyaga.title = 'потянуть размер панели';
    panel.appendChild(tyaga);
    (function tyagaRazmera() {
      var x0 = 0, y0 = 0, w0 = 0, h0 = 0, tyanem = false;
      tyaga.addEventListener('pointerdown', function (e) {
        if (uzkiy()) return;
        e.preventDefault(); e.stopPropagation();
        var r = panel.getBoundingClientRect();
        tyanem = true; x0 = e.clientX; y0 = e.clientY; w0 = r.width; h0 = r.height;
        oknoPrivyazka();
      });
      document.addEventListener('pointermove', function (e) {
        if (!tyanem) return;
        panel.style.width = Math.max(280, w0 + e.clientX - x0) + 'px';
        panel.style.height = Math.max(180, h0 + e.clientY - y0) + 'px';
      });
      document.addEventListener('pointerup', function () {
        if (!tyanem) return;
        tyanem = false; oknoSohranit(); skrollObnovit();
      });
    })();

    var tip = document.createElement('div');
    tip.className = 'st-tip'; tip.id = 'st-tip'; tip.setAttribute('role', 'tooltip');
    document.body.appendChild(gear);
    document.body.appendChild(panel);
    document.body.appendChild(tip);

    function accent() {
      return (getComputedStyle(panel).getPropertyValue('--st-accent') || '#0A84FF').trim();
    }

    // ── тема: общая для всех стендов ──
    var theme = 'apple';
    try { theme = localStorage.getItem(THEME_KEY) || 'apple'; } catch (e) {}
    var tm = location.search.match(/[?&]theme=(\w+)/);
    if (tm) theme = tm[1]; // ?theme=nothing — быстрый просмотр темы
    var repaints = []; // что перекрасить при смене темы (заливки, кривые)
    /* Тема живёт классом на панели, а не на документе: стенд не обязан
       краснеть вместе с ней. Значит всё, что панель ставит СНАРУЖИ — слой
       мест, слой правки, инструмент на экране, — тему получает поимённо.
       `temaSyuda` записывает такой элемент, и он идёт за темой дальше сам. */
    var vneshnie = [];
    function temaSyuda(el) {
      if (el && vneshnie.indexOf(el) < 0) vneshnie.push(el);
      if (el) el.classList.toggle('st-theme-nothing', theme === 'nothing');
      return el;
    }
    function applyTheme(name) {
      theme = name;
      [gear, panel, tip].concat(vneshnie).forEach(function (el) {
        el.classList.toggle('st-theme-nothing', name === 'nothing');
      });
      try { localStorage.setItem(THEME_KEY, name); } catch (e) {}
      repaints.forEach(function (f) { f(); });
    }
    /* ПЛОТНОСТЬ СТЕКЛА ПО СВЕТЛОТЕ СТРАНИЦЫ — закон записан в panel.css у
       .st-nad-svetlym. Светлота берётся с фона body, затем html; прозрачный
       фон считается белым, как в браузере. Сверяется при сборке и после
       каждой правки: палитру стенда меняют ручкой. Ошибка в безопасную
       сторону: неизвестный фон → плотнее. */
    function svetlota() {
      var c = null;
      [document.body, document.documentElement].some(function (el) {
        var m = (getComputedStyle(el).backgroundColor || '').match(/[\d.]+/g);
        if (m && m.length >= 3 && (m.length < 4 || parseFloat(m[3]) > 0)) { c = m; return true; }
        return false;
      });
      var L = c ? (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 : 1;
      [gear, panel, tip].forEach(function (el) { el.classList.toggle('st-nad-svetlym', L > 0.5); });
    }

    // ── подсказки: справа от панели, у своей строки ──
    function bindTip(el, key) {
      if (!DESC[key]) return;
      function pokazat() {
        tip.textContent = opisanie(key);
        tip.classList.add('show');
        var r = el.getBoundingClientRect();
        var pr = panel.getBoundingClientRect();
        tip.style.left = (pr.right + 8) + 'px';
        var top = r.top - 4;
        top = Math.max(8, Math.min(top, window.innerHeight - tip.offsetHeight - 8));
        tip.style.top = top + 'px';
      }
      function spryatat() { tip.classList.remove('show'); }
      el.addEventListener('mouseenter', pokazat);
      el.addEventListener('mouseleave', spryatat);
      /* Клавиатура: фокус в строке показывает ту же подсказку — иначе
         описание ручки живёт только под мышью (приёмка HIG 02.09). */
      el.addEventListener('focusin', pokazat);
      el.addEventListener('focusout', spryatat);
    }

    /* ── слайдер: заливка идёт от блока нитки (Г9, ход 64) ──────────────
       Прежде здесь жил и запасной путь — красить фоном самого инпута, если
       заливки-элемента нет. Им пользовались пять органов со своей ниткой, и
       он же давал старый толстый ползунок. Запасного пути больше нет: нет
       блока — нечего красить. */
    function paintFill(inp) {
      if (inp && inp.__nitka) inp.__nitka.pokrasit();
    }
    // ручка панели: тот же пикер, значение живёт в P
    function stroitCvet(key) {
      var pk = pikerCveta({
        znachenie: function () { return P[key]; },
        postavit: function (hex) { P[key] = hex; izmenilos(key); },
      });
      svyazatControl(key, pk.obnovit);
      return pk;
    }

    // ── редактор кривой: график + две рукоятки безье ──
    var CRV_LO = -0.35, CRV_HI = 1.35;
    function buildCurveEditor(easeKey, bezKey, sel) {
      var cv = document.createElement('canvas');
      cv.className = 'curve';
      cv.width = 552; cv.height = 552; // квадрат — кривую удобно лепить
      function X(t) { return t * cv.width; }
      function Y(v) { return cv.height - (v - CRV_LO) / (CRV_HI - CRV_LO) * cv.height; }
      function redraw() {
        var g = cv.getContext('2d');
        var w = cv.width, h = cv.height;
        var b = P[bezKey];
        var custom = P[easeKey] === 'bezier';
        var ac = accent();
        g.clearRect(0, 0, w, h);
        g.fillStyle = '#101012'; g.fillRect(0, 0, w, h);
        /* СЕТКА КВАДРАТА. Клеток по стороне — восемь: вдвое подробнее эталона
           (правка Сергея 03.09). Сетка живёт в рабочем квадрате 0…1, а не по
           всему полю: поле шире квадрата на выбег рукояток (CRV_LO…CRV_HI),
           и линии за границей врали бы про доли. */
        var KLETOK = 8;
        g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1.5;
        for (var i = 1; i < KLETOK; i++) {
          g.beginPath(); g.moveTo(X(i / KLETOK), Y(0)); g.lineTo(X(i / KLETOK), Y(1)); g.stroke();
          g.beginPath(); g.moveTo(0, Y(i / KLETOK)); g.lineTo(w, Y(i / KLETOK)); g.stroke();
        }
        // границы квадрата: доли 0 и 1 — опоры, они ярче сетки
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2;
        [0, 1].forEach(function (v) {
          g.beginPath(); g.moveTo(0, Y(v)); g.lineTo(w, Y(v)); g.stroke();
        });
        // ровный ход пунктиром: с чем сравнивают кривую
        g.save();
        g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(1), Y(1)); g.stroke();
        g.restore();
        // рычаги: от опор (0,0) и (1,1) к контрольным точкам
        g.strokeStyle = custom ? ac : 'rgba(255,255,255,.28)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(b[0]), Y(b[1])); g.stroke();
        g.beginPath(); g.moveTo(X(1), Y(1)); g.lineTo(X(b[2]), Y(b[3])); g.stroke();
        // сама кривая — то, что реально исполняет анимация; акцентом, как
        // на эталоне Сергея (03.09): кривая — предмет, а не разметка
        g.strokeStyle = ac; g.lineWidth = 3;
        g.beginPath();
        for (var x = 0; x <= w; x += 2) {
          var v = evalEase(P[easeKey], b, x / w);
          if (x === 0) g.moveTo(x, Y(v)); else g.lineTo(x, Y(v));
        }
        g.stroke();
        // контрольные точки с белым кольцом
        [[b[0], b[1]], [b[2], b[3]]].forEach(function (pt) {
          g.beginPath(); g.arc(X(pt[0]), Y(pt[1]), 9, 0, Math.PI * 2);
          // рукоятки белые: рука берётся за них, а не за кривую
          g.fillStyle = custom ? '#fff' : 'rgba(255,255,255,.45)'; g.fill();
          g.lineWidth = 2.5; g.strokeStyle = custom ? ac : 'rgba(255,255,255,.5)'; g.stroke();
        });
      }
      /* ── РУКА НА КРИВОЙ ──────────────────────────────────────────────
         Раньше бралась только рукоятка, и то ближайшая из двух: клик в
         пустое место телепортировал её к курсору. Отсюда «деревянность».
         Теперь два жеста, разведённые целью: у рукоятки (ближе 22 px)
         берётся рукоятка, в любом другом месте — САМА КРИВАЯ, и тяга
         распределяется между рукоятками по их влиянию в этой точке
         (веса Бернштейна кубического безье). Тянешь за середину — едут
         обе; тянешь у края — едет ближняя. */
      var CEL = 22;                      // цель захвата рукоятки, px
      var dragPt = -1;                   // 0 или 1 — рукоятка, -1 — нет
      var tyanemKrivuyu = false;
      var start = null;

      function vEkran(bx, by, r) {
        return { x: r.left + bx * r.width,
                 y: r.top + (CRV_HI - by) / (CRV_HI - CRV_LO) * r.height };
      }
      function blizhe(e) {                // какая рукоятка под курсором, если есть
        var r = cv.getBoundingClientRect(), b = P[bezKey];
        var d = [0, 1].map(function (i) {
          var p2 = vEkran(b[i * 2], b[i * 2 + 1], r);
          return Math.sqrt((e.clientX - p2.x) * (e.clientX - p2.x) +
                           (e.clientY - p2.y) * (e.clientY - p2.y));
        });
        var i2 = d[0] <= d[1] ? 0 : 1;
        return d[i2] <= CEL ? i2 : -1;
      }
      function okrugl(v, shift) {        // Shift — привязка к сетке восьмых
        return shift ? Math.round(v * 8) / 8 : Math.round(v * 100) / 100;
      }
      function zapisat(b) {
        P[bezKey] = b;
        if (P[easeKey] !== 'bezier') { P[easeKey] = 'bezier'; sel.value = 'bezier'; }
        redraw(); obnovitPolya(); izmenilos(easeKey);
      }
      function tyanutRukoyatku(e) {
        var r = cv.getBoundingClientRect();
        var tx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        var vy = Math.max(CRV_LO, Math.min(CRV_HI,
          CRV_HI - (e.clientY - r.top) / r.height * (CRV_HI - CRV_LO)));
        var b = P[bezKey].slice();
        b[dragPt * 2] = okrugl(tx, e.shiftKey);
        b[dragPt * 2 + 1] = okrugl(vy, e.shiftKey);
        zapisat(b);
      }
      function tyanutKrivuyu(e) {
        var r = cv.getBoundingClientRect();
        var dx = (e.clientX - start.x) / r.width;
        var dy = -(e.clientY - start.y) / r.height * (CRV_HI - CRV_LO);
        // влияние рукояток в точке захвата: чем ближе к рукоятке, тем больше
        var t = start.t, u = 1 - t;
        var w1 = 3 * u * u * t, w2 = 3 * u * t * t;
        /* На самых краях (t ровно 0 или 1) оба веса Бернштейна нулевые, и
           кривая не двигалась вовсе — мёртвая полоска по кромкам графика
           (правка 03.09). Там влияние целиком у ближней рукоятки. */
        if (!(w1 + w2)) { w1 = t < .5 ? 1 : 0; w2 = 1 - w1; }
        var sum = w1 + w2;
        var b = start.b.slice();
        b[0] = okrugl(Math.max(0, Math.min(1, b[0] + dx * w1 / sum * 2)), e.shiftKey);
        b[1] = okrugl(Math.max(CRV_LO, Math.min(CRV_HI, b[1] + dy * w1 / sum * 2)), e.shiftKey);
        b[2] = okrugl(Math.max(0, Math.min(1, b[2] + dx * w2 / sum * 2)), e.shiftKey);
        b[3] = okrugl(Math.max(CRV_LO, Math.min(CRV_HI, b[3] + dy * w2 / sum * 2)), e.shiftKey);
        zapisat(b);
      }
      cv.addEventListener('pointermove', function (e) {
        if (dragPt < 0 && !tyanemKrivuyu) { cv.style.cursor = blizhe(e) >= 0 ? 'grab' : 'crosshair'; return; }
        if (dragPt >= 0) tyanutRukoyatku(e); else tyanutKrivuyu(e);
      });
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault(); cv.focus();
        cv.setPointerCapture(e.pointerId);
        var i2 = blizhe(e);
        if (i2 >= 0) { dragPt = i2; tyanutRukoyatku(e); return; }
        var r = cv.getBoundingClientRect();
        tyanemKrivuyu = true;
        start = { x: e.clientX, y: e.clientY, b: P[bezKey].slice(),
                  t: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) };
        cv.style.cursor = 'grabbing';
      });
      function konecTyagi() { dragPt = -1; tyanemKrivuyu = false; start = null; cv.style.cursor = 'crosshair'; }
      cv.addEventListener('pointerup', konecTyagi);
      cv.addEventListener('pointercancel', konecTyagi);
      /* Дабл-клик по полю — ровный ход обратно. Возвращал [.25,.1,.25,1] —
         это «ease», а ровный ход на графике нарисован пунктиром по диагонали:
         слово и дело расходились (правка 03.09). */
      cv.addEventListener('dblclick', function () { zapisat([0, 0, 1, 1]); });

      /* КЛАВИАТУРА. Рукоятку берут и стрелками: шаг сотая, с Shift — восьмая.
         Tab выбирает рукоятку, потому что мышью в неё попадают не всегда. */
      var vybrana = 0;
      cv.tabIndex = 0;
      cv.setAttribute('role', 'application');
      cv.setAttribute('aria-label', 'редактор кривой движения: стрелки двигают рукоятку, пробел меняет рукоятку');
      cv.addEventListener('keydown', function (e) {
        if (e.key === ' ') { vybrana = 1 - vybrana; e.preventDefault(); return; }
        var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
        if (!d) return;
        e.preventDefault();
        var shag = e.shiftKey ? 0.125 : 0.01;
        var b = P[bezKey].slice();
        b[vybrana * 2] = Math.max(0, Math.min(1, +(b[vybrana * 2] + d[0] * shag).toFixed(3)));
        b[vybrana * 2 + 1] = Math.max(CRV_LO, Math.min(CRV_HI, +(b[vybrana * 2 + 1] + d[1] * shag).toFixed(3)));
        zapisat(b);
      });

      /* ЧЕТЫРЕ ЧИСЛА ПОЛЯМИ. Кривую держат в голове числами, когда переносят
         её в другой стенд или сверяют с чужой; на глаз это не повторить. */
      var polya = document.createElement('div');
      polya.className = 'st-krivaya-chisla';
      var vvod = [];
      ['x₁', 'y₁', 'x₂', 'y₂'].forEach(function (imya, i) {
        var kl = document.createElement('label'); kl.className = 'st-kch';
        var pd = document.createElement('span'); pd.textContent = imya;
        var inp = document.createElement('input');
        inp.type = 'text'; inp.inputMode = 'decimal';
        klavishiChisla(inp);
        inp.addEventListener('change', function () {
          var v = parseFloat(inp.value.replace(',', '.'));
          if (isNaN(v)) { obnovitPolya(); return; }
          var b = P[bezKey].slice();
          var lo = (i % 2 === 0) ? 0 : CRV_LO, hi = (i % 2 === 0) ? 1 : CRV_HI;
          b[i] = Math.max(lo, Math.min(hi, v));
          zapisat(b);
        });
        kl.appendChild(pd); kl.appendChild(inp);
        polya.appendChild(kl); vvod.push(inp);
      });
      var zerkalo = document.createElement('button');
      zerkalo.type = 'button'; zerkalo.className = 'st-kzerkalo';
      zerkalo.title = 'отразить: разгон становится торможением';
      zerkalo.textContent = '⇄';
      zerkalo.addEventListener('click', function () {
        var b = P[bezKey];
        zapisat([+(1 - b[2]).toFixed(3), +(1 - b[3]).toFixed(3),
                 +(1 - b[0]).toFixed(3), +(1 - b[1]).toFixed(3)]);
      });
      polya.appendChild(zerkalo);
      function obnovitPolya() {
        var b = P[bezKey];
        for (var i = 0; i < 4; i++) if (document.activeElement !== vvod[i]) vvod[i].value = b[i];
      }
      obnovitPolya();

      return { cv: cv, redraw: function () { redraw(); obnovitPolya(); }, polya: polya };
    }

    /* ── ЯЗЫК ПАНЕЛИ ──────────────────────────────────────────────────
       Панель говорит на языке читателя, а не стенда: у стенда язык ленты
       свой, у панели свой. Выбор общий на все стенды — он про человека,
       а не про страницу, поэтому и ключ хранения общий.

       Перевод приходит от стенда картой `en`: заголовок секции по своему
       русскому имени, ручка по ключу параметра, подсказка — картой
       `enDesc`. Чего в карте нет — остаётся по-русски: язык не должен
       уметь спрятать ручку. Собственные слова панели переведены здесь. */
    var LANG_KEY = 'stend-panel-lang';
    var lang = 'ru';
    try { if (localStorage.getItem(LANG_KEY) === 'en') lang = 'en'; } catch (e) {}
    var SVOI = {
      'Панель': 'Panel', 'Тема': 'Theme', 'Эпл': 'Apple', 'Нотхинг': 'Nothing',
      'Ссылка на этот вид': 'Link to this view', 'Правки для кода': 'Edits for code',
      'Сбросить настройки': 'Reset', 'Вернуть': 'Restore',
      'Считать эталоном': 'Set as reference',
      'скопировано: ': 'copied: ', ' ручек': ' knobs',
      'всё по умолчанию': 'all at defaults', 'Параметры:': 'Parameters:',
      'своя (безье)': 'custom (bezier)', 'линейный': 'linear',
      'разгон': 'ease-in', 'торможение': 'ease-out', 'плавный': 'ease-in-out',
      'квадрат': 'quad', 'Свернуть всё': 'Collapse all', 'Все законы': 'All laws',
      'Развернуть всё': 'Expand all', 'Язык панели': 'Panel language'
    };
    var EN = o.en || {}, ENDESC = o.enDesc || {};
    function T(klyuch, ru) {
      if (lang !== 'en') return ru;
      return EN[klyuch] || EN[ru] || SVOI[ru] || ru;
    }
    function opisanie(key) {
      return (lang === 'en' && ENDESC[key]) || DESC[key] || '';
    }
    var nadpisi = [];
    function nadpis(el, klyuch, ru) {
      el.textContent = T(klyuch, ru);
      nadpisi.push({ el: el, k: klyuch, ru: ru });
    }
    function smenitYazyk(v) {
      lang = v;
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
      nadpisi.forEach(function (n) { n.el.textContent = T(n.k, n.ru); });
    }

    // ── секции-гармошки: заголовок кликом сворачивает карточку,
    // состояние помнится на стенд (localStorage) ──
    var FOLD_KEY = 'stend-panel-folds:' + o.storageKey;
    var folds = {};
    /* Объявленная свёрнутость — умолчание, рука перебивает. Стенд говорит,
       что открыто на входе (обычно то, над чем идёт работа), а человек,
       раскрыв или закрыв секцию, записывает своё решение поверх. Пока он
       ничего не трогал, ключа в хранилище нет — и работает объявленное. */
    var folds0 = {};
    try { folds = JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); } catch (e) {}
    function svernuta(k) { return (k in folds) ? !!folds[k] : !!folds0[k]; }
    function saveFolds() {
      try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch (e) {}
    }
    var sekcii = [];
    /* ПОРЯДОК КЛАСТЕРОВ — рука Сергея (03.09): кластер переставляется за
       схват ≡ слева от имени; порядок хранится на стенд и восстанавливается
       при сборке. Подвал «Панель» не переставляется. */
    var PORYADOK_KEY = 'stend-panel-poryadok:' + (o.storageKey || 'p');
    var poryadok = [];
    try { poryadok = JSON.parse(localStorage.getItem(PORYADOK_KEY) || '[]'); } catch (e) {}
    function zapomnitPoryadok() {
      poryadok = sekcii.filter(function (s) { return !s.bezShvata; }).map(function (s) { return s.title; });
      try { localStorage.setItem(PORYADOK_KEY, JSON.stringify(poryadok)); } catch (e) {}
    }
    function perestavit(s, kuda) {   // kuda — секция, перед которой встать (null = в конец подвижных)
      var opora = kuda ? kuda.h : (sekcii.filter(function (x) { return x.bezShvata; })[0] || {}).h || null;
      telo.insertBefore(s.h, opora); telo.insertBefore(s.card, opora);
      sekcii.splice(sekcii.indexOf(s), 1);
      var idx = kuda ? sekcii.indexOf(kuda) : sekcii.length - sekcii.filter(function (x) { return x.bezShvata; }).length;
      sekcii.splice(idx, 0, s);
    }
    function vosstanovitPoryadok() {
      if (!poryadok.length) return;
      var podvizhnye = sekcii.filter(function (s) { return !s.bezShvata; });
      var izvestnye = poryadok.filter(function (t) { return podvizhnye.some(function (s) { return s.title === t; }); });
      var pervyi = podvizhnye.length ? podvizhnye[0] : null;
      // расставляем известные по сохранённому порядку перед первым неизвестным
      var neizvestnye = podvizhnye.filter(function (s) { return izvestnye.indexOf(s.title) < 0; });
      var kuda = neizvestnye[0] || (sekcii.filter(function (x) { return x.bezShvata; })[0] || null);
      izvestnye.forEach(function (t) {
        var s = podvizhnye.filter(function (x) { return x.title === t; })[0];
        perestavit(s, kuda);
      });
    }
    function addSection(title, glazKey, opts) {
      opts = opts || {};
      if (opts.zakryt) folds0[title] = true;
      var h = document.createElement('h4');
      h.className = 'st-sec';
      // имя — в своём span: смена языка переписывает textContent, схват и глаз должны уцелеть
      var hspan = document.createElement('span'); hspan.className = 'st-sec-imya';
      nadpis(hspan, 'h:' + title, title);
      if (!opts.bezShvata) {
        var shvat = document.createElement('button'); shvat.type = 'button'; shvat.className = 'st-shvat';
        shvat.title = 'переставить кластер: тяни или стрелки ↑↓';
        shvat.setAttribute('aria-label', 'переставить кластер ' + title);
        shvat.innerHTML = '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M0 1h10M0 5h10"/></svg>';
        shvat.addEventListener('click', function (ev) { ev.stopPropagation(); });
        shvat.addEventListener('keydown', function (ev) {
          if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
          ev.preventDefault(); ev.stopPropagation();
          var me = sekcii.filter(function (s) { return s.h === h; })[0];
          var podvizhnye = sekcii.filter(function (s) { return !s.bezShvata; });
          var i = podvizhnye.indexOf(me);
          if (ev.key === 'ArrowUp' && i > 0) perestavit(me, podvizhnye[i - 1]);
          if (ev.key === 'ArrowDown' && i < podvizhnye.length - 1) perestavit(me, podvizhnye[i + 2] || null);
          zapomnitPoryadok(); shvat.focus();
        });
        /* ТЯГА КЛАСТЕРА. Слушаем документ, а не кнопку: перестановка
           двигает заголовок в дереве, а перемещение узла отбирает
           pointer capture — с ним тяга обрывалась на первом же шаге и
           перестановка «не работала» (поймано Сергеем 03.09). */
        shvat.addEventListener('pointerdown', function (ev) {
          if (ev.button) return;
          ev.preventDefault(); ev.stopPropagation();
          var me = sekcii.filter(function (s) { return s.h === h; })[0];
          if (!me) return;
          h.classList.add('st-tyanem');
          panel.classList.add('st-tyanem-idyot');
          function dvizhenie(e2) {
            var podvizhnye = sekcii.filter(function (s) { return !s.bezShvata && s !== me && !s.h.hidden; });
            // куда встать: перед первым кластером, чья середина ниже указателя
            var kuda = null;
            for (var i = 0; i < podvizhnye.length; i++) {
              var r = podvizhnye[i].h.getBoundingClientRect();
              if (e2.clientY < r.top + r.height / 2) { kuda = podvizhnye[i]; break; }
            }
            var moy = me.h.getBoundingClientRect();
            // уже стоим там, куда целимся — не дёргаем дерево
            if (kuda && kuda.h.getBoundingClientRect().top === moy.top) return;
            var sled = sekcii[sekcii.indexOf(me) + 1] || null;
            if ((kuda || null) !== (sled && !sled.bezShvata ? sled : null)) perestavit(me, kuda);
            // тяга у нижней и верхней кромки листает содержимое
            var pr = telo.getBoundingClientRect();
            if (e2.clientY > pr.bottom - 28) telo.scrollTop += 12;
            else if (e2.clientY < pr.top + 28) telo.scrollTop -= 12;
          }
          function konec() {
            document.removeEventListener('pointermove', dvizhenie);
            document.removeEventListener('pointerup', konec);
            document.removeEventListener('pointercancel', konec);
            h.classList.remove('st-tyanem');
            panel.classList.remove('st-tyanem-idyot');
            zapomnitPoryadok(); skrollObnovit();
          }
          document.addEventListener('pointermove', dvizhenie);
          document.addEventListener('pointerup', konec);
          document.addEventListener('pointercancel', konec);
        });
        h.appendChild(shvat);
      }
      h.appendChild(hspan);
      // заголовок складывает секцию — значит достижим с клавиатуры (приёмка HIG 02.09)
      h.tabIndex = 0; h.setAttribute('role', 'button');
      h.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); h.click(); }
      });
      var card = document.createElement('div');
      card.className = 'card';
      telo.appendChild(h);
      telo.appendChild(card);
      if (glazKey) {
        /* ГЛАЗ СЕКЦИИ — эффект целиком включается с заголовка (снято с
           дизайн-системы панелек Миши, 02.09): сравнить «с эффектом / без»
           одним щелчком, не трогая ручки. Ключ — двоичный параметр стенда;
           умолчание у нас — включено: эффект и есть предмет стенда. */
        var glaz = document.createElement('button');
        glaz.type = 'button'; glaz.className = 'st-glaz';
        glaz.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">' +
          '<path d="M1.5 8s2.4-4.3 6.5-4.3S14.5 8 14.5 8s-2.4 4.3-6.5 4.3S1.5 8 1.5 8z"/>' +
          '<circle cx="8" cy="8" r="2.2"/><path class="st-glaz-cherta" d="M3 13 13 3"/></svg>';
        function glazObnovit() {
          var on = !!P[glazKey];
          glaz.setAttribute('aria-pressed', String(on));
          glaz.title = on ? 'выключить эффект секции' : 'включить эффект секции';
          glaz.classList.toggle('off', !on);
          card.classList.toggle('st-vykl', !on);
        }
        glaz.addEventListener('click', function (ev) {
          ev.stopPropagation();   // клик по глазу не складывает секцию
          P[glazKey] = !P[glazKey]; glazObnovit(); izmenilos(glazKey);
        });
        glaz.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
        h.appendChild(glaz);
        svyazatControl(glazKey, glazObnovit);
        glazObnovit();
      }
      /* Значок сворачивания — шеврон рисунком: глифы ▾ / ▸ в SF Pro
         подменялись точкой (поймано Сергеем 03.09). Стоит самым правым,
         после глаза: сначала что делает секция, потом её створка. */
      var znak = document.createElement('span');
      znak.className = 'st-sec-znak';
      znak.setAttribute('aria-hidden', 'true');
      znak.innerHTML = '<svg viewBox="0 0 10 6"><path d="M1 1.5 5 5 9 1.5"/></svg>';
      h.appendChild(znak);

      function applyFold() {
        /* Секцию, спрятанную сужением (набор или место прячут заголовок),
           «Развернуть всё» не воскрешает: без заголовка карточка вернулась
           бы безымянной. Найдено ревизией 2026-09-01, жило с хода 5. */
        card.hidden = svernuta(title) || h.hidden;
        h.classList.toggle('st-closed', svernuta(title));
        h.setAttribute('aria-expanded', String(!svernuta(title)));
      }
      h.addEventListener('click', function () {
        folds[title] = !svernuta(title);
        applyFold(); saveFolds();
      });
      applyFold();
      sekcii.push({ title: title, fold: applyFold, h: h, card: card, bezShvata: !!opts.bezShvata });
      return card;
    }
    /* Свернуть всё разом: с десятком секций поштучное складывание — работа,
       а не удобство. */
    function svernutVse(zakryt) {
      sekcii.forEach(function (s) { folds[s.title] = zakryt; s.fold(); });
      saveFolds();
    }

    /* ── ВЕРХНЯЯ СТРОКА ПАНЕЛИ ────────────────────────────────────────
       Две вещи, которые относятся к панели целиком, а не к ручке: на каком
       языке она говорит и сколько её видно. Стоят сверху, потому что
       решаются до того, как читатель начал искать ручку. */
    var verh = document.createElement('div');
    verh.className = 'st-verh';
    var yaz = document.createElement('div');
    yaz.className = 'st-yaz';
    [['ru', 'RU'], ['en', 'EN']].forEach(function (y) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = y[1];
      b.className = 'st-yaz-b' + (lang === y[0] ? ' on' : '');
      b.addEventListener('click', function () {
        if (lang === y[0]) return;
        smenitYazyk(y[0]);
        [].forEach.call(yaz.children, function (x) {
          x.classList.toggle('on', x.textContent.toLowerCase() === lang);
        });
      });
      yaz.appendChild(b);
    });
    var sver = document.createElement('button');
    sver.type = 'button'; sver.className = 'st-sver';
    var vseZakryty = false;
    function metkaSver() {
      sver.textContent = T('panel:fold', vseZakryty ? 'Развернуть всё' : 'Свернуть всё');
    }
    nadpisi.push({ el: sver, k: 'panel:fold', ru: 'Свернуть всё' });
    sver.addEventListener('click', function () {
      vseZakryty = !vseZakryty;
      svernutVse(vseZakryty);
      nadpisi.forEach(function (n) {
        if (n.el === sver) n.ru = vseZakryty ? 'Развернуть всё' : 'Свернуть всё';
      });
      metkaSver();
    });
    verh.appendChild(yaz); verh.appendChild(sver);
    telo.appendChild(verh);
    metkaSver();

    /* Перенос: рука берёт за шапку (верхняя строка и строка состояния),
       кнопки остаются кнопками — захват только с порога хода в 4px.
       Дабл-клик по шапке возвращает окно на место по умолчанию. */
    function oknoTaskat(ruchka) {
      ruchka.style.cursor = 'grab';
      ruchka.addEventListener('pointerdown', function (e) {
        if (uzkiy()) return;
        if (e.target.closest('button, select, input')) return;
        var r0 = panel.getBoundingClientRect();
        var x0 = e.clientX, y0 = e.clientY, vzyal = false;
        function hod(ev) {
          var dx = ev.clientX - x0, dy = ev.clientY - y0;
          if (!vzyal && Math.abs(dx) + Math.abs(dy) < 4) return;
          if (!vzyal) { vzyal = true; oknoPrivyazka(); }
          panel.style.left = Math.max(0, Math.min(r0.left + dx, window.innerWidth - 60)) + 'px';
          panel.style.top = Math.max(0, Math.min(r0.top + dy, window.innerHeight - 40)) + 'px';
          /* Сторона своей полосы — закон от положения панели на экране, а не
             от её размера. При переносе размер не меняется, ResizeObserver
             молчит, и полоса залипала на прежней стороне (правка 03.09). */
          skrollObnovit();
        }
        function otpustil() {
          document.removeEventListener('pointermove', hod);
          document.removeEventListener('pointerup', otpustil);
          if (vzyal) oknoSohranit();
        }
        document.addEventListener('pointermove', hod);
        document.addEventListener('pointerup', otpustil);
      });
      ruchka.addEventListener('dblclick', function (e) {
        if (e.target.closest('button, select, input')) return;
        oknoVernut();
      });
    }
    oknoTaskat(verh);

    /* ── СТРОКА СОСТОЯНИЯ ──────────────────────────────────────────────
       Отвечает на «где я» и держит выход. Сужение вида — это ВИД, а не
       правка: выход ничего не меняет в макете, поэтому он бесплатный и
       без подтверждений. Прибита к верху панели: в прокрутке на семьдесят
       ручек состояние обязано быть видно из любой точки.
       Заполняется ниже, когда известны наборы и секции. */
    var sost = document.createElement('div');
    sost.className = 'st-sost';
    var sostText = document.createElement('span');
    var sostX = document.createElement('button');
    sostX.type = 'button'; sostX.className = 'st-sost-x';
    sostX.textContent = '\u2715';
    sostX.title = 'показать все законы (Esc)';
    sostX.hidden = true;
    sost.appendChild(sostText); sost.appendChild(sostX);
    telo.appendChild(sost);
    oknoTaskat(sost);
    var obnovitSostoyanie = function () {};
    // «23 ручек» читается как машинный вывод; строка состояния — текст,
    // который читают глазами каждый раз, и склонение тут не мелочь
    function ruchek(n) {
      var d10 = n % 10, d100 = n % 100;
      if (d10 === 1 && d100 !== 11) return n + ' ручка';
      if (d10 >= 2 && d10 <= 4 && (d100 < 10 || d100 >= 20)) return n + ' ручки';
      return n + ' ручек';
    }
    // после «из» число уходит в родительный: «19 из 71 ручки», «19 из 23 ручек»
    function izRuchek(n) {
      return n + (n % 10 === 1 && n % 100 !== 11 ? ' ручки' : ' ручек');
    }

    /* ── ОТРАЖЕНИЕ РУЧКИ (Сергей, 08.09). Одну величину можно показать в
       нескольких кластерах: дом там, где живёт её закон, отражения — там,
       где её ищут. Ключ один, значение одно, правка любого показа тянет
       остальные: обновлялки склеиваются по ключу, а не затирают друг друга.
       Иначе вторая копия жила бы своей жизнью — две правды об одном. ── */
    var controls = {};
    var vOtrazhenii = false;   // идёт обновление показов одной величины // служебное
    function svyazatControl(key, fn) {
      var bylo = controls[key];
      controls[key] = bylo ? function () { bylo(); fn(); } : fn;
    }

    var curCard = null;
    var curGrp = null;                 // текущая подгруппа внутри кластера
    /* Сведения о ручке для экспорта правок: подпись и секция берутся из
       defs по ходу сборки, тип — из объявления, если стенд на нём. */
    var opisRuchek = {}, tekSek = '';
    function zapomni(k, podpis) {
      if (k) opisRuchek[k] = { podpis: podpis || k, sekciya: tekSek };
    }
    // «доля от кегля», не «доля от кегль»: опоры лежат именительным
    var ROD_OPORY = { 'ширина': 'ширины', 'кегль': 'кегля', 'высота': 'высоты',
      'экран': 'экрана', 'строка': 'строки', 'колонка': 'колонки', 'лента': 'ленты',
      'знак': 'знака', 'своё': '«своего»', 'ось': 'оси', 'место': 'места',
      'фаза': 'фазы', 'сосед': 'соседа', 'объект': 'объекта', 'край': 'края' };
    function rodOpory(ot) { return ROD_OPORY[ot] || ot; }
    var tipRuchki = {};
    (o.zakon || []).forEach(function (z) {
      if (!z || !z.length || z[0] === 'h') return;   // пустая строка объявления
      var t = z[2], op = z[3] || {};
      if (t === 'пара' && op.iz) {
        op.iz.forEach(function (r) {
          tipRuchki[r[0]] = r[2] + ((r[3] || {}).ot ? ' от ' + rodOpory(r[3].ot) : '');
        });
        return;
      }
      if (z[0]) tipRuchki[z[0]] = t + (op.ot ? ' от ' + rodOpory(op.ot) : '');
    });
    /* ПОДГРУППА — второй уровень внутри кластера. Заводится там, где одного
       уровня перестало хватать: у стенда с двумя десятками ручек на один
       предмет они делятся не по важности, а по ЧАСТЯМ предмета (точка, дуга,
       усы), и без деления строка теряется среди однофамильцев.
       Не орган: орган живёт в своей строке и не может обернуть следующие.
       Свёрнутость помнится тем же ключом, что у секций, с приставкой 'g:'. */
    function addGroup(card, title, sek, zakryt) {
      if (!card) return null;
      var klyuch = 'g:' + sek + '/' + title;
      if (zakryt) folds0[klyuch] = true;
      var g = document.createElement('div'); g.className = 'st-grp';
      var sh = document.createElement('button');
      sh.type = 'button'; sh.className = 'st-grp-sh';
      var imya = document.createElement('span'); imya.className = 'st-grp-imya';
      nadpis(imya, 'g:' + title, title);
      var schet = document.createElement('i'); schet.className = 'st-grp-schet';
      var ch = document.createElement('span'); ch.className = 'st-grp-ch';
      ch.innerHTML = '<svg viewBox="0 0 6 10" aria-hidden="true"><path d="M1 1l4 4-4 4"/></svg>';
      sh.appendChild(imya); sh.appendChild(schet); sh.appendChild(ch);
      var telo = document.createElement('div'); telo.className = 'st-grp-telo';
      g.appendChild(sh); g.appendChild(telo); card.appendChild(g);
      function pokazat() {
        var zakryta = svernuta(klyuch);
        telo.hidden = zakryta;
        g.classList.toggle('st-grp-zakryta', zakryta);
        sh.setAttribute('aria-expanded', String(!zakryta));
        schet.textContent = telo.querySelectorAll(':scope > .row').length || '';
      }
      sh.addEventListener('click', function () { folds[klyuch] = !svernuta(klyuch); pokazat(); saveFolds(); });
      g.__pokazat = pokazat; gruppy.push(g);
      return telo;
    }
    var gruppy = [];
    (o.defs || []).forEach(function (d) {
      if (d[0] === 'h') {
        curCard = addSection(d[1], d[2] && d[2].glaz, { zakryt: d[2] && d[2].zakryt });
        tekSek = d[1]; curGrp = null;
        return;
      }
      if (d[0] === 'g') { curGrp = addGroup(curCard, d[1], tekSek, d[2] && d[2].zakryt); return; }
      if (d[2] === 'para' && Array.isArray(d[3])) {
        d[3].forEach(function (r) { zapomni(r[0], d[1] + ' · ' + r[1]); });
      }
      zapomni(d[0], d[1]);
      var host = curGrp || curCard || panel;
      var row = document.createElement('div'); row.className = 'row';
      /* Ключ на самой строке: стенду бывает нужно показать одни ручки и
         спрятать другие — переключателем, а не отдельной панелью. Искать
         строку по подписи нельзя, подписи повторяются и переводятся. */
      row.dataset.k = d[0];
      var lab = document.createElement('label'); nadpis(lab, d[0], d[1]);
      /* Имя для скринридера: label связывается с органом по id, иначе
         читается «ползунок, 60» без названия ручки (приёмка HIG 02.09). */
      function svyazat(el) {
        if (!el.id) el.id = ('st-' + (o.storageKey || 'p') + '-' + d[0]).replace(/[^\w-]/g, '_');
        lab.htmlFor = el.id;
      }
      /* подсказка — на всей строке, не на подписи: у тумблера подписи нет
         (глагол живёт на кнопке), у сегментера она — меньшая часть строки */
      bindTip(row, d[0]);
      row.appendChild(lab);

      if (d[2] === 'preset') {
        // [key, подпись, 'preset', [[значение, метка, {ключ: значение, ...}], ...]]
        // выбор пресета выставляет пачку параметров и обновляет их ручки
        var prSel = document.createElement('select'); svyazat(prSel);
        d[3].forEach(function (opt) {
          var oEl = document.createElement('option');
          oEl.value = opt[0]; oEl.textContent = opt[1];
          prSel.appendChild(oEl);
        });
        prSel.value = P[d[0]];
        prSel.addEventListener('input', function () {
          P[d[0]] = prSel.value;
          var chosen = d[3].filter(function (opt) { return opt[0] === prSel.value; })[0];
          if (chosen && chosen[2]) Object.assign(P, chosen[2]);
          izmenilos(d[0]);
          for (var ck in controls) controls[ck]();
        });
        svyazatControl(d[0], function () { prSel.value = P[d[0]]; });
        row.appendChild(prSel);
        host.appendChild(row);
        return;
      }
      if (d[2] === 'color') {
        /* ЦВЕТ — СВОЙ ПИКЕР, НЕ СИСТЕМНЫЙ (правка Сергея 03.09).
           Устройство снято с дизайн-системы Миши Матвеева («Panel / Color
           Picker», 216×252): поле 8, квадрат насыщенность×яркость во всю
           ширину, под ним ряд тона 28 — полоса и пипетка 28 через 4.
           Нативный input[type=color] открывал системное окно macOS: чужая
           раскладка поверх стенда, руку уводит с панели. Цвет правится
           там же, где остальные ручки.
           Параметр по-прежнему живёт строкой '#rrggbb'. */
        var cvet = stroitCvet(d[0]);
        row.appendChild(cvet.svotch);
        host.appendChild(row);
        host.appendChild(cvet.pole);
        return;
      }
      if (d[2] === 'select') {
        // [key, подпись, 'select', [[значение, метка], ...]]
        var sSel = document.createElement('select'); svyazat(sSel);
        d[3].forEach(function (opt) {
          var oEl = document.createElement('option');
          oEl.value = opt[0]; oEl.textContent = opt[1];
          sSel.appendChild(oEl);
        });
        sSel.value = P[d[0]];
        sSel.addEventListener('input', function () { P[d[0]] = sSel.value; izmenilos(d[0]); });
        svyazatControl(d[0], function () { sSel.value = P[d[0]]; });
        row.appendChild(sSel);
        host.appendChild(row);
        return;
      }
      if (d[2] === 'ease') {
        var easeKey = d[0];
        var bezKey = easeKey.replace('Ease', 'Bez');
        var sel = document.createElement('select'); svyazat(sel);
        Object.keys(EASES).forEach(function (name) {
          var opt = document.createElement('option');
          opt.value = name; nadpis(opt, 'ease:' + name, name);
          sel.appendChild(opt);
        });
        var oB = document.createElement('option');
        oB.value = 'bezier'; nadpis(oB, 'ease:bezier', 'своя (безье)');
        sel.appendChild(oB);
        sel.value = P[easeKey];
        var ed = buildCurveEditor(easeKey, bezKey, sel);
        sel.addEventListener('input', function () {
          P[easeKey] = sel.value;
          // пресет подставляет рукоятки в свою форму — есть от чего лепить
          if (sel.value !== 'bezier') {
            P[bezKey] = (BEZ_APPROX[sel.value] || [0.25, 0.25, 0.75, 0.75]).slice();
          } else {
            ed.cv.hidden = false; // выбрал «свою» — редактор сразу под рукой
          }
          ed.redraw(); izmenilos(easeKey);
        });
        svyazatControl(easeKey, function () { sel.value = P[easeKey]; ed.redraw(); });
        repaints.push(ed.redraw);
        row.appendChild(sel);
        host.appendChild(row);
        // редактор кривой — отдельный элемент рядом со строкой: прячется вместе с ней
        ed.cv.dataset.k = easeKey + ':bez';
        host.appendChild(row === ed.cv ? row : ed.cv);
        host.appendChild(ed.polya);
        // редактор свёрнут по умолчанию: квадраты кривых — пол-панели;
        // клик по подписи строки раскрывает и прячет — вместе с числами
        ed.cv.hidden = true; ed.polya.hidden = true;
        lab.classList.add('st-fold');
        lab.style.cursor = 'inherit';
        lab.addEventListener('click', function () {
          ed.cv.hidden = !ed.cv.hidden;
          ed.polya.hidden = ed.cv.hidden;
          if (!ed.cv.hidden) ed.redraw();
        });
        ed.redraw();
        return;
      }

      // орган из библиотеки: [key, подпись, 'имя-типа', ...]
      if (typeof d[2] === 'string' && TIPY[d[2]]) {
        TIPY[d[2]](row, d, P, {
          save: function () { izmenilos(d[0]); }, host: host, bindTip: bindTip,
          accent: accent, repaints: repaints, controls: controls, temaSyuda: temaSyuda,
          defaults: DEFAULTS, storageKey: o.storageKey,
          // отбор уведённых ручек — тот же, что у кнопок копирования:
          // метка момента (скраб) собирает воспроизводимый адрес кадра
          uvedennye: function () { return uvedennye(); },
          onChange: function () { if (typeof o.onChange === 'function') o.onChange(d[0], P); },
        });
        host.appendChild(row);
        return;
      }

      /* ОРГАН НАЗВАН, НО НЕ ПОДКЛЮЧЁН — ЭТО ПРЕТЕНЗИЯ, А НЕ НИТКА (ход 64).
         Третий довод строки — строка: значит стенд просит орган. Если такого
         типа нет, ядро прежде шло дальше числовой веткой: min = 'segment',
         max = undefined, и на панель выходила нитка с NaN — пилюля «никуда»
         (снимок Сергея 04.09, ход 61). Молчаливой подмены больше нет: строка
         говорит, чего не хватает, и то же уходит в поток ошибок. */
      if (typeof d[2] === 'string') {
        var beda = 'Панель: величина «' + d[0] + '» просит орган «' + d[2] +
                   '» — подключите /panel-lib/' + d[2] + '.js после /panel.js';
        if (typeof console !== 'undefined') console.error(beda);
        var lab0 = document.createElement('label');
        lab0.textContent = d[1] || d[0];
        var zh = document.createElement('span');
        zh.className = 'st-net-organa'; zh.textContent = 'нет органа «' + d[2] + '»';
        zh.title = beda;
        row.appendChild(lab0); row.appendChild(zh);
        host.appendChild(row);
        return;
      }

      // [key, подпись, min, max, шаг, {mul}] — mul: множитель показа
      // (панель говорит в единицах экрана, параметр живёт своим числом)
      var opts = d[5] || {};
      var mul = opts.mul || 1;
      function fmt(v) { return String(parseFloat((v * mul).toFixed(4))); }
      var inp = document.createElement('input');
      inp.type = 'range'; inp.min = d[2]; inp.max = d[3]; inp.step = d[4];
      inp.value = P[d[0]] * mul; svyazat(inp);
      var val = document.createElement('span'); val.className = 'val';
      val.textContent = fmt(P[d[0]]);
      // число редактируемо — и это сказано (title) и достижимо с клавиатуры
      val.tabIndex = 0; val.setAttribute('role', 'button');
      val.title = 'клик — точный ввод; выражения: 700/2, +25';
      val.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); val.click(); }
      });
      inp.addEventListener('input', function () {
        P[d[0]] = parseFloat(inp.value) / mul;
        val.textContent = fmt(P[d[0]]);
        paintFill(inp);
        uvodObnovit();   // точка загорается в момент правки, не после перезагрузки
        // показатель на этаже имени идёт за ниткой: без этого он стоял на
        // старом числе, пока тянешь бегунок (поймано 03.09)
        if (typeof pokazatVvod === 'function') pokazatVvod();
        izmenilos(d[0]);
      });
      // дабл-клик по слайдеру — откат ЭТОЙ ручки к дефолту
      inp.addEventListener('dblclick', function () {
        P[d[0]] = DEFAULTS[d[0]];
        controls[d[0]](); izmenilos(d[0]);
      });
      /* Клик по числу в пилюле снят совсем (слово Сергея 04.09): точный
         ввод живёт блоком `chisloBlok` на этаже имени, и второй двери к
         нему нет. Здесь стоял свой обработчик на сорок строк — он умер
         ещё тогда, когда число в пилюле перестало ловить указатель, и
         просто лежал. */
      row.classList.add('dva');   // имя этажом выше, нитка во всю ширину
      /* Точка увода от умолчания — снято с reset-dot из раздатки Михаила
         Матвеева: видно, ЧТО уведено, клик возвращает умолчание. Отбор
         тот же, что у «Скопировать правки», — точка и есть его глаза. */
      var uvod = document.createElement('button');
      uvod.type = 'button'; uvod.className = 'st-uvod';
      uvod.title = 'уведено от умолчания — вернуть';
      function uvodObnovit() {
        var d0 = DEFAULTS[d[0]];
        uvod.classList.toggle('on', d0 !== undefined && String(P[d[0]]) !== String(d0));
      }
      uvod.addEventListener('click', function () {
        if (DEFAULTS[d[0]] === undefined) return;
        P[d[0]] = DEFAULTS[d[0]];
        izmenilos(d[0]); controls[d[0]]();
      });
      if (opts.pole) {
        /* КЕГЛЬ — ЧИСЛОМ (правило Сергея 02.09, П16): вместо нитки — поле
           ввода в правой колонке; выражения, стрелки ±шаг, Shift — вдесятеро,
           кривой ввод краснеет по Enter, уход из поля отменяет. Тип «кегль»
           ставит pole сам; ручная строка — { pole: true } шестым элементом. */
        row.classList.remove('dva');
        var pole = document.createElement('input');
        pole.type = 'text'; pole.inputMode = 'decimal'; pole.className = 'st-pole';
        pole.id = inp.id + '-pole'; lab.htmlFor = pole.id;
        pole.title = 'выражения: 700/2, +25; стрелки ±шаг, Shift — вдесятеро';
        function polePokaz() { pole.value = fmt(P[d[0]]); pole.classList.remove('oshibka'); pole.removeAttribute('aria-invalid'); }
        function polePrinyat(syroj, myagko) {
          var v = vyrazhenie(syroj, P[d[0]] * mul);
          if (isNaN(v)) v = chislo(syroj);
          if (isNaN(v)) {
            if (myagko) { pole.classList.add('oshibka'); pole.setAttribute('aria-invalid', 'true'); } else polePokaz();
            return;
          }
          v = Math.max(parseFloat(d[2]), Math.min(parseFloat(d[3]), v));
          P[d[0]] = v / mul; izmenilos(d[0]); polePokaz(); uvodObnovit();
        }
        pole.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { polePrinyat(pole.value, true); if (!pole.classList.contains('oshibka')) pole.blur(); return; }
          if (ev.key === 'Escape') { polePokaz(); pole.blur(); return; }
          if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
          ev.preventDefault();
          var krupno = parseFloat(d[4] || 1) * (ev.shiftKey ? 10 : 1);
          polePrinyat(String(P[d[0]] * mul + (ev.key === 'ArrowUp' ? krupno : -krupno)), true);
        });
        pole.addEventListener('input', function () { pole.classList.remove('oshibka'); pole.removeAttribute('aria-invalid'); });
        // правят число целиком, а не букву в середине (жалоба Сергея 03.09)
        pole.addEventListener('focus', function () { setTimeout(function () { pole.select(); }, 0); });
        pole.addEventListener('blur', function () { polePrinyat(pole.value, false); });
        svyazatControl(d[0], function () { polePokaz(); uvodObnovit(); });
        /* Точка увода — внутри поля слева, поле — вправо до общей вертикали
           с полями пар (предложение Сергея 02.09): правый край полей один. */
        var obl = document.createElement('span'); obl.className = 'st-pole-obl';
        obl.appendChild(pole); obl.appendChild(uvod);
        row.appendChild(obl);
        polePokaz(); uvodObnovit();
        host.appendChild(row);
        return;
      }
      svyazatControl(d[0], function () {
        inp.value = P[d[0]] * mul; val.textContent = fmt(P[d[0]]); paintFill(inp);
        uvodObnovit(); pokazatVvod();
      });
      repaints.push(function () { paintFill(inp); });
      /* ЭТАЛОН СЕРГЕЯ (Figma, 03.09): имя и точка увода — первым этажом,
         нитка вторым во всю ширину, число едет под шайбой. Правой колонки
         чисел у слайдера больше нет; вертикали держат нитка и поля. */
      var imya = document.createElement('div'); imya.className = 'st-imya';
      /* ЧИСЛО СТОИТ, ПОЛЕ ПРИХОДИТ ПО КЛИКУ (правка Сергея 03.09, вторая).
         Первый заход дал полю постоянное место, но прятал его до наведения
         мыши — и величины не было видно вовсе (Г3 требует показатель), а на
         тач-экране до поля было не добраться: ховера там нет. Теперь как в
         дизайн-системе: число на этаже имени стоит всегда обычным текстом,
         плашки не видно; клик по числу поднимает плашку с полем ровно на
         его месте. Габариты плашки и покоя одни — правый край не едет,
         вертикаль рифмовки цела. */
      /* Г9: число на этаже имени — общий блок ядра, один на строку и на
         органы со своей строкой (наследование, стенд сетки). */
      var cb = chisloBlok({
        imya: d[1], min: d[2], max: d[3], shag: d[4], znak: uvod,
        znachenie: function () { return P[d[0]] * mul; },
        postavit: function (v) { P[d[0]] = v / mul; controls[d[0]](); izmenilos(d[0]); },
        tekst: function () { return fmt(P[d[0]]); }
      });
      var poleObl = cb.obl;
      function pokazatVvod() { cb.obnovit(); }
      imya.appendChild(lab); imya.appendChild(poleObl);
      /* Г9: нитка — общий блок ядра, один на строку и на пять органов.
         Строка отдаёт блоку свои элементы: число в пилюле — тот же `val`,
         за которым ходят показатель и точный ввод. */
      var nb = nitkaBlok({
        inp: inp, val: val,
        znachenie: function () { return P[d[0]] * mul; },
        postavit: function (v) { P[d[0]] = v / mul; },
        tekst: function () { return fmt(P[d[0]]); },
        umolchanie: function () { return DEFAULTS[d[0]] === undefined ? undefined : DEFAULTS[d[0]] * mul; }
      });
      var nitka = nb.obl;
      row.appendChild(imya); row.appendChild(nitka);
      uvodObnovit();
      host.appendChild(row);
      paintFill(inp);
    });
    gruppy.forEach(function (g) { g.__pokazat(); });   // счётчики и свёрнутость — когда строки уже внутри

    /* ── СУЖЕНИЕ ПАНЕЛИ ────────────────────────────────────────────────
       Показать не все ручки просят два разных повода. Рабочий набор режет
       СЕКЦИЯМИ и выбирается руками: «работаю над каталогом». Место на
       макете режет СТРОКАМИ и выбирается кликом: «какие законы правят вот
       этим». Второе не ложится на первое — карта мест показала, что место
       идёт поперёк секций (в «Обтекании» место «Строка» — это разрядка из
       секции «Набор» плюс пять ручек из «Волны», а сама «Волна» держит ещё
       две ручки дескрипторов). Поэтому вид собирается один раз здесь, из
       обоих условий сразу, а не двумя механиками по очереди.

       Уровень один: панель либо показывает всё, либо одно сужение. Клик по
       месту перебивает набор и при выходе возвращает его — вложенности и
       хлебных крошек нет по решению. */
    var tekNabor = null, polnyi = null, nsel = null;   // заполнит блок наборов
    var mestoTek = null;

    function vseStroki() {
      var out = [];
      sekcii.forEach(function (s) {
        if (s.title === 'Панель') return;
        [].push.apply(out, s.card.querySelectorAll('.row'));
      });
      // строки, объявленные до первой секции, живут прямо в панели
      [].forEach.call(panel.children, function (e) {
        if (e.classList && e.classList.contains('row')) out.push(e);
      });
      return out;
    }

    /* Жива ли величина в текущей фазе. Условие лежит в карте (pri из
       объявления), значения — в P. Сравнение через String: селект хранит
       строку, стенд мог объявить число — '3' и 3 здесь одно и то же. */
    function zhiv(k) {
      var karta = (typeof StendPanel !== 'undefined' && StendPanel.karta) || null;
      var u = karta && karta.zhivet && karta.zhivet[k];
      if (u === undefined || u === null) return true;
      if (typeof u === 'string') return !!P[u];
      if (typeof u !== 'object') return !!u;
      return Object.keys(u).every(function (h) {
        var nado = u[h];
        if (Array.isArray(nado)) {
          return nado.some(function (v) { return String(P[h]) === String(v); });
        }
        if (typeof nado === 'boolean') return !!P[h] === nado;
        return String(P[h]) === String(nado);
      });
    }

    function perestroitVid() {
      /* Пока панель сужена местом, набор не участвует: место режет поперёк
         секций, и пересечение с набором давало бы «Строка · 2 из 71» —
         законы места, случайно попавшие в секции набора. Место ПЕРЕБИВАЕТ
         набор; набор ждёт своей очереди и возвращается выходом. */
      var spisok = (o.nabory && tekNabor && !mestoTek) ? o.nabory[tekNabor] : null;
      var karta = (typeof StendPanel !== 'undefined' && StendPanel.karta) || null;
      var svoi = mestoTek && karta ? (karta.vMeste[mestoTek] || []) : null;
      sekcii.forEach(function (s) {
        if (s.title === 'Панель') return;       // подвал не прячется никогда
        var vneNabora = Boolean(spisok) && spisok.indexOf(s.title) < 0;
        var vidno = 0;
        [].forEach.call(s.card.querySelectorAll('.row'), function (r) {
          var skryt = vneNabora || (svoi ? svoi.indexOf(r.dataset.k) < 0 : false)
                                || !zhiv(r.dataset.k);
          /* Прячем КЛАССОМ, а не hidden. Атрибутом hidden пользуется сам
             стенд: gorizont убирает ручки той стороны каталога, которая
             сейчас не работает.Два механизма на одном атрибуте дрались бы —
             переключение набора возвращало бы стенду спрятанное. Класс и
             hidden складываются: спрятано, если хоть один сказал спрятать. */
          r.classList.toggle('st-vne', !!skryt);
          if (!skryt && !r.hidden) vidno += 1;
        });
        // секция без единой видимой строки прячется вместе с заголовком:
        // пустой заголовок читается как поломка
        var skrytSekciyu = vneNabora || (svoi && !vidno);
        s.h.hidden = !!skrytSekciyu;
        s.card.hidden = !!skrytSekciyu || svernuta(s.title);
      });
      obnovitSostoyanie();
    }

    obnovitSostoyanie = function () {
      var vsego = 0, vidno = 0;
      vseStroki().forEach(function (r) {
        vsego += 1;
        if (!r.hidden && !r.classList.contains('st-vne')) vidno += 1;
      });
      var uzko = !!mestoTek || (!!o.nabory && tekNabor && tekNabor !== polnyi);
      sost.classList.toggle('uzko', !!uzko);
      sostX.hidden = !uzko;
      sostX.title = (mestoTek && o.nabory && tekNabor && tekNabor !== polnyi)
        ? 'вернуться к набору «' + tekNabor + '» (Esc)'
        : 'показать все законы (Esc)';
      sostText.innerHTML = uzko
        ? '<b>' + (mestoTek || tekNabor) + '</b> · ' + vidno + ' из ' + izRuchek(vsego)
        : '<b>' + T('panel:vse', 'Все законы') + '</b> · ' + ruchek(vsego);
    };

    /* Выход отменяет сужение целиком и НИЧЕГО не меняет в макете: сужение —
       это вид, а не правка, поэтому он бесплатный и без подтверждений.
       Место прокрутки сохраняется: в панели на семьдесят ручек ты где-то
       стоял, и возврат в начало был бы наказанием за любопытство. */
    function vyhod() {
      if (!mestoTek && (!o.nabory || !tekNabor || tekNabor === polnyi)) return;
      var mesto = telo.scrollTop;
      if (mestoTek) {
        // набор при клике не менялся — снятое место открывает его обратно
        mestoTek = null;
        postavitAdres(null);
      } else if (nsel) {
        tekNabor = polnyi; nsel.value = polnyi;
      }
      perestroitVid();
      telo.scrollTop = mesto;
    }
    sostX.addEventListener('click', vyhod);

    /* ── ВЫБОР МЕСТА НА МАКЕТЕ ─────────────────────────────────────────
       Не «настройки этого элемента», а ЗАКОНЫ ЭТОГО МЕСТА: у элемента
       своих настроек нет, его положение складывают несколько законов, и
       каждый из них правит ещё сотней таких же. Поэтому наведение метит
       ВСЕ элементы места разом, а не тот один, что под курсором.

       Выбор живёт режимом, а не постоянным перехватом кликов: на макете
       есть свои ссылки и свои жесты, отбирать их у стенда нельзя. Режим
       включает прицел в строке состояния, гасит — выбор или Esc. */
    var karta0 = (typeof StendPanel !== 'undefined' && StendPanel.karta) || null;
    if (karta0 && karta0.hozyaeva) hozyaeva = karta0.hozyaeva;

    /* ── АДРЕС ПРАВКИ ИДЁТ ЗА МЕСТОМ (рамка, п.3) ─────────────────────
       Если у места объявлен этаж, клик ставит его в инспектор: сузив
       панель до законов заголовка, правишь заголовок. Иначе ловушка —
       вид сузился, а отступления пишутся тому этажу, что был выбран
       раньше, и правишь этаж незаметно. Выход возвращает адрес, который
       был до первого клика; переклик на место без этажа — тоже, по той
       же причине. Адрес — правка, но откатная и видимая в инспекторе,
       поэтому выход остаётся бесплатным. */
    var adresDo = null, adresStavilsya = false;
    function postavitAdres(imya) {
      var insp = karta0 && karta0.inspektor;
      if (!insp || !(insp in P)) return;
      var et = imya && karta0.etazh ? karta0.etazh[imya] : null;
      if (et) {
        if (!adresStavilsya) { adresDo = P[insp]; adresStavilsya = true; }
        if (P[insp] === et) return;
        P[insp] = et;
      } else {
        if (!adresStavilsya) return;
        P[insp] = adresDo;
        adresStavilsya = false;
      }
      for (var k in controls) controls[k]();   // инспектор и наследования разом
      izmenilos(insp);
    }
    var sloi = null, sostP = null, rezhim = false, podKursorom = null, posl = null;

    /* Канвасный стенд не получает DOM-меток — подсветить место может
       только он сам. Панель говорит ему, над чем курсор, событием:
       stend:mesto {imya} при входе, {imya: null} при уходе и выходе из
       режима. DOM-стендам событие тоже шлётся — им оно просто не нужно. */
    function skazatMesto(imya) {
      try {
        document.dispatchEvent(new CustomEvent('stend:mesto', { detail: { imya: imya } }));
      } catch (e) {}
    }
    function snyatMarkery() {
      if (sloi) { sloi.remove(); sloi = null; }
      if (podKursorom) skazatMesto(null);
      podKursorom = null;
    }
    function vyklyuchitRezhim() {
      if (!rezhim) return;
      rezhim = false;
      document.body.classList.remove('st-vybor');
      if (sostP) sostP.classList.remove('on');
      snyatMarkery();
    }
    function mestoPod(x, y) {
      if (!karta0) return null;
      var el = document.elementFromPoint(x, y);
      if (!el) return null;
      if (el.closest && (el.closest('.st-panel') || el.closest('.st-gear'))) return null;
      for (var i = 0; i < karta0.mesta.length; i++) {
        var imya = karta0.mesta[i], g = karta0.gde[imya];
        if (typeof g === 'function') { if (g(x, y)) return imya; continue; }
        for (var j = 0; j < g.length; j++) {
          if (el.closest && el.closest(g[j])) return imya;
        }
      }
      return null;
    }
    // Подпись держится у курсора, но не уезжает за край: у правой и
    // нижней кромки её сдвиг (14px в CSS) прижимается внутрь экрана.
    function stavitPodpis(pod) {
      var r = pod.getBoundingClientRect();
      var x = Math.min(posl.x, window.innerWidth - r.width - 22);
      var y = Math.min(posl.y, window.innerHeight - r.height - 22);
      pod.style.left = x + 'px'; pod.style.top = y + 'px';
    }
    function narisovatMarkery(imya) {
      snyatMarkery();
      if (!imya) return;
      podKursorom = imya;
      skazatMesto(imya);
      sloi = document.createElement('div');
      sloi.className = 'st-mesta';
      // акцент темы живёт на панели, а слой лежит в body — тему переносим,
      // иначе метки в «Нотхинге» остались бы синими
      if (panel.classList.contains('st-theme-nothing')) sloi.classList.add('st-theme-nothing');
      /* Этаж указки берётся у самой панели, а не из общего правила: стенд
         вправе опустить панель на свой порядок (diagonal держит её на 50),
         и указка обязана поехать за ней — на этаж ниже, чтобы лежать
         поверх макета, но не закрывать то, ради чего в неё тычут. */
      var zp = parseInt(getComputedStyle(panel).zIndex, 10);
      if (zp === zp) sloi.style.zIndex = zp - 1;
      var g = karta0.gde[imya], n = 0;
      if (typeof g !== 'function') {
        g.forEach(function (sel) {
          [].forEach.call(document.querySelectorAll(sel), function (e) {
            var r = e.getBoundingClientRect();
            if (!r.width && !r.height) return;
            var m = document.createElement('div');
            m.className = 'st-metka';
            m.style.left = r.left + 'px'; m.style.top = r.top + 'px';
            m.style.width = r.width + 'px'; m.style.height = r.height + 'px';
            sloi.appendChild(m); n += 1;
          });
        });
      }
      var pod = document.createElement('div');
      pod.className = 'st-mesto-imya';
      pod.dataset.podpis = '1';
      // счёт элементов рядом с именем: он и есть довод, что правится не один
      var zak = (karta0.vMeste[imya] || []).length;
      pod.textContent = imya + (n > 1 ? ' \u00d7 ' + n : '') + ' · ' + ruchek(zak);
      sloi.appendChild(pod);
      document.body.appendChild(sloi);
      if (posl) stavitPodpis(pod);
    }
    function navedenie(e) {
      if (!rezhim) return;
      posl = { x: e.clientX, y: e.clientY };
      var imya = mestoPod(e.clientX, e.clientY);
      if (imya !== podKursorom) narisovatMarkery(imya);
      else if (sloi) {
        var pod = sloi.querySelector('.st-mesto-imya');
        if (pod) stavitPodpis(pod);
      }
    }
    /* ПОКА УКАЗКА ВКЛЮЧЕНА, МАКЕТ НЕ КЛИКАБЕЛЕН (Сергей 10.09: «элемент сам
       кликабельный, клик по нему уводит в другой режим — указка не работает»).
       Перехватывать один `click` мало: стенд слушает pointerdown и pointerup,
       а они приходят РАНЬШЕ клика — к моменту перехвата он уже успел
       переключить режим. Гасим пойнтерные события в фазе перехвата, до стенда;
       сам `click` не трогаем — им живёт выбор места.
       Гасим ВСЕГДА, а не только над опознанным местом: попал мимо — значит
       промахнулся, а не передумал и решил поработать с макетом. */
    function glushitel(e) {
      if (!rezhim) return;
      if (panel.contains(e.target)) return;          // по самой панели жать можно
      e.preventDefault(); e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    function vybor(e) {
      if (!rezhim) return;
      if (panel.contains(e.target)) return;
      var imya = mestoPod(e.clientX, e.clientY);
      // клик перехватывается целиком: на макете под ним могла быть ссылка
      e.preventDefault(); e.stopPropagation();
      if (!imya) return;                              // мимо места — но макет всё равно не трогаем
      var mesto = telo.scrollTop;
      mestoTek = imya;
      postavitAdres(imya);
      vyklyuchitRezhim();
      perestroitVid();
      telo.scrollTop = mesto;
    }
    if (karta0 && karta0.mesta.length) {
      sostP = document.createElement('button');
      sostP.type = 'button'; sostP.className = 'st-sost-p';
      sostP.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" ' +
        'stroke-width="1.3"><circle cx="7" cy="7" r="4"/><path d="M7 0v2.4M7 11.6V14M0 7h2.4M11.6 7H14"/></svg>';
      sostP.title = 'показать законы места на макете';
      sost.insertBefore(sostP, sostX);
      sostP.addEventListener('click', function () {
        if (rezhim) { vyklyuchitRezhim(); return; }
        rezhim = true;
        document.body.classList.add('st-vybor');
        sostP.classList.add('on');
      });
      document.addEventListener('pointermove', navedenie);
      document.addEventListener('click', vybor, true);
      ['pointerdown','pointerup','pointercancel','mousedown','mouseup','wheel','touchstart','touchend']
        .forEach(function (t) { document.addEventListener(t, glushitel, true); });
      // маркеры прибиты к экрану: под ними едет макет
      ['scroll', 'resize'].forEach(function (s) {
        window.addEventListener(s, function () {
          if (rezhim && podKursorom) narisovatMarkery(podKursorom);
        }, true);
      });

      /* АВАРИЙНЫЙ ВЫХОД. Правка закона может убрать место с экрана —
         тогда панель показывает законы того, чего нет. Проверяем замером,
         не чаще раза в треть секунды: ручку крутят десятками кадров. */
      /* ?mesto=Строка — панель открывается уже суженной. Тот же путь, что
         у ?nabor=: им нейронке говорят, над чем идёт работа. */
      var izAdresaMesta = (location.search.match(/[?&]mesto=([^&]+)/) || [])[1];
      if (izAdresaMesta) {
        var m0 = decodeURIComponent(izAdresaMesta);
        if (karta0.vMeste[m0]) { mestoTek = m0; postavitAdres(m0); }
      }

      var kogda = 0;
      document.addEventListener('stend:izmenenie', function () {
        if (!mestoTek) return;
        var t = Date.now(); if (t - kogda < 300) return; kogda = t;
        var g = karta0.gde[mestoTek];
        if (typeof g === 'function') return;
        var est = 0;
        g.forEach(function (sel) { try { est += document.querySelectorAll(sel).length; } catch (e) {} });
        if (est) return;
        var imya = mestoTek;
        vyhod();
        sostText.innerHTML = '<b>' + imya + '</b> · место исчезло, показаны все законы';
        setTimeout(obnovitSostoyanie, 2600);
      });
    }

    // Esc — рефлекс. Сначала гасит режим выбора, потом снимает сужение;
    // в поле ввода он занят отменой правки числа и сюда не доходит.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || panel.hidden) return;
      var a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if (rezhim) { vyklyuchitRezhim(); return; }
      vyhod();
    });

    perestroitVid();

    /* Органы из библиотеки строят свои подписи сами, до языка панели им
       дела нет. Чтобы он доставал и их, всё, что уже стоит в панели и не
       взято на учёт, берётся по своему русскому тексту: перевод ищется по
       нему же. Так новый орган переводится, ничего про язык не зная. */
    [].forEach.call(panel.querySelectorAll('label, option, button'), function (e) {
      for (var i = 0; i < nadpisi.length; i++) if (nadpisi[i].el === e) return;
      var t = (e.textContent || '').trim();
      if (!t || !/[А-Яа-яЁё]/.test(t)) return;
      nadpisi.push({ el: e, k: '', ru: t });
    });
    if (lang === 'en') nadpisi.forEach(function (n) { n.el.textContent = T(n.k, n.ru); });

    // ── подвал: тема панели + сброс ──
    var foot = addSection('Панель', null, { bezShvata: true });

    /* РАБОЧИЕ НАБОРЫ. Панель из тридцати ручек показывает всё сразу, а
       работа идёт над одним: над волной, над каталогом, над цветом. Набор —
       именованный список секций под текущую работу; остальные секции
       прячутся целиком (спрятано — значит нет). Выбор помнится на стенд,
       ?nabor=имя открывает нужный сразу — этим же путём набор может
       подставить нейронка, когда ей сказали, над чем работаем.

         nabory: {
           'всё': null,                       // null — показать все секции
           'волна': ['Волна', 'Ход'],
         }                                                                */
    var vyborNabora = null;
    if (o.nabory) {
      var NABOR_KEY = 'stend-nabor:' + o.storageKey;
      var imena = Object.keys(o.nabory);
      try { tekNabor = localStorage.getItem(NABOR_KEY); } catch (e) {}
      var izAdresa = (location.search.match(/[?&]nabor=([^&]+)/) || [])[1];
      if (izAdresa) tekNabor = decodeURIComponent(izAdresa);
      if (imena.indexOf(tekNabor) < 0) tekNabor = imena[0];

      // Полный набор — тот, что ничего не прячет: к нему ведёт выход.
      polnyi = imena.filter(function (i) { return o.nabory[i] === null; })[0] || imena[0];

      /* Набор, выбранный руками, снимает сужение по месту: уровень один,
         накладывать одно сужение на другое было решено не давать. При
         начальной сборке (nachalo) место с адреса ?mesto= остаётся. */
      function primenitNabor(imya, nachalo) {
        tekNabor = imya;
        if (!nachalo) mestoTek = null;
        try { localStorage.setItem(NABOR_KEY, imya); } catch (e) {}
        perestroitVid();
      }

      var nrow = document.createElement('div'); nrow.className = 'row';
      var nlab = document.createElement('label'); nadpis(nlab, 'panel:nabor', 'Набор');
      nsel = document.createElement('select');
      imena.forEach(function (imya) {
        var opt = document.createElement('option');
        opt.value = imya; nadpis(opt, 'nabor:' + imya, imya);
        nsel.appendChild(opt);
      });
      nsel.value = tekNabor;
      nsel.addEventListener('input', function () { primenitNabor(nsel.value); });
      nrow.appendChild(nlab); nrow.appendChild(nsel);
      foot.appendChild(nrow);
      primenitNabor(tekNabor, true);
      vyborNabora = function (imya) {
        if (!o.nabory[imya] && o.nabory[imya] !== null) return;
        nsel.value = imya; primenitNabor(imya);
      };
      vyborNabora.vyhod = vyhod;
    }
    var trow = document.createElement('div'); trow.className = 'row';
    var tlab = document.createElement('label'); nadpis(tlab, 'panel:theme', 'Тема');
    var tsel = document.createElement('select');
    [['apple', 'Эпл'], ['nothing', 'Нотхинг']].forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t[0]; nadpis(opt, 'theme:' + t[0], t[1]);
      tsel.appendChild(opt);
    });
    tsel.value = theme;
    tsel.addEventListener('input', function () { applyTheme(tsel.value); });
    trow.appendChild(tlab); trow.appendChild(tsel);
    foot.appendChild(trow);

    /* «Скопировать параметры» — адрес этой же страницы с теми ручками,
       что уведены от исходных. Стенд, который читает параметры из адреса,
       откроется ровно в этом состоянии; остальным это читаемый список
       настроек. Якорь сохраняется — уезжает и место, и вид. */
    // Отбор уведённых ручек один на обе кнопки: URL и текст правок —
    // две формы выдачи одного сравнения DEFAULTS против P.
    /* ── ОТСЧЁТ ОТ ДЕЙСТВУЮЩЕЙ ОСНОВЫ, А НЕ ОТ ПЕРВОНАЧАЛЬНОЙ ─────────
       Пресет («Вариант», «Профиль», «Палитра») выставляет пачку значений
       разом — и всё, что он выставил, отчёт считал правкой руки. На
       диагонали это давало 18 «уведённых» ручек там, где рука тронула две:
       четырнадцать были самим вариантом E, две — зеркалом профиля. Человек
       читает такой отчёт и не понимает, что он, собственно, сделал; отсюда
       и «второй день копаемся» (поймано Сергеем 03.09).

       Основа = умолчания стенда, поверх которых легли выбранные пресеты.
       Правка руки — то, что уведено ОТ НЕЁ. Пресеты берутся из объявления
       панели, поэтому стенду не нужно ничего объявлять дополнительно. */
    /* Служебные ключи стенда (версия схемы и подобное) — не величины:
       в отчёт правок и в адрес они не идут. Стенд объявляет их сам,
       угадывать нечего: `sluzhebnye: ['v']` в build. */
    var SLUZH = {};
    (o.sluzhebnye || []).forEach(function (k) { SLUZH[k] = true; });
    function osnova() {
      var baza = {};
      Object.keys(DEFAULTS).forEach(function (k) { baza[k] = DEFAULTS[k]; });
      (o.defs || []).forEach(function (d) {
        if (!Array.isArray(d) || d[2] !== 'preset' || !Array.isArray(d[3])) return;
        var vybran = d[3].filter(function (opt) { return String(opt[0]) === String(P[d[0]]); })[0];
        if (vybran && vybran[2]) Object.assign(baza, vybran[2]);
        // сам выбор пресета — часть основы, а не правка: он назван в шапке
        baza[d[0]] = P[d[0]];
      });
      return baza;
    }
    function uvedennye() {
      var out = [], baza = osnova();
      Object.keys(DEFAULTS).forEach(function (k) {
        if (SLUZH[k]) return;
        var v = P[k], d = baza[k];
        var same = (d && typeof d === 'object')
          ? JSON.stringify(v) === JSON.stringify(d)
          : String(v) === String(d);
        if (!same) out.push({ k: k, bylo: d, stalo: v });
      });
      return out;
    }
    function pokazatNaKnopke(kn, klyuch, ru) {
      return function (t) {
        kn.textContent = t;
        setTimeout(function () { kn.textContent = T(klyuch, ru); }, 1400);
      };
    }
    /* ── ЛОКАЛКА (решение Сергея 02.09: сначала локалка, публикация
       потом). На localhost у страницы есть мост к Клоду — lokalka.py
       принимает заявки в .zayavki/, и Клод видит их мгновенно. В
       интернете моста честно нет: там «Скопировать …» и буфер. */
    var lokalka = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    function zayavka(vid, telo, cb) {
      telo = telo || {};
      telo.vid = vid;
      telo.stend = location.pathname;
      try {
        fetch('/zayavka', { method: 'POST', body: JSON.stringify(telo) })
          .then(function (r) { cb && cb(r.ok); }, function () { cb && cb(false); });
      } catch (e) { cb && cb(false); }
    }
    // ошибки страницы прилетают сами: «я глаза, ты мозг» без скриншотов
    if (lokalka) {
      window.addEventListener('error', function (e) {
        zayavka('oshibka', { tekst: String(e.message || e),
          fail: (e.filename || '') + ':' + (e.lineno || ''), });
      });
    }

    var cp = document.createElement('button');
    cp.className = 'st-reset st-copy';
    nadpis(cp, 'panel:copy', 'Ссылка на этот вид');
    cp.title = 'Адрес этой страницы с уведёнными ручками. Открой его — стенд встанет ровно в этот вид; пошли ссылку — увидят то же самое. В код не идёт.';
    cp.addEventListener('click', function () {
      var q = [];
      uvedennye().forEach(function (u) {
        q.push(encodeURIComponent(u.k) + '=' +
          encodeURIComponent(znachenieVAdres(u.stalo)));
      });
      var url = bazovyjAdres() +
        (q.length ? '?' + q.join('&') : '') + location.hash;
      var said = pokazatNaKnopke(cp, 'panel:copy', 'Ссылка на этот вид');
      var ok = function () {
        said(q.length ? T('', 'скопировано: ') + q.length + T('', ' ручек')
                      : T('', 'всё по умолчанию'));
      };
      var ruchkami = function () { prompt(T('', 'Параметры:'), url); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, ruchkami);
      else ruchkami();
    });
    telo.appendChild(cp);

    /* «Скопировать правки» — тот же отбор, вторая форма выдачи. URL выше
       читает машина; модели и человеку нужен текст: подпись, тип и пара
       «было → стало», сгруппированные по секциям. Закрывает разрыв цикла:
       значения живут в localStorage, в коде стоят старые дефолты, и
       следующая сессия рассуждала бы о ненастроенном стенде. */
    var cpp = document.createElement('button');
    cpp.className = 'st-reset st-copy';
    nadpis(cpp, 'panel:copyEdits', 'Правки для кода');
    cpp.title = 'Список того, что ты увёл ОТ ОСНОВЫ — с именами ручек, было и стало. Это текст для кода: вписать в пресет или в умолчания стенда. Основа названа в первой строке.';
    cpp.addEventListener('click', function () {
      var uved = uvedennye();
      var saidP = pokazatNaKnopke(cpp, 'panel:copyEdits', 'Правки для кода');
      if (!uved.length) { saidP(T('', 'всё по умолчанию')); return; }
      function znak(v) { return Array.isArray(v) ? JSON.stringify(v) : String(v); }
      // группировка по секциям в порядке появления в панели
      var poSekciyam = [], vSekcii = {};
      uved.forEach(function (u) {
        var op = opisRuchek[u.k] || { podpis: u.k, sekciya: '' };
        var sek = op.sekciya || '(без секции)';
        if (!vSekcii[sek]) { vSekcii[sek] = []; poSekciyam.push(sek); }
        vSekcii[sek].push({ k: u.k, podpis: op.podpis, tip: tipRuchki[u.k] || '',
                            bylo: znak(u.bylo), stalo: znak(u.stalo) });
      });
      // секции идут в порядке панели, не в порядке ключей DEFAULTS
      var poryadok = sekcii.map(function (x) { return x.title; });
      poSekciyam.sort(function (a, b) { return poryadok.indexOf(a) - poryadok.indexOf(b); });
      var w1 = 0, w2 = 0, w3 = 0;
      uved.forEach(function (u) {
        var op = opisRuchek[u.k] || { podpis: u.k };
        w1 = Math.max(w1, u.k.length);
        w2 = Math.max(w2, (op.podpis || '').length);
        w3 = Math.max(w3, (tipRuchki[u.k] || '').length);
      });
      function pad(t, n) { t = String(t); while (t.length < n) t += ' '; return t; }
      var imya = (location.pathname.split('/').pop() || location.pathname) || 'стенд';
      /* Шапка называет основу: без неё непонятно, от чего считали правки,
         и человек принимает пресет за свою работу. */
      var podpisiPresetov = [];
      (o.defs || []).forEach(function (d) {
        if (!Array.isArray(d) || d[2] !== 'preset' || !Array.isArray(d[3])) return;
        var vybran = d[3].filter(function (opt) { return String(opt[0]) === String(P[d[0]]); })[0];
        if (vybran) podpisiPresetov.push((d[1] || d[0]) + ': ' + vybran[1]);
      });
      var stroki = ['Стенд: ' + imya + ' \u00b7 ' + location.origin + location.pathname,
                    'Основа: ' + (podpisiPresetov.length ? podpisiPresetov.join(' \u00b7 ') : 'умолчания стенда'),
                    'Уведено ' + ruchek(uved.length) + ' от неё.', ''];
      poSekciyam.forEach(function (sek) {
        stroki.push(sek);
        vSekcii[sek].forEach(function (r) {
          stroki.push('  ' + pad(r.k, w1) + '  ' + pad(r.podpis, w2) +
                      (w3 ? '  ' + pad(r.tip, w3) : '') + '  ' + r.bylo + ' \u2192 ' + r.stalo);
        });
      });
      stroki.push('');
      stroki.push(podpisiPresetov.length
        ? 'Это правка поверх основы. Впиши значения туда, откуда основа взята — в свой пресет (' +
          podpisiPresetov.join(', ') + '), а в DEFAULTS только то, что к пресету не относится.'
        : 'Впиши эти значения в DEFAULTS стенда как новые значения по умолчанию.');
      var tekst = stroki.join('\n');
      var okP = function () { saidP(T('', 'скопировано: ') + uved.length + T('', ' ручек')); };
      var rukamiP = function () { prompt(T('', 'Правки:'), tekst); };
      if (navigator.clipboard) navigator.clipboard.writeText(tekst).then(okP, rukamiP);
      else rukamiP();
    });
    telo.appendChild(cpp);

    /* «Считать эталоном» — только на локалке: заявка с уведёнными
       ручками падает файлом, Клод сверяет и вписывает в DEFAULTS.
       Правда остаётся одна — эталон живёт в коде; кнопка не назначает
       его, а отправляет предложение без буфера обмена. */
    if (lokalka) {
      var et = document.createElement('button');
      et.className = 'st-reset st-copy';
      nadpis(et, 'panel:etalon', 'Считать эталоном');
      et.title = 'Тот же список правок, но не в буфер, а заявкой Клоду — файлом в .zayavki. Он сверит и впишет в код. Работает только на локалке.';
      et.addEventListener('click', function () {
        var uved = uvedennye().map(function (u) {
          return { k: u.k, bylo: u.bylo, stalo: u.stalo,
                   podpis: (opisRuchek[u.k] || {}).podpis || u.k };
        });
        var skazal = pokazatNaKnopke(et, 'panel:etalon', 'Считать эталоном');
        if (!uved.length) { skazal(T('', 'всё и так по умолчанию')); return; }
        zayavka('etalon', { ruchki: uved, otkloneniya: P.otkloneniya }, function (ok) {
          skazal(ok ? T('', 'отправлено: ') + ruchek(uved.length)
                    : T('', 'локалка не отвечает'));
        });
      });
      telo.appendChild(et);
    }

    var rst = document.createElement('button');
    rst.className = 'st-reset';
    nadpis(rst, 'panel:reset', 'Сбросить настройки');
    rst.title = 'Вернуть все ручки к умолчаниям стенда. Обратимо: шесть секунд кнопка предлагает вернуть уведённое назад.';
    /* ОБРАТИМОСТЬ ВМЕСТО ПРЕДУПРЕЖДЕНИЯ. Сброс возвращает десятки ручек
       разом; HIG велит предупреждать о необратимой потере — вместо окна
       кнопка шесть секунд предлагает «Вернуть N ручек» (приёмка 02.09). */
    var vozvrat = null, vozvratT = 0;
    rst.addEventListener('click', function () {
      if (vozvrat) {
        Object.assign(P, JSON.parse(vozvrat)); vozvrat = null; clearTimeout(vozvratT);
        rst.textContent = T('panel:reset', 'Сбросить настройки');
        for (var k2 in controls) controls[k2]();
        izmenilos('__vozvrat');
        return;
      }
      var snimok = JSON.stringify(P), n = uvedennye().length;
      Object.assign(P, DEFAULTS);
      // рукоятки безье — копиями, чтобы лепка не портила DEFAULTS
      (o.defs || []).forEach(function (d) {
        if (d[2] !== 'ease') return;
        var bk = d[0].replace('Ease', 'Bez');
        if (Array.isArray(DEFAULTS[bk])) P[bk] = DEFAULTS[bk].slice();
      });
      // объекты (гнездо отступлений стилей) — тоже копиями, не ссылкой
      Object.keys(DEFAULTS).forEach(function (k) {
        if (DEFAULTS[k] && typeof DEFAULTS[k] === 'object' && !Array.isArray(DEFAULTS[k])) {
          P[k] = JSON.parse(JSON.stringify(DEFAULTS[k]));
        }
      });
      try { localStorage.removeItem(o.storageKey); } catch (e) {}
      for (var k in controls) controls[k]();
      izmenilos('__reset');   // стенд и откат узнают о сбросе, как о любой правке
      if (n) {
        vozvrat = snimok;
        // согласование числительного — общий помощник, а не «1 ручек»
        rst.textContent = T('panel:vernut', 'Вернуть') + ' ' + (typeof ruchek === 'function' ? ruchek(n) : n + ' ручек');
        vozvratT = setTimeout(function () {
          vozvrat = null; rst.textContent = T('panel:reset', 'Сбросить настройки');
        }, 6000);
      }
    });
    telo.appendChild(rst);

    /* Показать или спрятать — ОДНОЙ дверью: и кнопка, и адрес, и Esc ходят
       через неё, поэтому знак на кнопке не может разойтись с делом. */
    function pokazatPanel(da) {
      panel.hidden = !da;
      /* Панель уходит со всем своим: слои правки на макете (узлы траектории,
         выбор места) — её продолжение, а не часть стенда. Оставшись висеть,
         они читаются как «панель не закрылась» и перехватывают клики по
         работе. Органы слушают событие и убирают своё. */
      if (!da) {
        try { document.dispatchEvent(new CustomEvent('stend:panel-zakryta')); } catch (e) {}
      }
      gear.innerHTML = da ? ZNAK_KREST : ZNAK_RUCHKI;
      gear.title = da ? 'закрыть панель' : 'настройки';
      gear.setAttribute('aria-label', gear.title);
      gear.setAttribute('aria-expanded', String(!!da));
      if (da) skrollObnovit();     // тело мерится, только когда видно
    }
    gear.addEventListener('click', function () { pokazatPanel(panel.hidden); });
    /* Стенд вправе открыть панель сам (rasfokus показывает её при первом
       заходе), и делает это атрибутом. Следим за атрибутом, а не только за
       своей кнопкой: иначе знак на ней разойдётся с делом — крестик на
       закрытой или ручки на открытой. */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var da = !panel.hidden;
        gear.innerHTML = da ? ZNAK_KREST : ZNAK_RUCHKI;
        gear.title = da ? 'закрыть панель' : 'настройки';
        gear.setAttribute('aria-label', gear.title);
        gear.setAttribute('aria-expanded', String(da));
      }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    }
    /* Панель НЕ закрывается кликом по макету. Закрытие по клику вне было
       заведено, пока клик по макету ничего не значил; теперь он выбирает
       место, и панель обязана остаться на экране — иначе выбор места
       гасит то самое, ради чего он делается. Закрывает шестерёнка. */
    vernutPoisk();                              // отбор пережил перезагрузку — возвращаем его на место
    pokazatPanel(/[?&]panel/.test(location.search));
    applyTheme(theme);
    svetlota();
    vosstanovitPoryadok();

    return {
      save: save, panel: panel, applyTheme: applyTheme, temaSyuda: temaSyuda,
      params: P, defaults: DEFAULTS, controls: controls,
      // что уведено рукой от действующей основы (пресеты уже учтены)
      uvedennye: uvedennye,
      // показать или спрятать панель: знак на кнопке идёт следом
      pokazat: pokazatPanel,
      /* ТЕЛО ПАНЕЛИ — куда стенд вставляет своё. С хода 31 содержимое живёт
         в прокручиваемом .st-telo, а не прямо в панели: стенды, вставлявшие
         свои карточки в panel, роняли insertBefore или клали их вне
         прокрутки (поймано на приёмке 03.09). Вставлять — сюда. */
      telo: telo,
      // перерисовать все ручки после внешней правки P (откат, пресет извне)
      obnovit: function () { for (var k in controls) controls[k](); },
      nabor: vyborNabora, // переключить рабочий набор снаружи (агент, скрипт)
      // сузить панель до законов места снаружи; без имени — выход
      mesto: function (imya) {
        if (imya && (!karta0 || !karta0.vMeste[imya])) return;
        if (!imya) { vyhod(); return; }
        mestoTek = imya; postavitAdres(imya); perestroitVid();
      },
      vyhod: vyhod,
    };
  }

  /* ТОЧКА УВОДА ВНУТРИ ПОЛЯ — для органов с полями ввода (коридор полями,
     пара, фазы): число в таких полях стоит слева, точка — справа
     (предложение Сергея 02.09). est() — уведено ли, vernut() — вернуть
     умолчание. Помощник оборачивает поле и отдаёт obnovit() для перерисовки. */
  function tochkaUvoda(inp, est, vernut) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'st-uvod';
    b.title = 'уведено от умолчания — вернуть';
    function obnovit() { b.classList.toggle('on', !!est()); }
    b.addEventListener('click', function () { vernut(); obnovit(); });
    /* Поле, собранное общим блоком, само себе обёртка: точка кладётся
       ВНУТРЬ него, справа от числа (Г4, П16). Оборачивать такое поле ещё
       раз значило бы плашку в плашке — с двойной рамкой и двойным полем
       (04.09, при переводе коридора и пары на блок). */
    var blok = inp.parentNode && inp.parentNode.classList &&
               inp.parentNode.classList.contains('st-pole-blok') ? inp.parentNode : null;
    if (blok) { blok.appendChild(b); return { obl: blok, obnovit: obnovit }; }
    var obl = document.createElement('span'); obl.className = 'st-pole-obl sprava';
    if (inp.parentNode) inp.parentNode.insertBefore(obl, inp);
    obl.appendChild(inp); obl.appendChild(b);
    return { obl: obl, obnovit: obnovit };
  }

  window.StendPanel = {
    // общий блок поля ввода: подпись внутри, клик выделяет число целиком
    poleBlok: poleBlok,
    // общий блок нитки: трек, заливка, пилюля с числом (Г9)
    nitkaBlok: nitkaBlok,
    // общий блок числа на этаже имени: показатель и поле по клику (Г9)
    chisloBlok: chisloBlok,
    // свой пикер цвета вместо системного окна: { znachenie, postavit }
    piker: pikerCveta,
    build: build,
    tochkaUvoda: tochkaUvoda,
    klavishi: klavishiChisla, // стрелки ±1 / Shift ±10 / запятая — для полей органов
    tip: function (imya, fn) { TIPY[imya] = fn; return this; },
    tipy: TIPY,
    vyrazhenie: vyrazhenie, // математика в полях числа — и органам тоже
    znachenieVAdres: znachenieVAdres, // объекты → JSON, массивы → join (для ссылок)
    bazovyjAdres: bazovyjAdres,       // file:// без префикса «null/»
  };
})();

