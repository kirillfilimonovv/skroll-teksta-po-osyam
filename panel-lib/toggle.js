/* © Сергей Гуров · Михаил Матвеев · Александр Копинов, 2026 · панель стендов · метод «Основа» · stendy.vercel.app */
/* Глагольный тумблер — подпись говорит действие, а не состояние.
   Приём снят со стенда «7 сеток» (Миша, 2026-08): «Скрыть сетку» ⇄ «Показать сетку».
   Обычный чекбокс заставляет читать состояние и достраивать вывод; глагол
   называет то, что произойдёт по нажатию, — читается без домысливания.
   Объявление:  ['setkaVidna', '', 'toggle', ['Показать сетку', 'Скрыть сетку']]
                (первая подпись — когда значение ложно, вторая — когда истинно)   */
(function () {
  var STIL = '.st-toggle{all:unset;width:100%;padding:6px 9px;box-sizing:border-box;' +
    'font:12px/1.2 var(--st-font);color:var(--st-text);cursor:pointer;text-align:left;' +
    'background:var(--st-card);border:0.5px solid var(--st-hairline);border-radius:7px;' +
    'transition:background .12s}' +
    '.st-toggle:hover{background:var(--st-border)}' +
    '.st-toggle[aria-pressed="true"]{border-color:var(--st-accent)}' +
    '.row:has(>.st-toggle)>label{display:none}';

  StendPanel.tip('toggle', function (row, d, P, api) {
    if (!document.getElementById('st-toggle-css')) {
      var s = document.createElement('style'); s.id = 'st-toggle-css';
      s.textContent = STIL; document.head.appendChild(s);
    }
    var podpisi = d[3] || ['Включить', 'Выключить'];
    var b = document.createElement('button');
    b.className = 'st-toggle';
    function narisovat() {
      b.textContent = podpisi[P[d[0]] ? 1 : 0];
      b.setAttribute('aria-pressed', String(!!P[d[0]]));
    }
    b.addEventListener('click', function () {
      P[d[0]] = !P[d[0]];
      narisovat(); api.save();
      if (d[4] && d[4].onChange) d[4].onChange(P[d[0]]);
    });
    narisovat();
    api.controls[d[0]] = narisovat;
    row.appendChild(b);
  });
})();
