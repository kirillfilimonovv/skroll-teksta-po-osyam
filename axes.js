(() => {
  'use strict';
  const main = document.querySelector('main');
  const key = 'diagonal-longread-trajectories-v2';
  const copy = value => JSON.parse(JSON.stringify(value));
  const fonts = ["PT Mono"];
  const defaults = {
    body: {uzly: [
      {x:-0.912,y:0.1987,r:0,z:'net'},
      {x:1.2823,y:0.846,r:0,z:'ugoldlina'}
    ],zamknut:false},
    headings: {uzly: [
      {x:-0.058,y:0.0784,r:0.94,z:'net',ho:{x:1.0046,y:0.3882},hi:{x:0.9963,y:0.3916}},
      {x:-0.0137,y:0.9817,r:0,z:'net',ho:{x:1.0598,y:-0.5761},hi:{x:1.0483,y:-0.5785}}
    ],zamknut:true},
    guides:true, font:'PT Mono', size:18, textColor:'#ffffff', backgroundColor:'#2b2b2b',
    gradient:true, gradientStart:'#b78255', gradientEnd:'#366792', gradientAngle:214,
    vignetteColor:'#ffffff', vignetteStrength:100, backgroundBlur:100};
  const params = copy(defaults);
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    for (const group of ['body','headings']) {
      if (saved?.[group]?.uzly?.length >= 2 && saved[group].uzly.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) params[group] = saved[group];
    }
    if (typeof saved?.guides === 'boolean') params.guides = saved.guides;
    for (const name of ['font','size','textColor','backgroundColor','gradient','gradientStart','gradientEnd','gradientAngle','vignetteColor','vignetteStrength','backgroundBlur']) {
      if (typeof saved?.[name] === typeof defaults[name]) params[name] = saved[name];
    }
  } catch (_) {}
  // Keep semantic paragraphs and inline markup; each sentence moves on its own.
  const segmenter = new Intl.Segmenter('ru', {granularity:'sentence'});
  let fragmentIndex = 0;
  for (const block of main.querySelectorAll('p, h1, h2, li, .number')) {
    const text = block.textContent;
    if (!text.trim()) continue;
    // Initials and titles are not sentence endings. Mask only for segmentation,
    // keeping UTF-16 offsets identical to the original text.
    const masked = text
      .replace(/тер\.(?=\s)/g, 'тер\u00b7')
      .replace(/\b(?:Mr|Mrs|Ms|Dr)\./g, match => match.slice(0,-1)+'\u00b7')
      .replace(/\b([A-Z])\.(?=\s+[A-Z])/g, '$1\u00b7')
      .replace(/([А-ЯЁ])\.(?=\s+[А-ЯЁ])/g, '$1\u00b7');
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const nodes = []; let node, offset = 0;
    while ((node = walker.nextNode())) {
      nodes.push({node, start:offset, end:offset+node.length}); offset += node.length;
    }
    const content = document.createDocumentFragment();
    for (const {index,segment} of segmenter.segment(masked)) {
      const end = index+segment.length;
      const first = nodes.find(item => item.end > index);
      const last = nodes.find(item => item.end >= end);
      if (!first || !last) continue;
      const range = document.createRange();
      range.setStart(first.node,index-first.start); range.setEnd(last.node,end-last.start);
      const fragment = document.createElement('span');
      fragment.className = 'sentence-fragment';
      fragment.dataset.fragment = String(++fragmentIndex);
      fragment.append(range.cloneContents());
      content.append(fragment);
    }
    block.replaceChildren(content);
  }
  const groups = [
    {key: 'headings', color:'#245be0', selector:'main header .sentence-fragment, main h2 .sentence-fragment, main .number .sentence-fragment'},
    {key: 'body', color:'#b24e24', selector:'main article p > .sentence-fragment, main article li > .sentence-fragment'}
  ];
  const members = groups.flatMap(group => [...document.querySelectorAll(group.selector)].map(el => {
    el.classList.add('axis-member');
    el.style.setProperty('--axis-color',group.color);
    el.dataset.axis = group.key;
    return {el, group:group.key, top:0};
  }));
  let curves = {}, left = 0, frame = 0;
  function xAtY(points,y) {
    for (let i=1; i<points.length; i++) {
      const a=points[i-1], b=points[i];
      if (y>=Math.min(a.y,b.y) && y<=Math.max(a.y,b.y) && a.y!==b.y) return a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y);
    }
    return points.reduce((a,b) => Math.abs(a.y-y)<Math.abs(b.y-y)?a:b).x;
  }
  function render() {
    frame=0;
    members.forEach(item => {
      const y=(item.top-scrollY)/innerHeight;
      item.el.style.setProperty('--axis-x', (xAtY(curves[item.group],y)*innerWidth-left)+'px');
    });
  }
  function schedule() { if (!frame) frame=requestAnimationFrame(render); }
  let appliedFont = '';
  function applyAppearance() {
    const style = document.documentElement.style;
    const color = (value,fallback) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    const number = (value,min,max,fallback) => Number.isFinite(+value) ? Math.min(max,Math.max(min,+value)) : fallback;
    const font = fonts.includes(params.font) ? params.font : 'PT Mono';
    style.setProperty('--reading-font', '"'+font+'"');
    style.setProperty('--reading-size', number(params.size,12,72,18)+'px');
    style.setProperty('--text-color',color(params.textColor,'#111111'));
    style.setProperty('--background-color',color(params.backgroundColor,'#ffffff'));
    style.setProperty('--background-gradient',params.gradient ? 'linear-gradient('+number(params.gradientAngle,0,360,135)+'deg,'+color(params.gradientStart,'#fff1eb')+','+color(params.gradientEnd,'#ace0f9')+')' : 'none');
    style.setProperty('--vignette-color',color(params.vignetteColor,'#000000'));
    style.setProperty('--vignette-strength',number(params.vignetteStrength,0,100,0)/100);
    style.setProperty('--background-blur',number(params.backgroundBlur,0,100,0)+'px');
    if (font !== appliedFont) {
      appliedFont = font;
      document.fonts.load('18px "'+font+'"','Эволюция сеток').then(measure).catch(()=>{});
    }
  }
  function update() {
    for (const group of groups) {
      const value=params[group.key];
      curves[group.key]=Array.from({length:401},(_,i)=>StendPanel.put.tochka(value,i/400,1,1));
    }
    document.body.classList.toggle('axes-hidden',!params.guides);
    schedule();
  }
  function measure() {
    left=main.getBoundingClientRect().left;
    members.forEach(item=>{item.top=item.el.getBoundingClientRect().top+scrollY;});
    document.documentElement.style.setProperty('--axis-ratio',innerWidth+'/'+innerHeight);
    update();
  }
  const panel=StendPanel.build({
    storageKey:key, params, defaults,
    defs:[
      ['h','Шрифт'],
      ['font','Гарнитура','select',fonts.map(font=>[font,font])],
      ['size','Кегль, px',12,72,1],
      ['h','Цвет'],
      ['textColor','Текст','color'],
      ['backgroundColor','Фон','color'],
      ['h','Эффекты фона'],
      ['gradient','','toggle',['Включить градиент','Выключить градиент']],
      ['gradientStart','Градиент · первый цвет','color'],
      ['gradientEnd','Градиент · второй цвет','color'],
      ['gradientAngle','Угол градиента, °',0,360,1],
      ['vignetteColor','Виньетка · цвет','color'],
      ['vignetteStrength','Виньетка, %',0,100,1],
      ['backgroundBlur','Блюр фона, px',0,100,1],
      ['h','Оси фрагментов'],
      ['body','Основной текст и врезки','traektoriya',{mesto:'#axis-stage'}],
      ['headings','Заголовки и нумерация','traektoriya',{mesto:'#axis-stage'}],
      ['guides','','toggle',['Показать метки фрагментов','Скрыть метки фрагментов']]
    ],
    desc:{body:'Один фрагмент — одно предложение. Перетаскивайте узлы и плечи Безье: каждое предложение следует траектории отдельно.',
      headings:'Отдельная траектория для заголовков и номеров. Изменения видны сразу.'},
    onChange:()=>{applyAppearance();measure();}
  });
  panel.pokazat(true);
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',()=>{
    panel.obnovit(); measure();
  });
  applyAppearance();
  document.fonts.addEventListener('loadingdone',measure);
  document.fonts.ready.then(measure);
  measure();
})();
