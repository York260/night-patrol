/*
 * 夜巡守則 — 遊戲引擎
 *
 * 流程：標題 → 每一夜（開場 → 23:00～05:00 每小時選地點 → 06:00 下班 → 結算）→ 結局
 * 內容全部來自 content.js；這裡只處理狀態、規則判定與畫面。
 */
(() => {
  'use strict';

  const C = window.NP_CONTENT;
  const A = window.NPAudio;

  const HOURS = [22, 23, 0, 1, 2, 3, 4, 5, 6];
  const HI_LOCK = 5; // 03:00
  const HI_SEVENTH = 7; // 05:00
  const HI_END = 8; // 06:00
  const BAT_MAX = 4;
  const SAN_MAX = 100;
  const NIGHT_SAN_RECOVERY = 25;
  const REST_SAN = 10;
  const DARK_SAN = -15;
  const SCARE_SAN = -3;
  const SCARE_CHANCE = 0.25;
  const CHECKPOINTS = ['2F', '3F', '5F', '6F', 'B1'];
  const NIGHT_NAMES = { 1: '第一夜', 2: '第二夜', 3: '第三夜' };
  const KEYS = { save: 'np-save-v1', endings: 'np-endings-v1', mute: 'np-mute-v1' };
  const MARKS = ['', 'trust', 'doubt'];
  const MARK_GLYPH = { '': '○', trust: '✓', doubt: '✗' };
  const MARK_LABEL = { '': '尚未標記', trust: '相信', doubt: '不相信' };

  const $ = (id) => document.getElementById(id);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pad = (h) => `${String(h).padStart(2, '0')}:00`;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* 私密瀏覽或被封鎖時，遊戲照常進行，只是不存檔 */
      }
    },
    del(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* 同上 */
      }
    },
  };

  class Ending {
    constructor(id, where = null) {
      this.id = id;
      this.where = where; // 出事的地點，只有標出死因時會用到
    }
  }

  let S = null; // 目前狀態
  let nightBase = null; // 這一夜開始前的狀態（重來這一夜用）
  let hourSave = null; // 目前整點的存檔（繼續遊戲、熱更新用）
  let deskView = 'now'; // 守則顯示：今晚 / 手機照片
  let flow = 0; // 每次開新流程就加一，舊流程的畫面回應會被忽略
  let onKey = null; // 目前畫面的數字鍵處理
  let revealNow = null; // 目前畫面的「立即顯示全部」

  function freshState() {
    return {
      v: 1, name: '', night: 1, hi: 0, san: SAN_MAX, bat: BAT_MAX, loc: 'guard',
      cps: [], clues: [], flags: [], seen: [], marks: {}, warnings: 0, missed: 0, tonightClues: [],
    };
  }

  /* ================================================================ 文字 */

  function fmt(str, ctx = {}) {
    return str.replace(/\{(\w+)\}/g, (match, key) => {
      if (key === 'name') return S.name || '新人';
      if (key === 'time') return pad(HOURS[S.hi]);
      if (key === 'dest') return ctx.dest ? C.LOCATIONS[ctx.dest].label : '';
      if (key === 'missed') return String(S.missed);
      return match;
    });
  }

  function lines(list, ctx = {}) {
    return list
      .map((p) => (typeof p === 'function' ? p(S, ctx) : p))
      .filter(Boolean)
      .map((p) => fmt(p, ctx));
  }

  function kicker() {
    const loc = C.LOCATIONS[S.loc] || C.LOCATIONS.guard;
    return `${NIGHT_NAMES[S.night]}・${pad(HOURS[S.hi])}・${loc.name}`;
  }

  /* ================================================================ 畫面 */

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /**
   * 顯示一個段落畫面，回傳玩家選擇的索引（或輸入的文字）。
   * 段落以「※」開頭時，會用系統提示的樣式顯示。
   */
  function scene({ kickerText = '', title = '', paras = [], choices = [], input = null, stats = null, tone = '' }) {
    const token = flow;
    const host = $('scene');
    host.innerHTML = '';
    host.scrollTop = 0;

    const wrap = el('div', `scene-inner ${tone}`.trim());
    if (kickerText) wrap.append(el('p', 'kicker', kickerText));
    if (title) wrap.append(el('h2', 'scene-title', title));

    const body = el('div', 'scene-text');
    paras.forEach((p, i) => {
      const isSys = p.startsWith('※');
      const node = el('p', isSys ? 'sys' : '', isSys ? p.slice(1).trim() : p);
      node.style.setProperty('--d', i);
      body.append(node);
    });
    wrap.append(body);

    if (stats) {
      const dl = el('dl', 'stats');
      stats.forEach(([k, v]) => {
        const row = el('div', 'stat-row');
        row.append(el('dt', '', k), el('dd', '', String(v)));
        dl.append(row);
      });
      wrap.append(dl);
    }

    const box = el('div', 'choices');
    wrap.append(box);
    host.append(wrap);

    return new Promise((resolve) => {
      let done = false;
      let revealed = false;
      const finish = (value) => {
        if (done || token !== flow) return;
        done = true;
        onKey = null;
        revealNow = null;
        A.play('click');
        resolve(value);
      };

      let firstControl = null;
      if (input) {
        const form = el('form', 'sign-form');
        form.setAttribute('autocomplete', 'off');
        const label = el('label', 'sr-only', '你的名字');
        label.setAttribute('for', 'sign-name');
        const field = el('input', 'sign-input');
        field.id = 'sign-name';
        field.name = 'sign-name';
        field.maxLength = 8;
        field.placeholder = '你的名字';
        field.value = input.value || '';
        const btn = el('button', 'choice primary', input.button || '簽名');
        btn.type = 'submit';
        form.append(label, field, btn);
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const v = field.value.replace(/\s+/g, ' ').trim().slice(0, 8);
          finish(v || '新人');
        });
        box.append(form);
        firstControl = field;
      } else {
        choices.forEach((c, i) => {
          const btn = el('button', `choice ${c.cls || ''}`.trim());
          btn.type = 'button';
          btn.append(el('span', 'ck', String(i + 1)), el('span', 'ct', c.t));
          if (c.sub) btn.append(el('span', 'cs', c.sub));
          btn.addEventListener('click', () => finish(i));
          box.append(btn);
          if (i === 0) firstControl = btn;
        });
        onKey = (n) => {
          if (n >= 1 && n <= choices.length) finish(n - 1);
        };
      }

      const reveal = () => {
        if (revealed) return;
        revealed = true;
        wrap.classList.remove('revealing');
        wrap.classList.add('revealed');
        if (firstControl && document.activeElement !== $('sign-name')) {
          firstControl.focus({ preventScroll: true });
        }
      };
      revealNow = reveal;

      if (reduceMotion()) {
        reveal();
      } else {
        wrap.classList.add('revealing');
        const timer = setTimeout(reveal, paras.length * 380 + 250);
        body.addEventListener('click', () => {
          clearTimeout(timer);
          reveal();
        });
      }
    });
  }

  function showScreen(name) {
    for (const id of ['title-screen', 'game-screen', 'ending-screen']) {
      $(id).hidden = id !== `${name}-screen`;
    }
    closeSheets();
    $('menu').hidden = true;
    $('gallery').hidden = true;
  }

  function toast(msg, kind = '') {
    const host = $('toasts');
    const node = el('p', `toast ${kind}`.trim(), msg);
    host.append(node);
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => node.classList.add('out'), 2200);
    setTimeout(() => node.remove(), 2700);
  }

  function flash(id, cls) {
    const node = $(id);
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  /* ================================================================ 狀態面板 */

  function renderStatus() {
    $('tb-night').textContent = NIGHT_NAMES[S.night];
    $('tb-clock').textContent = S.hi === 0 ? '22:00' : pad(HOURS[S.hi]);
    $('san-bar').style.width = `${S.san}%`;
    $('san-num').textContent = String(S.san);
    $('san-meter').setAttribute('aria-valuenow', String(S.san));
    const cells = $('bat-cells');
    cells.innerHTML = '';
    for (let i = 0; i < BAT_MAX; i++) cells.append(el('i', i < S.bat ? 'on' : ''));
    cells.setAttribute('aria-label', `手電筒電量 ${S.bat} / ${BAT_MAX}`);
    $('cp-num').textContent = `${S.cps.length} / ${CHECKPOINTS.length}`;
    document.body.dataset.san = S.san < 15 ? 'crit' : S.san < 35 ? 'low' : S.san < 60 ? 'mid' : 'ok';
    A.setTension(S.san);
  }

  function renderMap() {
    const floors = [
      { id: '6F', y: 44 }, { id: '5F', y: 78 }, { id: '3F', y: 146 },
      { id: '2F', y: 180 }, { id: 'guard', y: 214 }, { id: 'B1', y: 252 },
    ];
    const show7 = S.flags.includes('saw7f') || (S.night === 3 && S.hi >= HI_SEVENTH);
    const at = (id) => S.loc === id;
    let svg = '<svg viewBox="0 0 220 292" role="img" aria-label="福安大廈剖面圖">';
    if (show7) {
      svg += '<g class="m-ghost"><rect x="34" y="10" width="162" height="30"/>';
      svg += '<text x="8" y="29" class="m-lbl">7F</text></g>';
    }
    for (const f of floors) {
      const loc = C.LOCATIONS[f.id];
      const done = S.cps.includes(f.id);
      svg += `<g class="m-floor${at(f.id) ? ' here' : ''}">`;
      svg += `<rect x="34" y="${f.y}" width="162" height="30"/>`;
      svg += `<text x="8" y="${f.y + 19}" class="m-lbl">${loc.label}</text>`;
      svg += `<text x="42" y="${f.y + 19}" class="m-room">${esc(loc.short)}</text>`;
      if (CHECKPOINTS.includes(f.id)) {
        svg += `<circle class="m-cp${done ? ' done' : ''}" cx="180" cy="${f.y + 15}" r="5"/>`;
      }
      svg += '</g>';
    }
    svg += '<rect class="m-shaft" x="146" y="44" width="16" height="238"/>';
    svg += '<text class="m-four" x="154" y="131" text-anchor="middle">4</text>';
    svg += '<line class="m-ground" x1="0" y1="248" x2="220" y2="248"/>';
    const here = S.loc === '7F' ? { y: 10 } : floors.find((f) => f.id === S.loc);
    if (here) {
      svg += `<circle class="m-you-glow" cx="124" cy="${here.y + 15}" r="10"/>`;
      svg += `<circle class="m-you" cx="124" cy="${here.y + 15}" r="4.5"/>`;
    }
    svg += '</svg>';
    $('map').innerHTML = svg;
  }

  function starPoints(cx, cy, outer, inner) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? inner : outer;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  }
  const STAR = starPoints(50, 40, 6, 2.6);

  function stampSvg(flip, uid) {
    return `<svg class="stamp${flip ? ' flip' : ''}" viewBox="0 0 100 100" role="img" aria-label="福安物業管理有限公司印章">
      <defs><path id="arc-${uid}" d="M 15 54 A 35 35 0 0 1 85 54"/></defs>
      <circle cx="50" cy="50" r="46" class="st-ring"/>
      <circle cx="50" cy="50" r="38.5" class="st-ring thin"/>
      <text class="st-arc"><textPath href="#arc-${uid}" startOffset="50%" text-anchor="middle">福安物業管理有限公司</textPath></text>
      <polygon points="${STAR}" class="st-star"/>
      <text x="50" y="64" text-anchor="middle" class="st-main">管理專用章</text>
    </svg>`;
  }

  function ruleRow(id, readonly) {
    const r = C.RULES[id];
    const mark = (!readonly && S && S.marks[id]) || '';
    const sign = r.sign ? `<span class="sign">——${esc(r.sign)}</span>` : '';
    const btn = readonly
      ? ''
      : `<button type="button" class="mark" data-rule="${id}" data-mark="${mark}" aria-label="第 ${r.n} 條：${MARK_LABEL[mark]}（點一下切換）">${MARK_GLYPH[mark]}</button>`;
    return `<li class="rule ${r.ink}"><span class="rn">${r.n}.</span><span class="rt">${esc(r.text)}${sign}</span>${btn}</li>`;
  }

  function renderHandbook() {
    const photo = deskView === 'photo';
    const night = photo ? 1 : S ? S.night : 1;
    const hb = C.HANDBOOKS[night];
    let html = '';
    if (photo) html += '<p class="photo-cap">IMG_2158.JPG・第一夜 21:59 拍攝</p>';
    hb.pages.forEach((pg, pi) => {
      html += `<article class="hb-page${photo ? ' photo' : ''}">`;
      if (pi === 0) {
        html += '<header class="hb-head"><p class="hb-org">福安大廈</p><h3>夜間保全守則</h3><p class="hb-sub">請勿攜出保全室</p></header>';
      }
      html += '<ol class="hb-rules">';
      pg.rules.forEach((id) => (html += ruleRow(id, photo)));
      html += '</ol>';
      if (pg.footer) html += `<p class="hb-footer">${esc(C.FOOTERS[pg.footer])}</p>`;
      html += stampSvg(pg.stamp === 'flip', `${photo ? 'p' : 'n'}${night}-${pi}`);
      html += `<p class="hb-folio">－ ${pi + 1} －</p></article>`;
    });
    if (hb.hand.length) {
      html += '<article class="hb-page hb-back"><p class="hb-back-note">（第二頁背面）</p><ol class="hb-rules">';
      hb.hand.forEach((id) => (html += ruleRow(id, photo)));
      html += '</ol></article>';
    }
    $('handbook').innerHTML = html;
    document.querySelectorAll('.hb-switch button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.view === deskView));
    });
  }

  function renderClues() {
    const host = $('clues');
    if (!S || !S.clues.length) {
      host.innerHTML = '<p class="empty">還沒有找到任何線索。巡邏時，留意那些不該出現的東西。</p>';
      return;
    }
    host.innerHTML = S.clues
      .map((id) => {
        const c = C.CLUES[id];
        return `<article class="clue${c.hand ? ' hand' : ''}"><h4>${esc(c.title)}</h4><p>${esc(c.text)}</p></article>`;
      })
      .join('');
  }

  function renderAll() {
    renderStatus();
    renderMap();
    renderHandbook();
    renderClues();
  }

  /* ================================================================ 規則判定 */

  function changeSan(delta) {
    const before = S.san;
    S.san = clamp(S.san + delta, 0, SAN_MAX);
    const diff = S.san - before;
    if (!diff) return;
    toast(`理智 ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`, diff < 0 ? 'bad' : 'good');
    if (diff < 0) flash('san-meter', 'hit');
  }

  function changeBat(delta) {
    const before = S.bat;
    S.bat = clamp(S.bat + delta, 0, BAT_MAX);
    if (S.bat < before) flash('bat-cells', 'hit');
  }

  function refill() {
    if (S.bat < BAT_MAX) {
      S.bat = BAT_MAX;
      toast('換上了新電池');
    }
  }

  function gainClue(id) {
    if (S.clues.includes(id)) return;
    S.clues.push(id);
    S.tonightClues.push(id);
    toast(`找到線索：${C.CLUES[id].title}`, 'clue');
    $('clue-badge').hidden = false;
    $('nav-clue-badge').hidden = false;
    renderClues();
  }

  function addFlag(flag) {
    if (!S.flags.includes(flag)) S.flags.push(flag);
  }

  function punch(dest) {
    if (!CHECKPOINTS.includes(dest) || S.cps.includes(dest)) return;
    S.cps.push(dest);
    toast(`${C.LOCATIONS[dest].label} 打卡完成`);
  }

  function checkSan(where = S.loc) {
    if (S.san <= 0) throw new Ending('E_SAN', where);
  }

  function findEvent(at, ctx = {}) {
    for (const [id, ev] of Object.entries(C.EVENTS)) {
      if (ev.at !== at) continue;
      if (ev.night && ![].concat(ev.night).includes(S.night)) continue;
      if (ev.loc && ev.loc !== ctx.dest) continue;
      if (ev.mode && ev.mode !== ctx.mode) continue;
      if (ev.dests && !ev.dests.includes(ctx.dest)) continue;
      if (ev.minHi != null && S.hi < ev.minHi) continue;
      if (ev.notHi && ev.notHi.includes(S.hi)) continue;
      if (S.seen.includes(`${S.night}:${id}`)) continue;
      return id;
    }
    return null;
  }

  function applyResult(res, ctx) {
    if (res.san) changeSan(res.san);
    if (res.bat) changeBat(res.bat);
    if (res.batSet != null) S.bat = clamp(res.batSet, 0, BAT_MAX);
    if (res.clue) gainClue(res.clue);
    if (res.flag) addFlag(res.flag);
    if (res.abort) ctx.abort = true;
    if (res.noCp) ctx.noCp = true;
    if (res.loc) S.loc = res.loc;
    if (res.sfx) A.play(res.sfx);
    renderStatus();
    renderMap();
  }

  async function runEvent(id, ctx) {
    while (id) {
      const ev = C.EVENTS[id];
      S.seen.push(`${S.night}:${id}`);
      if (ev.flagOnShow) {
        addFlag(ev.flagOnShow);
        renderMap();
      }
      if (ev.sfx) A.play(ev.sfx);
      const options = ev.choices.filter((c) => !c.when || c.when(S, ctx));
      const i = await scene({
        kickerText: kicker(),
        paras: lines(ev.text, ctx),
        choices: options.map((c) => ({ t: fmt(c.t, ctx) })),
        tone: ev.at === 'lock' || ev.at === 'lockout' ? 'dark' : '',
      });
      const res = options[i].res || {};
      const chosenAt = S.loc;
      applyResult(res, ctx);
      if (res.text) {
        await scene({ kickerText: kicker(), paras: lines(res.text, ctx), choices: [{ t: '繼續' }] });
      }
      if (res.end) throw new Ending(typeof res.end === 'function' ? res.end(S) : res.end);
      checkSan(chosenAt);
      id = res.next || null;
    }
  }

  /* ================================================================ 一小時 */

  function destinations() {
    const list = [{ id: 'guard', t: '留在 1F 保全室', sub: '休息・換電池' }];
    for (const id of CHECKPOINTS) {
      list.push({ id, t: C.LOCATIONS[id].name, sub: S.cps.includes(id) ? '已打卡' : '未打卡', cls: S.cps.includes(id) ? 'done' : '' });
    }
    if (S.night === 3 && S.hi === HI_SEVENTH && !S.flags.includes('chen_lost')) {
      list.push({ id: '7F', t: '7F', sub: '樓梯', cls: 'seventh' });
    }
    return list;
  }

  function hourHints() {
    const hints = [];
    if (S.night === 1 && S.hi === 1) {
      hints.push('※ 每次離開保全室，會用掉一格手電筒電量。在保全室待一個小時，可以換上新電池。');
    }
    if (S.bat === 0) hints.push('※ 手電筒沒電了。沒有光，就找不到打卡鐘。');
    else if (S.bat === 1) hints.push('※ 手電筒只剩一格電。');
    const left = CHECKPOINTS.length - S.cps.length;
    hints.push(left > 0 ? `※ 今晚還剩 ${left} 個打卡點。` : '※ 今晚的打卡點都完成了。');
    return hints;
  }

  async function hourPrompt() {
    A.play('hour');
    const h = HOURS[S.hi];
    const line = (C.HOUR_LINES_BY_NIGHT[S.night] || {})[h] || C.HOUR_LINES[h];
    for (;;) {
      const dests = destinations();
      const i = await scene({
        kickerText: kicker(),
        paras: [line, ...hourHints()],
        choices: dests,
        tone: 'prompt',
      });
      const dest = dests[i].id;
      if (dest === 'guard' || dest === '7F') return { dest, mode: null };
      const m = await scene({
        kickerText: kicker(),
        paras: [`要怎麼去 ${C.LOCATIONS[dest].name}？`],
        choices: [{ t: '走樓梯' }, { t: '搭電梯' }, { t: '換個地方', cls: 'back' }],
        tone: 'prompt',
      });
      if (m === 2) continue;
      return { dest, mode: m === 0 ? 'stairs' : 'elevator' };
    }
  }

  async function rest() {
    changeSan(REST_SAN);
    const paras = [pick(C.REST)];
    if (S.bat < BAT_MAX) paras.push('你換上了新電池。');
    S.bat = BAT_MAX;
    renderStatus();
    await scene({ kickerText: kicker(), paras, choices: [{ t: '繼續' }] });
  }

  async function ambient(dest, already) {
    const pool = C.AMBIENT[dest];
    const paras = [pool[(S.night + S.hi + S.seen.length) % pool.length]];
    if (Math.random() < SCARE_CHANCE) {
      paras.push(pick(C.SCARES));
      changeSan(SCARE_SAN);
      renderStatus();
    }
    paras.push(already ? '這裡已經打過卡了。' : '你打了卡。');
    await scene({ kickerText: kicker(), paras, choices: [{ t: '繼續' }] });
    checkSan();
  }

  async function darkness() {
    changeSan(DARK_SAN);
    renderStatus();
    await scene({ kickerText: kicker(), paras: C.DARK, choices: [{ t: '繼續' }], tone: 'dark' });
    checkSan();
    S.loc = 'guard';
  }

  async function resolveHour({ dest, mode }) {
    const ctx = { dest, mode, dark: false, abort: false, noCp: false };
    if (dest !== 'guard') {
      ctx.dark = S.bat <= 0;
      if (!ctx.dark) S.bat -= 1;
      renderStatus();
    }

    if (dest === '7F') {
      S.loc = '7F';
      renderMap();
      await runEvent(findEvent('seventh', ctx), ctx);
      if (ctx.abort || S.loc === '7F') S.loc = 'guard';
      return;
    }

    if (S.hi === HI_LOCK) {
      S.loc = dest;
      renderMap();
      let id;
      if (dest === 'guard') id = findEvent('lock', ctx);
      else if (S.night === 3 && dest === '6F') id = findEvent('roof', ctx);
      else id = findEvent('lockout', ctx);
      await runEvent(id, ctx);
      if (dest === 'guard') refill();
      return;
    }

    if (dest === 'guard') {
      S.loc = 'guard';
      renderMap();
      const id = findEvent('guard', ctx);
      if (id) {
        await runEvent(id, ctx);
        refill();
      } else {
        await rest();
      }
      return;
    }

    const transit = findEvent('transit', ctx);
    if (transit) await runEvent(transit, ctx);
    if (ctx.abort) {
      S.loc = 'guard';
      return;
    }

    S.loc = dest;
    renderMap();
    if (ctx.dark) {
      await darkness();
      return;
    }

    const local = findEvent('loc', ctx);
    if (local) {
      await runEvent(local, ctx);
      if (ctx.abort) {
        S.loc = 'guard';
        return;
      }
      if (!ctx.noCp) punch(dest);
    } else {
      const already = S.cps.includes(dest);
      punch(dest);
      await ambient(dest, already);
    }
  }

  /* ================================================================ 一夜 */

  async function intro() {
    for (const sc of C.INTROS[S.night]) {
      if (sc.sfx) A.play(sc.sfx);
      if (sc.input === 'name') {
        S.name = await scene({
          kickerText: `${NIGHT_NAMES[S.night]}・22:00・1F 保全室`,
          paras: lines(sc.paras),
          input: { value: S.name, button: sc.button },
        });
        renderStatus();
      } else {
        await scene({
          kickerText: `${NIGHT_NAMES[S.night]}・22:00・1F 保全室`,
          paras: lines(sc.paras),
          choices: [{ t: sc.button }],
        });
      }
    }
  }

  async function summary() {
    const missed = CHECKPOINTS.length - S.cps.length;
    S.missed = missed;
    if (missed > 0) S.warnings += 1;
    const found = S.tonightClues.map((id) => C.CLUES[id].title);
    const paras = [C.SUMMARY_LINES[S.night]];
    if (missed > 0) {
      paras.push(S.warnings >= 2 ? '※ 你又少打了卡。林主任不會再給你機會了。' : `※ 少打了 ${missed} 個卡。林主任一定會注意到。`);
    }
    await scene({
      kickerText: `${NIGHT_NAMES[S.night]}・06:00`,
      title: `${NIGHT_NAMES[S.night]}結束`,
      paras,
      stats: [
        ['打卡', `${S.cps.length} / ${CHECKPOINTS.length}`],
        ['理智', S.san],
        ['新的線索', found.length ? found.join('、') : '沒有'],
      ],
      choices: [{ t: S.warnings >= 2 ? '隔天早上' : '迎接下一夜' }],
      tone: 'summary',
    });
    if (S.warnings >= 2) throw new Ending('E_FIRED');
  }

  function saveHour() {
    hourSave = { S: clone(S), base: clone(nightBase) };
    store.set(KEYS.save, hourSave);
  }

  async function loop() {
    for (;;) {
      if (S.hi >= HI_END) {
        S.hi = HI_END;
        S.loc = 'guard';
        renderStatus();
        renderMap();
        await runEvent(findEvent('signout'), {});
        await summary();
        const next = clone(S);
        next.night += 1;
        return playNight(next);
      }
      saveHour();
      const choice = await hourPrompt();
      await resolveHour(choice);
      checkSan();
      S.hi += 1;
      renderAll();
    }
  }

  async function playNight(base) {
    S = clone(base);
    nightBase = clone(base);
    S.hi = 0;
    S.cps = [];
    S.loc = 'guard';
    S.bat = BAT_MAX;
    S.tonightClues = [];
    if (S.night > 1) S.san = clamp(S.san + NIGHT_SAN_RECOVERY, 0, SAN_MAX);
    deskView = 'now';
    showScreen('game');
    renderAll();
    $('nav-rule-badge').hidden = S.night === 1;
    await intro();
    S.hi = 1;
    renderAll();
    await loop();
  }

  function startFlow(fn) {
    flow += 1;
    const mine = flow;
    onKey = null;
    revealNow = null;
    (async () => {
      try {
        await fn();
      } catch (err) {
        if (mine !== flow) return;
        if (err instanceof Ending) showEnding(err.id, err.where);
        else console.error(err);
      }
    })();
  }

  /* ================================================================ 結局與選單 */

  function foundEndings() {
    const list = store.get(KEYS.endings, []);
    return Array.isArray(list) ? list.filter((id) => C.ENDINGS[id]) : [];
  }

  function showEnding(id, where = null) {
    const e = C.ENDINGS[id];
    const found = foundEndings();
    if (!found.includes(id)) store.set(KEYS.endings, [...found, id]);
    store.del(KEYS.save);
    hourSave = null;
    onKey = null;

    const index = C.ENDING_ORDER.indexOf(id) + 1;
    $('end-no').textContent = `結局 ${String(index).padStart(2, '0')}／${C.ENDING_ORDER.length}`;
    $('end-kind').textContent = e.kind;
    $('end-kind').dataset.kind = e.kind;
    $('end-title').textContent = e.title;
    const cause = $('end-cause');
    cause.hidden = !e.cause;
    if (e.cause) {
      const loc = C.LOCATIONS[where || S.loc] || C.LOCATIONS.guard;
      cause.textContent = `死因：${e.cause}（${NIGHT_NAMES[S.night]} ${pad(HOURS[S.hi])}・${loc.name}）`;
    }
    const body = $('end-text');
    body.innerHTML = '';
    lines(e.text).forEach((p, i) => {
      const node = el('p', '', p);
      node.style.setProperty('--d', i);
      body.append(node);
    });
    $('end-hint').textContent = e.hint;
    $('btn-retry').textContent = `重來${NIGHT_NAMES[nightBase.night]}`;
    showScreen('ending');
    A.play(e.kind === '壞結局' ? 'sting' : 'page');
  }

  function showTitle() {
    flow += 1;
    onKey = null;
    showScreen('title');
    const save = store.get(KEYS.save, null);
    const btn = $('btn-continue');
    const valid = save && save.S && save.base && NIGHT_NAMES[save.S.night];
    btn.hidden = !valid;
    if (valid) btn.textContent = `繼續值班（${NIGHT_NAMES[save.S.night]} ${pad(HOURS[save.S.hi])}）`;
    $('ending-count').textContent = `${foundEndings().length} / ${C.ENDING_ORDER.length}`;
  }

  function resume(save) {
    startFlow(async () => {
      S = clone(save.S);
      nightBase = clone(save.base);
      deskView = 'now';
      showScreen('game');
      renderAll();
      await loop();
    });
  }

  function showGallery() {
    const found = foundEndings();
    $('gallery-count').textContent = `已解鎖 ${found.length} / ${C.ENDING_ORDER.length}`;
    $('gallery-grid').innerHTML = C.ENDING_ORDER.map((id, i) => {
      const e = C.ENDINGS[id];
      const got = found.includes(id);
      return `<li class="g-card${got ? ' got' : ''}" data-kind="${got ? esc(e.kind) : ''}">
        <span class="g-no">${String(i + 1).padStart(2, '0')}</span>
        <span class="g-title">${got ? esc(e.title) : '？？？'}</span>
        <span class="g-kind">${got ? esc(e.kind) : '尚未解鎖'}</span></li>`;
    }).join('');
    $('gallery').hidden = false;
    $('btn-gallery-close').focus();
  }

  /* ================================================================ 介面綁定 */

  function closeSheets() {
    document.querySelectorAll('.sheet-open').forEach((n) => n.classList.remove('sheet-open'));
    $('sheet-backdrop').hidden = true;
  }

  function setDeskTab(tab) {
    document.querySelectorAll('.desk-tabs button').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    });
    $('desk-rules').hidden = tab !== 'rules';
    $('desk-clues').hidden = tab !== 'clues';
    if (tab === 'clues') {
      $('clue-badge').hidden = true;
      $('nav-clue-badge').hidden = true;
    } else {
      $('nav-rule-badge').hidden = true;
    }
  }

  function openSheet(panelId, tab) {
    closeSheets();
    if (tab) setDeskTab(tab);
    $(panelId).classList.add('sheet-open');
    $('sheet-backdrop').hidden = false;
  }

  function setSoundLabel() {
    const label = A.muted ? '聲音：關' : '聲音：開';
    $('btn-sound').textContent = label;
    $('btn-sound-title').textContent = label;
  }

  function toggleSound() {
    A.setMuted(!A.muted);
    store.set(KEYS.mute, A.muted);
    if (!A.muted) A.init();
    setSoundLabel();
  }

  function bindUI() {
    A.setMuted(!!store.get(KEYS.mute, false));
    setSoundLabel();

    const wake = () => {
      if (!A.muted) A.init();
    };
    document.addEventListener('pointerdown', wake);
    document.addEventListener('keydown', wake);

    $('btn-new').addEventListener('click', () => startFlow(() => playNight(freshState())));
    $('btn-continue').addEventListener('click', () => {
      const save = store.get(KEYS.save, null);
      if (save && save.S) resume(save);
    });
    $('btn-gallery').addEventListener('click', showGallery);
    $('btn-gallery-close').addEventListener('click', () => ($('gallery').hidden = true));
    $('btn-sound').addEventListener('click', toggleSound);
    $('btn-sound-title').addEventListener('click', toggleSound);

    $('btn-menu').addEventListener('click', () => {
      $('menu').hidden = false;
      $('btn-menu-resume').focus();
    });
    $('btn-menu-resume').addEventListener('click', () => ($('menu').hidden = true));
    $('btn-menu-retry').addEventListener('click', () => startFlow(() => playNight(nightBase)));
    $('btn-menu-title').addEventListener('click', showTitle);

    $('btn-retry').addEventListener('click', () => startFlow(() => playNight(nightBase)));
    $('btn-end-title').addEventListener('click', showTitle);
    $('btn-end-gallery').addEventListener('click', showGallery);

    document.querySelectorAll('.desk-tabs button').forEach((b) => {
      b.addEventListener('click', () => setDeskTab(b.dataset.tab));
    });
    document.querySelectorAll('.hb-switch button').forEach((b) => {
      b.addEventListener('click', () => {
        deskView = b.dataset.view;
        A.play('page');
        renderHandbook();
      });
    });
    $('handbook').addEventListener('click', (e) => {
      const btn = e.target.closest('.mark');
      if (!btn || !S) return;
      const id = btn.dataset.rule;
      const next = MARKS[(MARKS.indexOf(S.marks[id] || '') + 1) % MARKS.length];
      if (next) S.marks[id] = next;
      else delete S.marks[id];
      renderHandbook();
      const again = $('handbook').querySelector(`.mark[data-rule="${id}"]`);
      if (again) again.focus();
    });

    document.querySelectorAll('[data-sheet]').forEach((b) => {
      b.addEventListener('click', () => openSheet(b.dataset.sheet, b.dataset.tab));
    });
    document.querySelectorAll('.sheet-close').forEach((b) => b.addEventListener('click', closeSheets));
    $('sheet-backdrop').addEventListener('click', closeSheets);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSheets();
        $('gallery').hidden = true;
        $('menu').hidden = true;
        return;
      }
      if (e.target instanceof HTMLInputElement) return;
      if (!$('menu').hidden || !$('gallery').hidden) return;
      if (revealNow && $('scene').querySelector('.revealing')) {
        if (/^[1-9]$/.test(e.key) || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          revealNow();
        }
        return;
      }
      if (/^[1-9]$/.test(e.key) && onKey) onKey(Number(e.key));
    });

    if (!reduceMotion()) {
      const flicker = () => {
        document.body.classList.add('flicker');
        setTimeout(() => document.body.classList.remove('flicker'), 380);
        setTimeout(flicker, 14000 + Math.random() * 26000);
      };
      setTimeout(flicker, 9000);
    }
  }

  /* ================================================================ 啟動 */

  function start(data) {
    bindUI();
    const save = data && data.save;
    if (save && save.S && save.base) resume(save);
    else showTitle();
  }

  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') {
    try {
      hot.snapshot(() => ({ save: hourSave }));
    } catch {
      /* 不在 Artifact 檢視器裡時沒有熱更新 */
    }
  }
  if (hot && typeof hot.ready === 'function') hot.ready(start);
  else start((hot && hot.data) || {});
})();
