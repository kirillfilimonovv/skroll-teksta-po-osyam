/* © Сергей Гуров · Михаил Матвеев · Александр Копинов, 2026 · панель стендов · метод «Основа» · stendy.vercel.app */
/* ТРАЕКТОРИЯ — путь на плоскости: узлы, скругление законом, острые углы числом.

   Кривая траектории и кривая движения — разные вещи, и путать их нельзя.
   Движение — функция времени: у каждого момента одно значение, назад по X
   она не идёт. Траектория — путь: гнётся как угодно, замыкается, держит
   острые углы. Поэтому у неё свой ПРЕДМЕТ — а руки общие.

   РУКИ — У ЯДРА (ход 59). Жесты, попадание, оснастка, инструмент «гнуть»
   общие для всех редакторов кривых и живут в panel-lib/uzly.js. Орган
   отдаёт ядру модель: где узлы, откуда плечи, как узел ходит, что значит
   клик. Прежде орган держал восемьсот строк своих рук; теперь предмет —
   здесь, руки — там. Одна модель питает два холста: карту в панели и слой
   правки на макете, разница только в области.

   ЗАКОН ВМЕСТО ВЫКРУЧИВАНИЯ. Касательные здесь не то, что тянут руками, а
   то, что выводится из скругления узла: длина касательной — доля расстояния
   до соседей (Catmull-Rom с натяжением). Скругление 0 даёт гарантированно
   острый угол — не «добился на глаз», а поставил ноль. Скругление 1 — самая
   гладкая дуга, какую позволяют соседи. Одна ручка на узел и одна общая на
   всю кривую; рукой касательную трогают только когда нужно отклониться от
   закона, и тогда узел помечается ручным (у него появляются свои плечи).

   ЗЕРКАЛЬНОСТЬ ПЛЕЧ у ручного узла — три режима, как в Фигме: «нет» (плечи
   независимы, это и есть острый угол с изломом), «угол» (второе плечо
   держит направление первого, длина своя), «угол и длина» (полная
   симметрия). Режим хранится У УЗЛА, а не угадывается по геометрии:
   иначе непонятно, что случится при следующей тяге.

   Объявление:
     ['put', 'Траектория', 'traektoriya', { mesto: '.stage' }]
   Значение в P:
     { uzly: [{ x, y, r, z, ho, hi }], zamknut: false }
       x, y — доли области (0…1): траектория переживает смену размера
       r    — скругление узла 0…1 (доля до соседей); 0 — острый угол
       z    — режим плеч ручного узла: 'net' | 'ugol' | 'ugoldlina'
       ho, hi — плечи ручного узла в долях; нет — узел живёт законом

   Стенду:
     StendPanel.put.d(znachenie, w, h)     — строка пути для SVG или canvas
     StendPanel.put.tochka(znachenie, t, w, h) — точка на пути, доля 0…1     */
(function () {
  var STIL =
    /* Вёрстка по своду графических блоков (Г1, Г2, Г5, Г8):
       имя — первым этажом во всю ширину, орган — вторым; нитка от кромки до
       кромки; подписи полей внутри полей заглавными; высота малого органа 22. */
    '.st-put{width:100%;margin-top:5px}' +
    '.st-put-karta{display:block;width:100%;height:120px;border-radius:8px;' +
      'background:rgba(0,0,0,.35)}' +
    '.st-put-etazh{margin-top:10px}' +
    '.st-put-imya{display:flex;align-items:center;justify-content:space-between;gap:8px;' +
      'font:13px/1.35 var(--st-font);color:var(--st-text);margin-bottom:6px}' +
    '.st-put .st-pole-blok.st-put-pokaz{flex:none;width:56px}' +
    /* Г9: ряд чипов и степпер — общие блоки ядра (.st-chipy / .st-chip /
       .st-stepper). */
    /* Г2: нитка во всю ширину — базовое правило панели даёт range 104 px, */
    /* поэтому здесь нужен вес селектора панели */
    '.st-panel .st-put .st-put-nitka{width:100%;flex:none}' +
    '.st-put-uzly-spisok{display:flex;flex-direction:column;gap:2px;margin-top:6px;width:100%}' +
    '.st-put-uzel-ryad{display:flex;gap:2px;align-items:center;width:100%}' +
    '.st-put-uzel-ryad>b{flex:none;width:18px;font:11px/1 var(--st-font);' +
      'color:var(--st-text-2);text-align:center}' +
    '.st-put-uzel-ryad.vybran>b{color:var(--st-accent)}' +
    '.st-put-uzel-ryad .st-pole-blok{flex:1;min-width:0}' +
    '.row:has(>.st-put){flex-wrap:wrap}';

  /* ── ЗАКОН: узлы → кубические сегменты ─────────────────────────────────
     Для сегмента i → i+1 плечи берутся из разностей соседей, помноженных
     на скругление своего узла. Ручное плечо, если оно задано, побеждает
     закон — но только у своего конца сегмента. */
  function segmenty(zn) {
    var u = (zn && zn.uzly) || [];
    var zam = !!(zn && zn.zamknut);
    var n = u.length;
    if (n < 2) return [];
    var segs = [];
    function uzel(i) {
      if (zam) return u[(i + n) % n];
      return u[Math.max(0, Math.min(n - 1, i))];
    }
    var poslednij = zam ? n : n - 1;
    for (var i = 0; i < poslednij; i++) {
      var a = uzel(i), b = uzel(i + 1);
      var pa = uzel(i - 1), pb = uzel(i + 2);
      var ra = a.r == null ? 0.5 : a.r, rb = b.r == null ? 0.5 : b.r;
      var c1 = a.ho
        ? { x: a.x + a.ho.x, y: a.y + a.ho.y }
        : { x: a.x + (b.x - pa.x) / 6 * ra * 2, y: a.y + (b.y - pa.y) / 6 * ra * 2 };
      var c2 = b.hi
        ? { x: b.x + b.hi.x, y: b.y + b.hi.y }
        : { x: b.x - (pb.x - a.x) / 6 * rb * 2, y: b.y - (pb.y - a.y) / 6 * rb * 2 };
      segs.push({ a: a, b: b, c1: c1, c2: c2, ia: i, ib: zam ? (i + 1) % n : i + 1 });
    }
    return segs;
  }

  function d(zn, w, h) {
    w = w || 1; h = h || 1;
    var segs = segmenty(zn);
    if (!segs.length) return '';
    var s = 'M ' + (segs[0].a.x * w).toFixed(2) + ' ' + (segs[0].a.y * h).toFixed(2);
    segs.forEach(function (g) {
      s += ' C ' + (g.c1.x * w).toFixed(2) + ' ' + (g.c1.y * h).toFixed(2) +
           ' ' + (g.c2.x * w).toFixed(2) + ' ' + (g.c2.y * h).toFixed(2) +
           ' ' + (g.b.x * w).toFixed(2) + ' ' + (g.b.y * h).toFixed(2);
    });
    if (zn && zn.zamknut) s += ' Z';
    return s;
  }

  function vTochke(g, t) {           // точка на кубическом сегменте
    var u = 1 - t;
    return {
      x: u * u * u * g.a.x + 3 * u * u * t * g.c1.x + 3 * u * t * t * g.c2.x + t * t * t * g.b.x,
      y: u * u * u * g.a.y + 3 * u * u * t * g.c1.y + 3 * u * t * t * g.c2.y + t * t * t * g.b.y
    };
  }
  function tochka(zn, t, w, h) {
    var segs = segmenty(zn);
    if (!segs.length) return { x: 0, y: 0 };
    var k = Math.max(0, Math.min(0.999999, t)) * segs.length;
    var i = Math.floor(k);
    var p = vTochke(segs[i], k - i);
    return { x: p.x * (w || 1), y: p.y * (h || 1) };
  }
  /* Ближайшее место на пути — стенду: подсветка под курсором и прочее. */
  function blizhe(zn, x, y) {
    var segs = segmenty(zn);
    var luchshe = null;
    for (var i = 0; i < segs.length; i++) {
      for (var j = 0; j <= 24; j++) {
        var t = j / 24, p = vTochke(segs[i], t);
        var d2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (!luchshe || d2 < luchshe.d2) luchshe = { d2: d2, seg: i, t: t, p: p };
      }
    }
    return luchshe;
  }
  /* Прямой ли сегмент: обе контрольные точки лежат на хорде. Та же мера,
     что у оси диагонали — по ней узел рождается углом или разрезом (Г10). */
  function pryamoy(g) {
    var dx = g.b.x - g.a.x, dy = g.b.y - g.a.y, len2 = dx * dx + dy * dy;
    function otklon(c) {
      if (len2 < 1e-12) return Math.hypot(c.x - g.a.x, c.y - g.a.y);
      var q = ((c.x - g.a.x) * dx + (c.y - g.a.y) * dy) / len2;
      return Math.hypot(c.x - (g.a.x + dx * q), c.y - (g.a.y + dy * q));
    }
    return otklon(g.c1) < 0.004 && otklon(g.c2) < 0.004;
  }
  function r4(v) { return +(+v).toFixed(4); }

  StendPanel.tip('traektoriya', function (row, def, P, api) {
    if (!document.getElementById('st-put-css')) {
      var st = document.createElement('style'); st.id = 'st-put-css';
      st.textContent = STIL; document.head.appendChild(st);
    }
    var key = def[0];
    var opt = def[3] || {};
    if (!P[key] || !P[key].uzly) P[key] = { uzly: [{ x: .1, y: .8, r: .5 }, { x: .9, y: .2, r: .5 }], zamknut: false };
    /* Умолчание пути кладём в defaults, если стенд его не объявил: без него
       «Сбросить настройки» траекторию не возвращало, а точка увода не
       загоралась — сравнивать было не с чем (правка 03.09). Копией, не
       ссылкой: иначе правка узлов правила бы и умолчание. */
    if (api.defaults && api.defaults[key] === undefined) {
      api.defaults[key] = JSON.parse(JSON.stringify(P[key]));
    }

    var box = document.createElement('div'); box.className = 'st-put';
    var karta = document.createElement('canvas'); karta.className = 'st-put-karta';
    box.appendChild(karta);

    var vybran = 0;                       // какой узел под рукой — общий для карты и слоя

    /* Г1: каждый орган — своим этажом. Имя первым, орган вторым во всю
       ширину. Строкой оставлены только счёт и тумблер — они влезают в
       правую колонку. */
    function etazh(imya, pravo) {
      var e = document.createElement('div'); e.className = 'st-put-etazh';
      var stroka = document.createElement('div'); stroka.className = 'st-put-imya';
      var t = document.createElement('span'); t.textContent = imya;
      stroka.appendChild(t);
      if (pravo) stroka.appendChild(pravo);
      e.appendChild(stroka);
      box.appendChild(e);
      return e;
    }

    // ── узлы: счёт степпером (Г6), замыкание, инструмент «гнуть», слой ──
    var schetBox = document.createElement('div'); schetBox.className = 'st-stepper';
    var menshe = document.createElement('button'); menshe.type = 'button';
    menshe.textContent = '−'; menshe.title = 'убрать выбранный узел (на макете — ✕ у него же, или Delete)';
    var schet = document.createElement('b');
    var bolshe = document.createElement('button'); bolshe.type = 'button';
    bolshe.textContent = '+'; bolshe.title = 'добавить узел посередине самого длинного звена';
    schetBox.appendChild(menshe); schetBox.appendChild(schet); schetBox.appendChild(bolshe);
    var eUzly = etazh('Узлов', schetBox);
    var r1 = document.createElement('div'); r1.className = 'st-chipy';
    var zamk = knopka('замкнуть', 'соединить конец с началом');
    var gnutChip = knopka('гнуть', 'тяга за линию гнёт участок между узлами; отжат — линия держит форму, узлы и плечи правятся (принцип Фигмы, Г10)');
    var naMakete = knopka('править на макете', 'узлы и касательные поверх стенда: тяни узел, плечо или (при «гнуть») саму линию; ✕ убирает узел, Esc — выйти');
    r1.appendChild(zamk); r1.appendChild(gnutChip); r1.appendChild(naMakete);
    eUzly.appendChild(r1);

    // ── скругление всех: показатель на этаже имени, нитка во всю ширину (Г2, Г3) ──
    var pokazBlok = StendPanel.poleBlok('', { imya: 'скругление всех узлов, доля' });
    pokazBlok.box.classList.add('st-put-pokaz');
    var pokazObsh = pokazBlok.inp;
    if (StendPanel.klavishi) StendPanel.klavishi(pokazObsh);
    var eSkrug = etazh('Скругление всех, доля', pokazBlok.box);
    /* «СКРУГЛЕНИЕ ВСЕХ» ПОКАЗЫВАЕТ ВСЕХ (правка Сергея 03.09): все равны —
       их значение; разные — среднее, и показатель гаснет до вторичного цвета,
       как «смешанное» в Фигме. Величина считается в одном месте: её читают
       и нитка, и число. */
    function odnoSkruglenie() {
      var rr = zn().uzly.map(function (q) { return q.r == null ? 0.5 : q.r; });
      return rr.every(function (q) { return Math.abs(q - rr[0]) < 1e-6; });
    }
    function obshR() {
      var rr = zn().uzly.map(function (q) { return q.r == null ? 0.5 : q.r; });
      return odnoSkruglenie() ? rr[0] : rr.reduce(function (a, b) { return a + b; }, 0) / (rr.length || 1);
    }
    /* Г9: нитка — блок ядра (ход 64). Своя красилась фоном инпута, и
       заливка ложилась поверх дорожки; пилюли не было вовсе. Число живёт
       в поле на этаже имени (показатель «скругление всех»), поэтому у
       пилюли остаётся одно дело — тянуться. */
    var nbObsh = StendPanel.nitkaBlok({
      min: 0, max: 1, shag: 0.01,
      znachenie: function () { return obshR(); },
      postavit: function (v) {
        zn().uzly.forEach(function (u) { u.r = v; delete u.ho; delete u.hi; });
        izmenilos();
      },
      tekst: function () { return (+obshR()).toFixed(2); }
    });
    var obshee = nbObsh.inp;
    nbObsh.obl.classList.add('st-put-nitka');
    eSkrug.appendChild(nbObsh.obl);

    // ── узел: тип ──
    var eTip = etazh('Узел');
    var r3 = document.createElement('div'); r3.className = 'st-chipy';
    var ostr = knopka('острый', 'угол без скругления: доля 0');
    var glad = knopka('гладкий', 'скругление по закону соседей');
    var ruch = knopka('ручной', 'плечи заданы рукой');
    r3.appendChild(ostr); r3.appendChild(glad); r3.appendChild(ruch);
    eTip.appendChild(r3);

    // ── координаты всех узлов: список x/y, правка руками (не только тягой) ──
    var eCoord = etazh('Координаты узлов');
    var spisokCoord = document.createElement('div');
    spisokCoord.className = 'st-put-uzly-spisok';
    eCoord.appendChild(spisokCoord);
    var ryadyCoord = [];

    // ── скругление выбранного узла ──
    var eChisla = etazh('Скругление узла');
    var polyaRyad = document.createElement('div'); polyaRyad.className = 'st-polya-ryad';
    var pr = pole('r');
    polyaRyad.appendChild(pr.box);
    eChisla.appendChild(polyaRyad);

    // ── плечи ручного узла ──
    var ePlechi = etazh('Плечи узла');
    var r5 = document.createElement('div'); r5.className = 'st-chipy';
    var zNet = knopka('свободно', 'плечи независимы — излом (Alt при тяге рвёт зеркальность на лету)');
    var zUgol = knopka('угол', 'второе плечо держит направление первого');
    var zOba = knopka('угол и длина', 'полная симметрия — зеркальные плечи');
    r5.appendChild(zNet); r5.appendChild(zUgol); r5.appendChild(zOba);
    ePlechi.appendChild(r5);

    function knopka(t, tit) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'st-chip'; b.title = tit || '';
      var sp = document.createElement('span'); sp.textContent = t; b.appendChild(sp);
      return b;
    }
    /* Г9: поле — общий блок ядра. */
    function pole(imya) {
      var p2 = StendPanel.poleBlok(imya, { imya: imya + ' узла' });
      if (StendPanel.klavishi) StendPanel.klavishi(p2.inp);
      return p2;
    }
    /* Доли экрана: стрелки ±0.01 / Shift ±0.1 — не ±1 как у кегля. */
    function klavishiDoli(inp, posle) {
      inp.addEventListener('keydown', function (ev) {
        if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
        ev.preventDefault();
        var v = parseFloat(String(inp.value).replace(',', '.')) || 0;
        var s = ev.shiftKey ? 0.1 : 0.01;
        inp.value = parseFloat((v + (ev.key === 'ArrowUp' ? s : -s)).toFixed(4));
        if (posle) posle();
      });
    }

    function zn() { return P[key]; }
    function uzel() { return zn().uzly[Math.min(vybran, zn().uzly.length - 1)]; }
    function akcent() { return (api.accent && api.accent()) || '#0A84FF'; }

    /* ── ПРЕДМЕТ: плечи узла — ручные, если заданы, иначе выведенные из
       закона — те самые c1/c2, по которым рисуется путь. Одна точка правды:
       что видит рука, то и исполняет кривая. Отлёт для короткого плеча
       ставит ядро — оно про руки. */
    function plechiUzla(i) {
      var v = zn(), u = v.uzly[i], segs = segmenty(v), n = v.uzly.length;
      var vpered = segs[i];
      var nazad = v.zamknut ? segs[(i - 1 + n) % n] : segs[i - 1];
      var ho = u.ho ? { x: u.x + u.ho.x, y: u.y + u.ho.y } : (vpered ? { x: vpered.c1.x, y: vpered.c1.y } : null);
      var hi = u.hi ? { x: u.x + u.hi.x, y: u.y + u.hi.y } : (nazad ? { x: nazad.c2.x, y: nazad.c2.y } : null);
      return { ho: ho, hi: hi, ruchnoy: !!(u.ho || u.hi) };
    }
    /* Закон застывает: плечи узла берут текущую форму и становятся ручными.
       Так узел переживает тягу плеча, изгиб участка и разрез рядом. */
    function zamorozit(i, z) {
      var u = zn().uzly[i];
      if (u.ho || u.hi) return;
      var pl = plechiUzla(i);
      if (pl.ho) u.ho = { x: r4(pl.ho.x - u.x), y: r4(pl.ho.y - u.y) };
      if (pl.hi) u.hi = { x: r4(pl.hi.x - u.x), y: r4(pl.hi.y - u.y) };
      u.z = u.z || z || 'ugoldlina';
    }
    /* Тяга плеча. Узел становится ручным: плечо запоминается как есть, а
       второе идёт за ним по режиму зеркальности узла. Alt рвёт зеркальность
       на лету — как в Фигме. */
    function tyanutPlecho(i, kakoe, x, y, alt) {
      var u = zn().uzly[i];
      zamorozit(i, 'ugoldlina');
      var v2 = { x: r4(x - u.x), y: r4(y - u.y) };
      u[kakoe] = v2;
      var drugoe = kakoe === 'ho' ? 'hi' : 'ho';
      var rezhim = alt ? 'net' : (u.z || 'ugoldlina');
      if (alt) u.z = 'net';
      if (rezhim !== 'net') {
        var m = Math.hypot(v2.x, v2.y) || 1;
        var dl = rezhim === 'ugoldlina' ? m : (u[drugoe] ? Math.hypot(u[drugoe].x, u[drugoe].y) : m);
        u[drugoe] = { x: r4(-v2.x / m * dl), y: r4(-v2.y / m * dl) };
      } else if (!u[drugoe]) {
        u[drugoe] = { x: r4(-v2.x * .4), y: r4(-v2.y * .4) };
      }
    }
    /* ТЯГА ЗА САМУ ЛИНИЮ. Ход делится между двумя плечами сегмента по
       весам Бернштейна в точке захвата — тянешь у края, едет ближнее
       плечо; в середине едут оба. Оба узла становятся ручными и
       свободными: тяга линии не должна дёргать соседний сегмент. */
    function nachatGnut(seg, t, x, y) {
      var v = zn(), g = segmenty(v)[seg];
      return { seg: seg, t: t, x: x, y: y,
               ho: { x: g.c1.x - v.uzly[g.ia].x, y: g.c1.y - v.uzly[g.ia].y },
               hi: { x: g.c2.x - v.uzly[g.ib].x, y: g.c2.y - v.uzly[g.ib].y } };
    }
    function gnut(nach, x, y) {
      var v = zn(), g = segmenty(v)[nach.seg];
      var a = v.uzly[g.ia], b = v.uzly[g.ib];
      zamorozit(g.ia, 'net'); zamorozit(g.ib, 'net');
      var t = nach.t, uu = 1 - t;
      var w1 = 3 * uu * uu * t, w2 = 3 * uu * t * t;
      if (!(w1 + w2)) { w1 = t < .5 ? 1 : 0; w2 = 1 - w1; }
      var sum = w1 + w2, dx = x - nach.x, dy = y - nach.y;
      a.ho = { x: r4(nach.ho.x + dx * w1 / sum), y: r4(nach.ho.y + dy * w1 / sum) };
      b.hi = { x: r4(nach.hi.x + dx * w2 / sum), y: r4(nach.hi.y + dy * w2 / sum) };
    }
    /* НОВЫЙ УЗЕЛ САДИТСЯ РАЗРЕЗОМ (Г10). Прямой участок — узел рождается
       углом: чистый угол есть состояние, к которому проще прибавлять.
       Изогнутый — режется по де Кастельжо: точка получает независимые
       плечи, у соседей меняется только половина, смотрящая в разрез, и
       форма не шелохнётся. */
    function vstavit(seg, t, p) {
      var v = zn(), u = v.uzly, g = segmenty(v)[seg];
      if (pryamoy(g)) {
        u.splice(seg + 1, 0, { x: r4(p.x), y: r4(p.y), r: 0 });
      } else {
        var rz = StendPanel.uzly.razrezat(g, t), N = rz.tochka;
        var a = u[g.ia], b = u[g.ib];
        zamorozit(g.ia, 'net'); zamorozit(g.ib, 'net');
        // плечо здесь — контрольная точка минус узел
        a.ho = { x: r4(rz.levyy.c1.x - a.x), y: r4(rz.levyy.c1.y - a.y) };
        b.hi = { x: r4(rz.pravyy.c2.x - b.x), y: r4(rz.pravyy.c2.y - b.y) };
        u.splice(seg + 1, 0, { x: r4(N.x), y: r4(N.y), r: 0, z: 'net',
                               ho: { x: r4(rz.pravyy.c1.x - N.x), y: r4(rz.pravyy.c1.y - N.y) },
                               hi: { x: r4(rz.levyy.c2.x - N.x),  y: r4(rz.levyy.c2.y - N.y) } });
      }
      return seg + 1;
    }
    function ubrat(i) {
      var u = zn().uzly;
      if (u.length <= 2) return i;               // путь короче двух узлов — не путь
      u.splice(Math.min(i, u.length - 1), 1);
      return Math.max(0, i - 1);
    }

    /* ── МОДЕЛЬ ДЛЯ ЯДРА: одна на два холста, разница в области и в том,
       что рисует предмет. Карта показывает и то, что ушло за кромку: поле
       долей занимает не всю карту, вокруг него по 10 %. Слой на макете
       области не рисует — путь там рисует стенд, он и есть предмет; слой
       дорисовывает только хвост за областью, где стенд свой svg обрезает. */
    function model(oblast, risovatPredmet) {
      return {
        oblast: oblast,
        uzly: function () { return zn().uzly; },
        segmenty: function () { return segmenty(zn()); },
        plechi: plechiUzla,
        vid: function (i) { var u = zn().uzly[i]; return (u.r || 0) < 0.02 && !u.ho ? 'ugol' : 'gladkiy'; },
        mozhno: function () { return { dvigat: true, ubrat: zn().uzly.length > 2 }; },
        risovat: risovatPredmet,
        /* ход узла не ограничен: путь имеет право уходить за кромку и
           возвращаться, объект влетает из-за экрана (правка 03.09) */
        dvinut: function (i, x, y) { var u = zn().uzly[i]; u.x = r4(x); u.y = r4(y); },
        tyanutPlecho: tyanutPlecho,
        nachatGnut: nachatGnut,
        gnut: gnut,
        vstavit: vstavit,
        ubrat: ubrat,
        // двойной клик по узлу переключает острый ↔ гладкий
        dvoynoyKlikUzla: function (i) {
          var u = zn().uzly[i];
          if ((u.r || 0) < 0.02 && !u.ho) u.r = 0.5; else { u.r = 0; delete u.ho; delete u.hi; }
        },
        izmenilos: izmenilos
      };
    }
    var OTSTUP = 0.1;                     // поле карты вокруг долей
    var modelKarty = model(
      function () {
        var W = karta.clientWidth || 272, H = karta.clientHeight || 120;
        return { left: OTSTUP * W, top: OTSTUP * H, width: (1 - 2 * OTSTUP) * W, height: (1 - 2 * OTSTUP) * H };
      },
      function (g, kx, ky) {
        // сетка — внутри поля долей; рамка поля показывает, где кончается область
        g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
        for (var i = 1; i < 4; i++) {
          var qx = kx(i / 4), qy = ky(i / 4);
          g.beginPath(); g.moveTo(qx, ky(0)); g.lineTo(qx, ky(1)); g.stroke();
          g.beginPath(); g.moveTo(kx(0), qy); g.lineTo(kx(1), qy); g.stroke();
        }
        g.save();
        g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; g.setLineDash([3, 3]);
        g.strokeRect(kx(0), ky(0), kx(1) - kx(0), ky(1) - ky(0));
        g.restore();
        var put = d(zn(), 1, 1);
        if (put) {
          var m2 = new DOMMatrix().translate(kx(0), ky(0)).scale(kx(1) - kx(0), ky(1) - ky(0));
          var p2 = new Path2D(); p2.addPath(new Path2D(put), m2);
          g.strokeStyle = akcent(); g.lineWidth = 2; g.stroke(p2);
        }
      });
    var rukaKarty = StendPanel.uzly(karta, modelKarty, { accent: akcent, naVybor: vybor });
    rukaKarty.vybrat(vybran);

    /* ── ПРАВКА НА МАКЕТЕ ─────────────────────────────────────────────
       Панель отвечает «по какому закону», холст — «где именно». Траекторию
       нельзя править в миниатюре 272×120: узлы там по три пикселя, попасть
       нечем. Слой ложится поверх стенда и ПОД панелью — как слой мест.
       Область — та же, что у стенда: содержимое, без рамок и полей
       (на области с рамкой узлы сходили с линии на её толщину, 03.09). */
    var sloy = null, rukaSloya = null;
    function oblast() {
      var el = opt.mesto ? document.querySelector(opt.mesto) : null;
      if (!el) return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      /* Прямоугольник области в координатах окна — как getBoundingClientRect,
         без clientWidth/100vw-расхождений со скроллбаром. */
      var r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: Math.max(1, r.width), height: Math.max(1, r.height) };
    }
    var modelSloya = model(oblast, function (g, kx, ky, W, H) {
      /* ХВОСТ ПУТИ ЗА ОБЛАСТЬЮ. Внутри области путь рисует стенд — слой
         молчит, иначе две линии в разных системах координат (ход 34).
         Снаружи стенд обрезает свой svg — слой дорисовывает ровно внешнюю
         часть, приглушённо: за кромкой стенд этого не покажет, а рука
         должна это видеть. */
      var o = oblast(), put = d(zn(), 1, 1);
      if (!put) return;
      g.save();
      g.beginPath(); g.rect(0, 0, W, H); g.rect(o.left, o.top, o.width, o.height); g.clip('evenodd');
      var m2 = new DOMMatrix().translate(kx(0), ky(0)).scale(kx(1) - kx(0), ky(1) - ky(0));
      var p2 = new Path2D(); p2.addPath(new Path2D(put), m2);
      g.setLineDash([5, 4]); g.globalAlpha = .4;
      g.strokeStyle = akcent(); g.lineWidth = 2; g.stroke(p2);
      g.restore();
    });
    function risovatSloy() { if (rukaSloya) rukaSloya.risovat(); }
    function otkryt() {
      if (sloy) { zakryt(); return; }
      sloy = StendPanel.uzly.sloy();
      rukaSloya = StendPanel.uzly(sloy.holst, modelSloya,
        { klavishi: true, naEscape: zakryt, accent: akcent, naVybor: vybor });
      rukaSloya.gnut(rukaKarty.gnut());
      rukaSloya.vybrat(vybran);
      naMakete.setAttribute('aria-pressed', 'true');
      /* Слушатели снимаются вместе со слоем: вешались при каждом открытии
         и не снимались никогда — на скролле работал десяток обходчиков. */
      window.addEventListener('resize', risovatSloy);
      window.addEventListener('scroll', risovatSloy, true);
    }
    function zakryt() {
      if (!sloy) return;
      rukaSloya.zakryt(); sloy.ubrat(); sloy = rukaSloya = null;
      naMakete.setAttribute('aria-pressed', 'false');
      window.removeEventListener('resize', risovatSloy);
      window.removeEventListener('scroll', risovatSloy, true);
    }

    // ── связь: выбор общий, правка идёт в поля и на оба холста ──
    function vybor(i) {
      if (i >= 0) vybran = i;               // поля держат последний выбранный
      if (rukaKarty.vybran() !== i) rukaKarty.vybrat(i);
      if (rukaSloya && rukaSloya.vybran() !== i) rukaSloya.vybrat(i);
      pokazatPolya();
    }
    function risovatVse() { rukaKarty.risovat(); risovatSloy(); }
    function izmenilos() { api.save(); pokazatPolya(); risovatVse(); }
    function vybratUzel(i) { vybran = i; rukaKarty.vybrat(i); if (rukaSloya) rukaSloya.vybrat(i); }

    function pokazatPolya() {
      var v = zn(), u = v.uzly;
      schet.textContent = u.length;
      menshe.disabled = u.length <= 2; menshe.style.opacity = u.length <= 2 ? .4 : 1;
      zamk.setAttribute('aria-pressed', String(!!v.zamknut));
      gnutChip.setAttribute('aria-pressed', String(rukaKarty.gnut()));
      var uz = uzel();
      /* «СКРУГЛЕНИЕ ВСЕХ» ПОКАЗЫВАЕТ ВСЕХ (правка Сергея 03.09): все равны —
         их значение; разные — среднее, и показатель гаснет до вторичного
         цвета, как «смешанное» в Фигме. */
      var odno = odnoSkruglenie();
      nbObsh.obnovit();
      if (document.activeElement !== pokazObsh) pokazObsh.value = (+obshR()).toFixed(2);
      pokazObsh.style.color = odno ? '' : 'var(--st-text-2)';
      pokazBlok.box.title = odno ? '' : 'у узлов разное скругление — показано среднее';
      var rezhim = uz && uz.ho ? 'ruchnoy' : (uz && (uz.r || 0) < 0.02 ? 'ostryy' : 'gladkiy');
      ostr.setAttribute('aria-pressed', String(rezhim === 'ostryy'));
      glad.setAttribute('aria-pressed', String(rezhim === 'gladkiy'));
      ruch.setAttribute('aria-pressed', String(rezhim === 'ruchnoy'));
      var z = (uz && uz.z) || 'ugoldlina';
      zNet.setAttribute('aria-pressed', String(z === 'net'));
      zUgol.setAttribute('aria-pressed', String(z === 'ugol'));
      zOba.setAttribute('aria-pressed', String(z === 'ugoldlina'));
      if (uz && document.activeElement !== pr.inp) {
        pr.inp.value = +(uz.r == null ? .5 : uz.r).toFixed(2);
      }
      pokazatCoord();
    }

    /* Список x/y всех узлов — числом, без зажима в 0…1: путь может уходить
       за кромку. Пересобирается только при смене числа узлов, чтобы не
       срывать фокус во время ввода. */
    function pokazatCoord() {
      var u = zn().uzly;
      if (ryadyCoord.length !== u.length) {
        spisokCoord.textContent = '';
        ryadyCoord = [];
        u.forEach(function (_, i) {
          var ryad = document.createElement('div');
          ryad.className = 'st-put-uzel-ryad';
          var nom = document.createElement('b');
          nom.textContent = String(i + 1);
          nom.title = 'узел ' + (i + 1);
          var fx = StendPanel.poleBlok('x', { imya: 'x узла ' + (i + 1) });
          var fy = StendPanel.poleBlok('y', { imya: 'y узла ' + (i + 1) });
          function zapisat(os) {
            return function () {
              var val = parseFloat(String(os.inp.value).replace(',', '.'));
              if (isNaN(val) || !isFinite(val)) { pokazatPolya(); return; }
              var uz = zn().uzly[i];
              if (!uz) return;
              uz[os.os] = r4(val);
              vybran = i;
              izmenilos();
            };
          }
          [['x', fx], ['y', fy]].forEach(function (par) {
            var os = { os: par[0], inp: par[1].inp };
            var zap = zapisat(os);
            klavishiDoli(par[1].inp, zap);
            par[1].inp.addEventListener('change', zap);
            par[1].inp.addEventListener('keydown', function (ev) {
              if (ev.key === 'Enter') { ev.preventDefault(); zap(); }
            });
            par[1].inp.addEventListener('focus', function () {
              if (vybran !== i) vybor(i);
            });
          });
          ryad.addEventListener('pointerdown', function (e) {
            if (e.target.tagName === 'INPUT') return;
            if (vybran !== i) vybor(i);
          });
          ryad.appendChild(nom);
          ryad.appendChild(fx.box);
          ryad.appendChild(fy.box);
          spisokCoord.appendChild(ryad);
          ryadyCoord.push({ ryad: ryad, px: fx, py: fy });
        });
      }
      var vy = Math.min(vybran, u.length - 1);
      ryadyCoord.forEach(function (r, i) {
        var uz = u[i];
        if (!uz) return;
        r.ryad.classList.toggle('vybran', i === vy);
        if (document.activeElement !== r.px.inp) r.px.inp.value = +(+uz.x).toFixed(3);
        if (document.activeElement !== r.py.inp) r.py.inp.value = +(+uz.y).toFixed(3);
      });
    }

    // ── органы панели ──
    /* «+» ставит узел посередине САМОГО ДЛИННОГО сегмента — на путь, а не за
       кромку (правка 03.09); садится тем же законом, что двойной клик. */
    bolshe.addEventListener('click', function () {
      var segs = segmenty(zn()), luchshiy = 0, dlinnee = -1;
      segs.forEach(function (g, i) {
        var dx = g.b.x - g.a.x, dy = g.b.y - g.a.y, dl = dx * dx + dy * dy;
        if (dl > dlinnee) { dlinnee = dl; luchshiy = i; }
      });
      if (!segs.length) return;
      vybratUzel(vstavit(luchshiy, 0.5, vTochke(segs[luchshiy], 0.5)));
      izmenilos();
    });
    menshe.addEventListener('click', function () {
      if (zn().uzly.length <= 2) return;
      vybratUzel(ubrat(Math.min(vybran, zn().uzly.length - 1)));
      izmenilos();
    });
    zamk.addEventListener('click', function () { zn().zamknut = !zn().zamknut; izmenilos(); });
    gnutChip.addEventListener('click', function () {
      var da = !rukaKarty.gnut();
      rukaKarty.gnut(da); if (rukaSloya) rukaSloya.gnut(da);
      pokazatPolya();
    });
    ostr.addEventListener('click', function () { var u = uzel(); u.r = 0; delete u.ho; delete u.hi; izmenilos(); });
    glad.addEventListener('click', function () { var u = uzel(); u.r = 0.5; delete u.ho; delete u.hi; izmenilos(); });
    ruch.addEventListener('click', function () {
      // ручной узел рождается из закона: плечи берут текущую форму и застывают
      var i = zn().uzly.indexOf(uzel());
      zamorozit(i, 'ugoldlina');
      var u = zn().uzly[i];
      if (!u.ho) u.ho = { x: .05, y: 0 };
      if (!u.hi) u.hi = { x: -.05, y: 0 };
      izmenilos();
    });
    [[zNet, 'net'], [zUgol, 'ugol'], [zOba, 'ugoldlina']].forEach(function (par) {
      par[0].addEventListener('click', function () {
        var i = zn().uzly.indexOf(uzel()), u = zn().uzly[i];
        // у узла, живущего законом, плечи сперва застывают — иначе режим
        // некуда приложить и кнопка молчит
        zamorozit(i, par[1]);
        u.z = par[1];
        if (par[1] !== 'net' && u.ho) {
          // связали обратно: второе плечо возвращается на общую прямую
          var dl = par[1] === 'ugoldlina'
            ? Math.hypot(u.ho.x, u.ho.y)
            : (u.hi ? Math.hypot(u.hi.x, u.hi.y) : 0) || 0.05;
          var m = Math.hypot(u.ho.x, u.ho.y) || 1;
          u.hi = { x: r4(-u.ho.x / m * dl), y: r4(-u.ho.y / m * dl) };
        }
        izmenilos();
      });
    });
    pokazObsh.addEventListener('change', function () {
      var v = parseFloat(pokazObsh.value.replace(',', '.'));
      if (isNaN(v)) { pokazatPolya(); return; }
      v = Math.max(0, Math.min(1, v));
      zn().uzly.forEach(function (u) { u.r = v; delete u.ho; delete u.hi; });
      izmenilos();
    });
    pr.inp.addEventListener('change', function () {
      var v = parseFloat(pr.inp.value.replace(',', '.'));
      if (isNaN(v)) { pokazatPolya(); return; }
      var u = uzel();
      u.r = Math.max(0, Math.min(1, v));
      delete u.ho; delete u.hi;
      izmenilos();
    });

    naMakete.addEventListener('click', otkryt);
    // панель закрылась — слой правки уходит с ней: он её продолжение
    document.addEventListener('stend:panel-zakryta', zakryt);

    row.appendChild(box);
    api.controls[key] = function () { pokazatPolya(); risovatVse(); };
    if (window.ResizeObserver) new ResizeObserver(function () { rukaKarty.risovat(); }).observe(karta);
    pokazatPolya(); risovatVse();
  });

  // стенду: путь строкой и точка на пути
  StendPanel.put = { d: d, tochka: tochka, segmenty: segmenty, blizhe: blizhe };
})();

