/* © Сергей Гуров · Михаил Матвеев · Александр Копинов, 2026 · панель стендов · метод «Основа» · stendy.vercel.app */
/* УЗЛЫ ПОД РУКОЙ — общие руки редакторов кривых.

   ЗАКОН. Редакторов кривых в библиотеке было три, и каждый рисовал руки
   заново: траектория (путь на плоскости), ось диагонали (функция высоты),
   изинг панели (одна дуга с прибитыми концами). Предметы у них разные —
   модель, закон касательных, свобода хода, — а руки одни: взять узел,
   плечо или саму линию, потянуть, поставить узел двойным кликом, убрать
   крестиком или клавишей. Ядро держит руки; предмет остаётся у органа.
   Сводятся руки, не предметы (решение Сергея 04.09, ход 58).

   РАЗДЕЛЕНИЕ. Ядро знает узлы, плечи и сегменты только как точки в долях
   ОБЛАСТИ — прямоугольника внутри холста, где живут доли 0…1. Что вокруг
   области (поля карты, выбег холста оси, экран под слоем правки) — ядру
   всё равно: за кромкой видно то, что ушло, и рука его достаёт. Откуда
   берутся плечи — из закона скругления или из явных усиков — ядро не
   знает: спрашивает модель. Как узел ходит — свободно или только вперёд
   по высоте — ядро не знает: отдаёт модели доли, модель зажимает.

   МОДЕЛЬ — то, что орган передаёт ядру:
     oblast()            → { left, top, width, height } в px холста
     uzly()              → [{ x, y }] в долях области
     segmenty()          → [{ a, b, c1, c2, ia, ib }] кубические, в долях;
                           ia, ib — индексы узлов на концах
     plechi(i)           → { ho, hi, ruchnoy } — точки плеч в долях;
                           null — у узла плеч не показывать
     vid(i)              → 'ugol' | 'gladkiy'          (необязательно; круг)
     mozhno(i)           → { dvigat, ubrat }
     risovat(g, px, py, W, H) — предмет: фон, линии, соседи; оснастку рисует ядро
     dvinut(i, x, y, e)  — узел в доли; модель зажимает, как знает
     tyanutPlecho(i, kakoe, x, y, alt)
     nachatGnut(seg, t, x, y) → снимок;   gnut(snimok, x, y)
     vstavit(seg, t, p)  — узел на кривой; вернуть индекс нового
     ubrat(i)            — вернуть новый выбранный индекс (или ничего)
     klikUzla(i)         — клик по узлу без хода при «гнуть» (необязательно)
     tyagaIzUzla(i,x,y)  — тяга из узла при «гнуть» (необязательно; нет — узел ездит)
     dvoynoyKlikUzla(i)  (необязательно)
     izmenilos()         — сохранить и обновить всё, что смотрит на модель,
                           КРОМЕ этого холста: его ядро перерисует само

   ЖЕСТЫ — одни на все редакторы, сняты с Фигмы и Иллюстратора (ходы 34–47):
     тяга узла               — двигает узел (вне «гнуть»)
     тяга плеча              — гнёт кривую в узле; Alt рвёт зеркальность
     тяга за линию           — при «гнуть»: гнёт участок между узлами
     тяга из узла            — при «гнуть»: модель решает (ось тянет усики)
     клик по узлу без хода   — при «гнуть»: модель решает (ось снимает усики)
     двойной клик по линии   — новый узел ровно на кривой
     двойной клик по узлу    — модель решает (путь: острый ↔ гладкий)
     ✕ у выбранного, Delete  — убрать узел;  Esc — отдать наружу (naEscape)
   Форму меняет только ход руки: нажатие ждёт порога в 3 px (ход 47).
   Четыре правила, на которых редакторы 03.09 разошлись, сведены Сергеем
   04.09 (Г10): плечи видны у каждого узла; плечо острого — на отлёте;
   новый узел садится разрезом; линия гнётся только при «гнуть».
   Инструмент «гнуть» — по принципу Фигмы (ход 44): пока он выключен,
   линия держит форму, рука не заденет её случайно.

   АЛФАВИТ ОСНАСТКИ — одна цель на всё: 22 по Г8 и П18, та же, что у
   рукояток изинга в ядре. Отлёт плеча равен цели: короче — не взяться.
   Крестик стоит за отлётом на свой диаметр — не налезает на ромбик.
   Ромбик залитый — плечо ручное; полый — выведено законом.

   Вызов:
     var ruka = StendPanel.uzly(holst, model, { klavishi, naEscape, naVybor, accent });
     ruka.risovat(); ruka.vybran(); ruka.vybrat(i); ruka.gnut(da); ruka.zakryt();
   Геометрия для моделей: StendPanel.uzly.naSegmente(g, t), .razrezat(g, t).
   Слой правки на экране: StendPanel.uzly.sloy(z) → { holst, ubrat }.

   Ядро — блок, не орган: типа величины не приносит, панелью не строится.
   Изинг панели на ядро пока не переведён (хвост). */
(function () {
  var CEL = 22;                        // цель захвата: узел, плечо, крестик (Г8, П18)
  var R_CEL = CEL / 2;
  var TOLSCHINA = 3;                   // толщина линии предмета — цель линии считает от неё
  var CEL_LINIYA = R_CEL + TOLSCHINA;  // взять линию: полцели плюс её толщина
  var OTLYOT = CEL;                    // плечо короче цели уводится на цель — иначе не взяться
  var POROG = 3;                       // ход короче — клик, не тяга
  var R_UZEL = 6, R_ROMB = 6;          // рисунок; цель шире рисунка — см. CEL
  var R_KREST = R_CEL;
  var TISHE = .28;                     // плечи чужих узлов

  // ── геометрия, общая для моделей ──
  function naSegmente(g, t) {          // точка на кубическом сегменте
    var u = 1 - t;
    return { x: u * u * u * g.a.x + 3 * u * u * t * g.c1.x + 3 * u * t * t * g.c2.x + t * t * t * g.b.x,
             y: u * u * u * g.a.y + 3 * u * u * t * g.c1.y + 3 * u * t * t * g.c2.y + t * t * t * g.b.y };
  }
  /* Разрез по де Кастельжо: точка садится на линию и не меняет её формы.
     Возвращает новую точку и КОНТРОЛЬНЫЕ ТОЧКИ двух новых сегментов —
     не смещения: у траектории плечо есть «контрольная минус узел», у оси —
     «узел минус контрольная», и ядро не навязывает соглашения (поймано
     сверкой форм 04.09: 0.0105 доли расхождения от перепутанного знака).
     У соседей меняется только половина, смотрящая в разрез. */
  function razrezat(g, t) {
    function mezh(p, q) { return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }; }
    var Q1 = mezh(g.a, g.c1), M = mezh(g.c1, g.c2), R2 = mezh(g.c2, g.b);
    var Q2 = mezh(Q1, M), R1 = mezh(M, R2), N = mezh(Q2, R1);
    return { tochka: N,
             levyy:  { c1: Q1, c2: Q2 },     // a → N
             pravyy: { c1: R1, c2: R2 } };   // N → b
  }

  function uzly(holst, model, opt) {
    opt = opt || {};
    var vybran = -1, GNEM = false, krest = null;
    var tyanet = null;                 // { vid, i, kakoe, seg, t, snimok, x0, y0, hodil }
    var dpr = 1;
    holst.style.touchAction = 'none';
    holst.style.cursor = 'crosshair';

    // ── размер и координаты ──
    function razmer() {
      var W = holst.clientWidth || holst.width, H = holst.clientHeight || holst.height;
      dpr = window.devicePixelRatio || 1;
      var bw = Math.round(W * dpr), bh = Math.round(H * dpr);
      if (holst.width !== bw || holst.height !== bh) { holst.width = bw; holst.height = bh; }
      return { W: W, H: H };
    }
    function sist() {                  // система долей области — на один жест или кадр
      var o = model.oblast();
      return { o: o,
               px: function (x) { return o.left + x * o.width; },
               py: function (y) { return o.top + y * o.height; },
               doli: function (c) { return { x: (c.x - o.left) / o.width, y: (c.y - o.top) / o.height }; } };
    }
    /* Указатель в px холста. Панель бывает под transform: scale (анимация
       появления), и прямоугольник холста на экране меньше его размера —
       берём отношение, иначе координаты врут на масштаб. */
    function kursor(e) {
      var r = holst.getBoundingClientRect();
      var W = holst.clientWidth || r.width, H = holst.clientHeight || r.height;
      return { x: (e.clientX - r.left) * (W / (r.width || 1)),
               y: (e.clientY - r.top) * (H / (r.height || 1)) };
    }
    function akcent() { return (opt.accent && opt.accent()) || '#0A84FF'; }

    /* Плечо с отлётом. Плечо, выведенное из короткого участка или из
       нулевого скругления, бывает короче ромбика: математика верна, а
       взяться не за что. Такое плечо показывается на минимальном отлёте
       вдоль своего направления, а схлопнутое — вдоль хорды к соседу.
       Модель не трогается: отлёт живёт только в показе и в цели. */
    function tochkaPlecha(s, i, kakoe, pl) {
      var p = pl[kakoe]; if (!p) return null;
      var uz = model.uzly()[i];
      var ux = s.px(uz.x), uy = s.py(uz.y), x = s.px(p.x), y = s.py(p.y);
      var dx = x - ux, dy = y - uy, dl = Math.hypot(dx, dy);
      if (dl >= OTLYOT) return { x: x, y: y, svoy: true };
      if (dl < .5) {
        var sosed = null;
        model.segmenty().forEach(function (g) {
          if (kakoe === 'ho' && g.ia === i) sosed = g.b;
          if (kakoe === 'hi' && g.ib === i) sosed = g.a;
        });
        if (sosed) { dx = s.px(sosed.x) - ux; dy = s.py(sosed.y) - uy; dl = Math.hypot(dx, dy); }
        if (dl < .5) { dx = 0; dy = kakoe === 'ho' ? OTLYOT : -OTLYOT; dl = OTLYOT; }
      }
      return { x: ux + dx / dl * OTLYOT, y: uy + dy / dl * OTLYOT, svoy: false };
    }

    // ── оснастка ──
    function romb(g, x, y, ruchnoy, ac) {
      var r = R_ROMB;
      g.beginPath();
      g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
      g.fillStyle = ruchnoy ? ac : '#101012'; g.fill();
      g.lineWidth = 1.5; g.strokeStyle = ruchnoy ? '#fff' : ac; g.stroke();
    }
    function risovat() {
      var d = razmer(), W = d.W, H = d.H;
      var g = holst.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      var s = sist(), ac = akcent();
      model.risovat(g, s.px, s.py, W, H);
      var u = model.uzly();
      // плечи: у выбранного в полную силу, у остальных — что модель отдаст, тише
      u.forEach(function (uz, i) {
        var pl = model.plechi(i); if (!pl) return;
        var ux = s.px(uz.x), uy = s.py(uz.y);
        g.save(); g.globalAlpha = i === vybran ? 1 : TISHE;
        ['hi', 'ho'].forEach(function (kk) {
          var p = tochkaPlecha(s, i, kk, pl); if (!p) return;
          g.strokeStyle = ac; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(ux, uy); g.lineTo(p.x, p.y); g.stroke();
          romb(g, p.x, p.y, pl.ruchnoy, ac);
        });
        g.restore();
      });
      // узлы: круг — гладкий, квадрат — угол; выбранный крупнее и белее
      u.forEach(function (uz, i) {
        var x = s.px(uz.x), y = s.py(uz.y), svoy = i === vybran;
        var vid = model.vid ? model.vid(i) : 'gladkiy';
        var r = svoy ? R_UZEL + 1 : R_UZEL;
        g.beginPath();
        if (vid === 'ugol') g.rect(x - r, y - r, 2 * r, 2 * r);
        else g.arc(x, y, r, 0, Math.PI * 2);
        g.fillStyle = svoy ? '#fff' : 'rgba(255,255,255,.75)'; g.fill();
        g.lineWidth = 2; g.strokeStyle = ac; g.stroke();
      });
      // ✕ у выбранного — за отлётом плеча на свой диаметр, по диагонали вверх-вправо
      krest = null;
      if (vybran >= 0 && vybran < u.length && model.mozhno(vybran).ubrat) {
        var k = (OTLYOT + 2 * R_KREST) / Math.SQRT2, sh = R_KREST / 3;
        var kx = s.px(u[vybran].x) + k, ky = s.py(u[vybran].y) - k;
        krest = { x: kx, y: ky };
        g.beginPath(); g.arc(kx, ky, R_KREST, 0, Math.PI * 2);
        g.fillStyle = '#1c1c20'; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = ac; g.stroke();
        g.beginPath();
        g.moveTo(kx - sh, ky - sh); g.lineTo(kx + sh, ky + sh);
        g.moveTo(kx + sh, ky - sh); g.lineTo(kx - sh, ky + sh);
        g.lineWidth = 1.6; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.stroke();
      }
    }

    // ── попадание ──
    function blizhUzel(c, s) {
      var u = model.uzly(), luchshe = -1, dm = Infinity;
      u.forEach(function (uz, i) {
        var d = Math.hypot(s.px(uz.x) - c.x, s.py(uz.y) - c.y);
        if (d < dm) { dm = d; luchshe = i; }
      });
      return { i: luchshe, d: dm };
    }
    function plechoPod(c, s) {         // ловятся только плечи выбранного — как в Фигме
      if (vybran < 0 || vybran >= model.uzly().length) return null;
      var pl = model.plechi(vybran); if (!pl) return null;
      var luchshe = null, dm = Infinity;
      ['ho', 'hi'].forEach(function (kk) {
        var p = tochkaPlecha(s, vybran, kk, pl); if (!p) return;
        var d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < dm) { dm = d; luchshe = kk; }
      });
      return luchshe && dm <= R_CEL ? { kakoe: luchshe, d: dm } : null;
    }
    /* Ближайшее место на линии: грубый перебор по сегментам, потом
       уточнение шагом вдвое — узел двойным кликом должен сесть на кривую,
       а не рядом с ней. */
    function liniyaPod(c, s) {
      var segs = model.segmenty(), luchshe = null;
      function proba(si, t) {
        var p = naSegmente(segs[si], t);
        var d = Math.hypot(s.px(p.x) - c.x, s.py(p.y) - c.y);
        if (!luchshe || d < luchshe.d) luchshe = { d: d, seg: si, t: t, p: p };
      }
      for (var si = 0; si < segs.length; si++) for (var j = 0; j <= 24; j++) proba(si, j / 24);
      if (!luchshe) return null;
      for (var shag = 1 / 48; shag > 1 / 2048; shag /= 2) {
        var si2 = luchshe.seg, t0 = luchshe.t;
        proba(si2, Math.max(0, t0 - shag)); proba(si2, Math.min(1, t0 + shag));
      }
      return luchshe;
    }

    // ── жесты ──
    function pointerdown(e) {
      var c = kursor(e), s = sist();
      if (krest && Math.hypot(c.x - krest.x, c.y - krest.y) <= R_CEL + 2) {
        e.preventDefault(); ubratVybran(); return;
      }
      var pl = plechoPod(c, s), uz = blizhUzel(c, s);
      /* Узел главнее плеча, когда оба под рукой и узел не дальше: на
         панельном холсте плечо короче руки, ромбик садится почти на узел,
         и клик по узлу уходил в тягу плеча (правка 03.09). */
      if (pl && uz.d <= R_CEL && uz.d <= pl.d) pl = null;
      if (pl) {
        tyanet = { vid: 'plecho', i: vybran, kakoe: pl.kakoe };
      } else if (uz.i >= 0 && uz.d <= R_CEL) {
        vybran = uz.i;
        if (GNEM && model.tyagaIzUzla) tyanet = { vid: 'izUzla', i: uz.i };
        else if (model.mozhno(uz.i).dvigat) tyanet = { vid: 'uzel', i: uz.i };
        else tyanet = { vid: 'stoit', i: uz.i };
      } else {
        var l = liniyaPod(c, s);
        if (GNEM && l && l.d <= CEL_LINIYA) {
          var d0 = s.doli(c);
          vybran = model.segmenty()[l.seg].ia;
          // снимок — до всякой правки; сама правка ждёт хода руки
          tyanet = { vid: 'liniya', seg: l.seg, t: l.t,
                     snimok: model.nachatGnut(l.seg, l.t, d0.x, d0.y) };
        } else {
          vybran = -1; risovat();            // пусто — снять выбор
          if (opt.naVybor) opt.naVybor(vybran);
          return;
        }
      }
      tyanet.x0 = c.x; tyanet.y0 = c.y; tyanet.hodil = false;
      try { holst.setPointerCapture(e.pointerId); } catch (x) {}
      e.preventDefault();
      risovat();
      if (opt.naVybor) opt.naVybor(vybran);
    }
    function pointermove(e) {
      var c = kursor(e);
      if (!tyanet) {
        var s0 = sist(), l0 = GNEM ? liniyaPod(c, s0) : null;
        holst.style.cursor = (l0 && l0.d <= CEL_LINIYA) ? 'grab' : 'crosshair';
        return;
      }
      if (!tyanet.hodil && Math.hypot(c.x - tyanet.x0, c.y - tyanet.y0) <= POROG) return;
      tyanet.hodil = true;
      var s = sist(), d = s.doli(c);
      if (tyanet.vid === 'uzel') model.dvinut(tyanet.i, d.x, d.y, e);
      else if (tyanet.vid === 'plecho') model.tyanutPlecho(tyanet.i, tyanet.kakoe, d.x, d.y, !!e.altKey);
      else if (tyanet.vid === 'izUzla') model.tyagaIzUzla(tyanet.i, d.x, d.y);
      else if (tyanet.vid === 'liniya') model.gnut(tyanet.snimok, d.x, d.y);
      else return;
      model.izmenilos(); risovat();
    }
    function pointerup() {
      // нажатие без хода — клик; при «гнуть» модель решает, что он значит
      if (tyanet && !tyanet.hodil && GNEM && model.klikUzla &&
          (tyanet.vid === 'izUzla' || tyanet.vid === 'uzel' || tyanet.vid === 'stoit')) {
        model.klikUzla(tyanet.i); model.izmenilos(); risovat();
      }
      tyanet = null; holst.style.cursor = 'crosshair';
    }
    function dblclick(e) {
      var c = kursor(e), s = sist(), uz = blizhUzel(c, s);
      if (uz.i >= 0 && uz.d <= R_CEL) {
        if (model.dvoynoyKlikUzla) { model.dvoynoyKlikUzla(uz.i); model.izmenilos(); risovat(); }
        return;
      }
      var l = liniyaPod(c, s);
      if (!l || l.d > CEL) return;         // мимо кривой — не плодим узлы
      var i = model.vstavit(l.seg, l.t, l.p);
      if (i != null) vybran = i;
      model.izmenilos(); risovat();
      if (opt.naVybor) opt.naVybor(vybran);
    }
    function ubratVybran() {
      if (vybran < 0 || vybran >= model.uzly().length || !model.mozhno(vybran).ubrat) return;
      var n = model.ubrat(vybran);
      vybran = n == null ? -1 : n;
      model.izmenilos(); risovat();
      if (opt.naVybor) opt.naVybor(vybran);
    }
    function klavisha(e) {
      if (e.key === 'Escape') { if (opt.naEscape) opt.naEscape(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        var a = document.activeElement;
        if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;   // правят число, не узел
        ubratVybran(); e.preventDefault();
      }
    }

    holst.addEventListener('pointerdown', pointerdown);
    holst.addEventListener('pointermove', pointermove);
    holst.addEventListener('pointerup', pointerup);
    holst.addEventListener('pointercancel', pointerup);
    holst.addEventListener('dblclick', dblclick);
    if (opt.klavishi) document.addEventListener('keydown', klavisha);

    function zakryt() {
      holst.removeEventListener('pointerdown', pointerdown);
      holst.removeEventListener('pointermove', pointermove);
      holst.removeEventListener('pointerup', pointerup);
      holst.removeEventListener('pointercancel', pointerup);
      holst.removeEventListener('dblclick', dblclick);
      document.removeEventListener('keydown', klavisha);
      tyanet = null;
    }

    return {
      risovat: risovat,
      vybran: function () { return vybran; },
      vybrat: function (i) { vybran = i; risovat(); },
      snyat: function () { vybran = -1; risovat(); },
      gnut: function (da) { if (da !== undefined) { GNEM = !!da; risovat(); } return GNEM; },
      ubrat: ubratVybran,
      zakryt: zakryt,
      holst: holst,
      // для проверок: где нарисованы плечи узла — длины в px холста
      plechi: function (i) {
        var s = sist(), pl = model.plechi(i), uz = model.uzly()[i];
        if (!pl || !uz) return null;
        var ux = s.px(uz.x), uy = s.py(uz.y), out = {};
        ['ho', 'hi'].forEach(function (kk) {
          var p = tochkaPlecha(s, i, kk, pl);
          out[kk] = p ? Math.round(Math.hypot(p.x - ux, p.y - uy)) : null;
        });
        return out;
      }
    };
  }

  /* Слой правки на экране: холст во всё окно, поверх стенда и под панелью.
     Область в нём задаёт модель через oblast() — прямоугольник стенда в
     координатах окна и есть область холста, потому что холст стоит в нуле. */
  uzly.sloy = function (z) {
    var el = document.createElement('canvas');
    el.className = 'st-uzly-sloy';
    el.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:' +
      (z != null ? z : (parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--st-z') || 2147483000, 10) - 2)) + ';touch-action:none';
    document.body.appendChild(el);
    return { holst: el, ubrat: function () { el.remove(); } };
  };

  uzly.naSegmente = naSegmente;
  uzly.razrezat = razrezat;
  uzly.CEL = CEL;
  StendPanel.uzly = uzly;
})();

