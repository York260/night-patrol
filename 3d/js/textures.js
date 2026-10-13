/*
 * 夜巡守則・七樓（3D）— 程序化材質
 * 所有貼圖都用 canvas 即時畫出來，不需要任何圖檔。
 * 解析度刻意壓低（128–256px），搭配最近鄰取樣，形成低解析度的恐怖感。
 */
window.NP3D_TEX = (() => {
  'use strict';

  const FONT_SERIF = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';
  const FONT_HAND = '"Iansui", "LXGW WenKai TC", "Kaiti TC", "DFKai-SB", cursive';
  const FONT_MONO = '"IBM Plex Mono", ui-monospace, monospace';
  const FONT_SANS = '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return [c, c.getContext('2d')];
  }

  function toTex(c, { repeat = true, nearest = true, mip = true } = {}) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.generateMipmaps = mip;
    return t;
  }

  function speckle(ctx, w, h, r, count, colors, size = 1) {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(r() * colors.length)];
      ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), size, size);
    }
  }

  function blotch(ctx, w, h, r, count, rgba, maxR) {
    for (let i = 0; i < count; i++) {
      const x = r() * w;
      const y = r() * h;
      const rad = (0.3 + r() * 0.7) * maxR;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }

  function drips(ctx, w, h, r, count, rgba, top) {
    ctx.fillStyle = rgba;
    for (let i = 0; i < count; i++) {
      const x = Math.floor(r() * w);
      const len = 8 + r() * h * 0.4;
      const y0 = top + r() * 10;
      ctx.fillRect(x, y0, 1 + Math.floor(r() * 2), len);
    }
  }

  /* ---------------------------------------------------------------- 表面 */

  function tile(base = '#c9c4b4', grout = '#857f72', seed = 1) {
    const [c, ctx] = canvas(128, 128);
    const r = rng(seed);
    ctx.fillStyle = grout;
    ctx.fillRect(0, 0, 128, 128);
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const v = Math.floor((r() - 0.5) * 18);
        ctx.fillStyle = shade(base, v);
        ctx.fillRect(tx * 64 + 1, ty * 64 + 1, 62, 62);
      }
    }
    speckle(ctx, 128, 128, r, 900, ['#9a9486', '#e2ddcf', '#7d776b', '#b5ae9f']);
    blotch(ctx, 128, 128, r, 7, 'rgba(70,60,40,0.18)', 30);
    return toTex(c);
  }

  function wall(upper = '#d3cfc2', lower = '#93a493', stripe = '#4f6650', seed = 2) {
    const [c, ctx] = canvas(128, 192);
    const r = rng(seed);
    ctx.fillStyle = upper;
    ctx.fillRect(0, 0, 128, 192);
    ctx.fillStyle = lower;
    ctx.fillRect(0, 128, 128, 64);
    ctx.fillStyle = stripe;
    ctx.fillRect(0, 124, 128, 5);
    speckle(ctx, 128, 192, r, 700, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.06)']);
    drips(ctx, 128, 120, r, 9, 'rgba(90,80,60,0.12)', 0);
    blotch(ctx, 128, 192, r, 5, 'rgba(80,70,50,0.16)', 26);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 186, 128, 6);
    return toTex(c);
  }

  function ceiling(seed = 3) {
    const [c, ctx] = canvas(128, 128);
    const r = rng(seed);
    ctx.fillStyle = '#bdb8ab';
    ctx.fillRect(0, 0, 128, 128);
    speckle(ctx, 128, 128, r, 1600, ['#a8a396', '#cdc8ba', '#9c978a']);
    ctx.fillStyle = '#6f6a5e';
    ctx.fillRect(0, 0, 128, 2);
    ctx.fillRect(0, 64, 128, 2);
    ctx.fillRect(0, 0, 2, 128);
    ctx.fillRect(64, 0, 2, 128);
    blotch(ctx, 128, 128, r, 3, 'rgba(120,90,40,0.25)', 22);
    return toTex(c);
  }

  function concrete(seed = 4, base = '#7d7c78') {
    const [c, ctx] = canvas(128, 128);
    const r = rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    speckle(ctx, 128, 128, r, 2600, ['#6d6c68', '#8b8a85', '#5f5e5a', '#94938d']);
    blotch(ctx, 128, 128, r, 6, 'rgba(20,18,15,0.25)', 28);
    ctx.strokeStyle = 'rgba(30,30,28,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      let x = r() * 128;
      let y = r() * 128;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (r() - 0.5) * 30;
        y += (r() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return toTex(c);
  }

  function carpet(seed = 5) {
    const [c, ctx] = canvas(128, 128);
    const r = rng(seed);
    ctx.fillStyle = '#3a414a';
    ctx.fillRect(0, 0, 128, 128);
    speckle(ctx, 128, 128, r, 3000, ['#333a42', '#444c56', '#2d333a', '#4b535d']);
    ctx.strokeStyle = 'rgba(20,24,28,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const x = 10 + r() * 60;
      const y = 10 + r() * 60;
      ctx.strokeRect(x, y, 40 + r() * 20, 28 + r() * 10);
    }
    blotch(ctx, 128, 128, r, 4, 'rgba(10,10,10,0.3)', 20);
    return toTex(c);
  }

  function metal(base = '#3f5148', seed = 6) {
    const [c, ctx] = canvas(64, 128);
    const r = rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 128);
    speckle(ctx, 64, 128, r, 500, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.12)']);
    ctx.strokeStyle = 'rgba(200,200,190,0.18)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      const x = r() * 64;
      const y = r() * 128;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 4);
      ctx.stroke();
    }
    blotch(ctx, 64, 128, r, 4, 'rgba(110,60,20,0.3)', 12);
    return toTex(c);
  }

  function wood(seed = 7, base = '#6b4c32') {
    const [c, ctx] = canvas(64, 64);
    const r = rng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 2) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`;
      ctx.fillRect(0, y, 64, 1);
    }
    speckle(ctx, 64, 64, r, 200, ['rgba(255,220,180,0.08)']);
    return toTex(c);
  }

  function cloth(seed = 8) {
    const [c, ctx] = canvas(64, 64);
    const r = rng(seed);
    ctx.fillStyle = '#8f887a';
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 9; i++) {
      const y = r() * 64;
      const g = ctx.createLinearGradient(0, y - 6, 0, y + 6);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 6, 64, 12);
    }
    speckle(ctx, 64, 64, r, 400, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.1)']);
    return toTex(c);
  }

  function shutter() {
    const [c, ctx] = canvas(64, 64);
    ctx.fillStyle = '#7a7d7c';
    ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 6) {
      ctx.fillStyle = '#555958';
      ctx.fillRect(0, y, 64, 2);
      ctx.fillStyle = '#9a9d9b';
      ctx.fillRect(0, y + 2, 64, 1);
    }
    return toTex(c);
  }

  function city(seed = 9) {
    const [c, ctx] = canvas(128, 96);
    const r = rng(seed);
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#070b14');
    g.addColorStop(1, '#1a1e26');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 96);
    for (let b = 0; b < 7; b++) {
      const bx = Math.floor(r() * 120);
      const bw = 14 + Math.floor(r() * 22);
      const bh = 30 + Math.floor(r() * 50);
      ctx.fillStyle = '#05070b';
      ctx.fillRect(bx, 96 - bh, bw, bh);
      for (let i = 0; i < 14; i++) {
        if (r() < 0.25) {
          ctx.fillStyle = r() < 0.7 ? '#c9a45a' : '#8fb0c0';
          ctx.fillRect(bx + 2 + Math.floor(r() * (bw - 4)), 96 - bh + 3 + Math.floor(r() * (bh - 6)), 2, 2);
        }
      }
    }
    return toTex(c, { repeat: false });
  }

  function sky(dawn = false) {
    const [c, ctx] = canvas(32, 64);
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    if (dawn) {
      g.addColorStop(0, '#5d6f86');
      g.addColorStop(1, '#d9c7a8');
    } else {
      g.addColorStop(0, '#05070c');
      g.addColorStop(1, '#151a22');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 64);
    return toTex(c, { repeat: false, nearest: false });
  }

  function smoke() {
    const [c, ctx] = canvas(32, 32);
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return toTex(c, { repeat: false, nearest: false, mip: false });
  }

  function shade(hex, v) {
    const n = parseInt(hex.slice(1), 16);
    const cl = (x) => Math.max(0, Math.min(255, x));
    const rr = cl((n >> 16) + v);
    const gg = cl(((n >> 8) & 255) + v);
    const bb = cl((n & 255) + v);
    return `rgb(${rr},${gg},${bb})`;
  }

  /* ---------------------------------------------------------------- 文字 */

  function fitText(ctx, text, maxW, size, family, weight = '') {
    let s = size;
    ctx.font = `${weight} ${s}px ${family}`;
    while (ctx.measureText(text).width > maxW && s > 8) {
      s -= 1;
      ctx.font = `${weight} ${s}px ${family}`;
    }
    return s;
  }

  /** 一般招牌：lines 可以是字串或 {text, size, color, font} */
  function label(lines, { w = 256, h = 64, bg = '#e9e4d3', fg = '#1f1d19', border = null, font = FONT_SERIF, size = 36, align = 'center', pad = 10, weight = '' } = {}) {
    const [c, ctx] = canvas(w, h);
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    }
    const list = (Array.isArray(lines) ? lines : [lines]).map((l) => (typeof l === 'string' ? { text: l } : l));
    const total = list.reduce((a, l) => a + (l.size || size) * 1.25, 0);
    let y = (h - total) / 2;
    ctx.textBaseline = 'top';
    for (const l of list) {
      const s = fitText(ctx, l.text, w - pad * 2, l.size || size, l.font || font, l.weight || weight);
      ctx.fillStyle = l.color || fg;
      ctx.textAlign = align;
      const x = align === 'center' ? w / 2 : align === 'right' ? w - pad : pad;
      ctx.fillText(l.text, x, y + ((l.size || size) - s) / 2);
      y += (l.size || size) * 1.25;
    }
    return toTex(c, { repeat: false, nearest: true });
  }

  function floorSign(text) {
    return label([{ text, size: 44, font: FONT_MONO, weight: '500' }], { w: 128, h: 64, bg: '#e6e2d6', fg: '#141414', border: '#141414' });
  }

  function exitSign() {
    const [c, ctx] = canvas(128, 48);
    ctx.fillStyle = '#1f8a4c';
    ctx.fillRect(0, 0, 128, 48);
    ctx.fillStyle = '#eafff1';
    // 跑步的人
    ctx.beginPath();
    ctx.arc(20, 11, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(16, 16, 5, 12);
    ctx.save();
    ctx.translate(18, 27);
    ctx.rotate(0.6);
    ctx.fillRect(0, 0, 4, 12);
    ctx.restore();
    ctx.save();
    ctx.translate(20, 26);
    ctx.rotate(-0.7);
    ctx.fillRect(0, 0, 4, 12);
    ctx.restore();
    ctx.fillRect(34, 22, 10, 4);
    ctx.beginPath();
    ctx.moveTo(44, 16);
    ctx.lineTo(52, 24);
    ctx.lineTo(44, 32);
    ctx.fill();
    ctx.font = `bold 20px ${FONT_SANS}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('緊急出口', 58, 25);
    return toTex(c, { repeat: false });
  }

  function punchClock() {
    const [c, ctx] = canvas(64, 96);
    ctx.fillStyle = '#b9b3a0';
    ctx.fillRect(0, 0, 64, 96);
    ctx.fillStyle = '#efe9d6';
    ctx.beginPath();
    ctx.arc(32, 30, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(32, 30);
    ctx.lineTo(32, 16);
    ctx.moveTo(32, 30);
    ctx.lineTo(42, 34);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(14, 62, 36, 6);
    ctx.font = `12px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('巡邏打卡', 32, 84);
    return toTex(c, { repeat: false });
  }

  /** 紅筆手寫字（透明底，貼在牆上或白板上） */
  function handwriting(lines, { w = 256, h = 256, size = 22, color = '#a3241b', seed = 11, bg = null, dense = false, align = 'left' } = {}) {
    const [c, ctx] = canvas(w, h);
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }
    const r = rng(seed);
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    const list = dense ? fill(lines, Math.floor(h / (size * 1.25))) : lines;
    let y = dense ? 4 : (h - list.length * size * 1.4) / 2;
    for (const line of list) {
      ctx.save();
      const x = align === 'center' ? w / 2 : 8 + r() * (dense ? 20 : 8);
      ctx.translate(x, y);
      ctx.rotate((r() - 0.5) * (dense ? 0.08 : 0.05));
      ctx.font = `${size + Math.floor((r() - 0.5) * 4)}px ${FONT_HAND}`;
      ctx.textAlign = align;
      ctx.fillText(line, 0, 0);
      ctx.restore();
      y += size * (dense ? 1.2 : 1.4);
    }
    return toTex(c, { repeat: false });
  }

  function fill(lines, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(lines[i % lines.length]);
    return out;
  }

  function whiteboard(kind) {
    const [c, ctx] = canvas(256, 128);
    const r = rng(21);
    ctx.fillStyle = '#e8ebe6';
    ctx.fillRect(0, 0, 256, 128);
    blotch(ctx, 256, 128, r, 8, 'rgba(120,130,140,0.18)', 40);
    ctx.strokeStyle = '#565d66';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 122);
    ctx.fillStyle = '#2a3b5a';
    ctx.strokeStyle = '#2a3b5a';
    ctx.lineWidth = 2;
    if (kind === 'formula') {
      ctx.font = `16px ${FONT_MONO}`;
      ctx.fillText('x² + 5x + 6 = 0', 20, 34);
      ctx.fillText('(x + 2)(x + ', 20, 60);
    } else if (kind === 'building') {
      for (let i = 0; i < 7; i++) {
        ctx.strokeRect(30, 112 - (i + 1) * 14, 60, 14);
        ctx.beginPath();
        ctx.arc(60, 112 - i * 14 - 9, 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(60, 112 - i * 14 - 7);
        ctx.lineTo(60, 112 - i * 14 - 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#a3241b';
      ctx.font = `12px ${FONT_HAND}`;
      ctx.fillText('它會學人的聲音。', 150, 92);
      ctx.fillText('主任的聲音，它學得最像。——陳', 120, 106);
    } else if (kind === 'exam') {
      ctx.font = `22px ${FONT_SERIF}`;
      ctx.fillText('福安大廈共有幾層？', 28, 48);
      ctx.font = `14px ${FONT_SERIF}`;
      ctx.fillText('（作答時間：06:00 前）', 70, 84);
    } else if (kind === 'six') {
      ctx.font = `22px ${FONT_SERIF}`;
      ctx.fillText('福安大廈共有幾層？', 28, 40);
      ctx.font = `40px ${FONT_HAND}`;
      ctx.fillText('六', 110, 70);
    } else if (kind === 'seven') {
      ctx.font = `22px ${FONT_SERIF}`;
      ctx.fillText('福安大廈共有幾層？', 28, 40);
      ctx.font = `40px ${FONT_HAND}`;
      ctx.fillText('七', 110, 70);
    }
    return toTex(c, { repeat: false });
  }

  function logbook(rows) {
    const [c, ctx] = canvas(256, 192);
    ctx.fillStyle = '#ece6d4';
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = '#26221c';
    ctx.font = `16px ${FONT_SERIF}`;
    ctx.textBaseline = 'top';
    ctx.fillText('值班日誌', 92, 6);
    ctx.font = `12px ${FONT_SANS}`;
    ctx.fillText('日期', 12, 30);
    ctx.fillText('上班', 92, 30);
    ctx.fillText('下班', 180, 30);
    ctx.strokeStyle = '#8f8676';
    ctx.lineWidth = 1;
    for (let y = 46; y < 192; y += 24) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(248, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(78, 28);
    ctx.lineTo(78, 190);
    ctx.moveTo(166, 28);
    ctx.lineTo(166, 190);
    ctx.stroke();
    rows.forEach((row, i) => {
      const y = 50 + i * 24;
      ctx.font = `11px ${FONT_MONO}`;
      ctx.fillStyle = '#4b453b';
      ctx.fillText(row.date || '', 12, y + 4);
      ctx.font = `17px ${FONT_HAND}`;
      ctx.fillStyle = '#1d2a4a';
      if (row.in) ctx.fillText(row.in, 88, y);
      if (row.out) {
        ctx.fillStyle = row.wet ? '#0f1830' : '#1d2a4a';
        ctx.fillText(row.out, 176, y);
      }
      if (row.ghost) {
        ctx.fillStyle = 'rgba(40,40,40,0.18)';
        ctx.fillText(row.ghost, 176, y);
      }
    });
    return toTex(c, { repeat: false });
  }

  function roster(name, variant) {
    const [c, ctx] = canvas(192, 192);
    ctx.fillStyle = '#efeadb';
    ctx.fillRect(0, 0, 192, 192);
    ctx.fillStyle = '#26221c';
    ctx.font = `15px ${FONT_SERIF}`;
    ctx.textBaseline = 'top';
    ctx.fillText('夜班值班表', 56, 6);
    ctx.strokeStyle = '#7e7566';
    for (let i = 0; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(10, 30 + i * 26);
      ctx.lineTo(182, 30 + i * 26);
      ctx.stroke();
    }
    for (let j = 0; j <= 4; j++) {
      ctx.beginPath();
      ctx.moveTo(10 + j * 43, 30);
      ctx.lineTo(10 + j * 43, 186);
      ctx.stroke();
    }
    const cells = [];
    if (variant === 2) {
      for (let i = 0; i < 18; i++) cells.push('陳');
      cells.push(name, name, '交班');
    } else {
      for (let i = 0; i < 22; i++) cells.push('陳');
      cells.push(name);
    }
    ctx.font = `16px ${FONT_HAND}`;
    cells.forEach((txt, i) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      if (row > 5) return;
      ctx.fillStyle = txt === '陳' ? '#26221c' : '#1d2a4a';
      ctx.fillText(txt.slice(0, 3), 14 + col * 43, 34 + row * 26);
    });
    return toTex(c, { repeat: false });
  }

  function tvNews() {
    const [c, ctx] = canvas(128, 80);
    ctx.fillStyle = '#1b2c45';
    ctx.fillRect(0, 0, 128, 80);
    ctx.fillStyle = '#c5ccd6';
    ctx.fillRect(10, 12, 50, 40);
    ctx.fillStyle = '#9a2a25';
    ctx.fillRect(0, 60, 128, 20);
    ctx.fillStyle = '#fff';
    ctx.font = `11px ${FONT_SANS}`;
    ctx.fillText('福安大廈 今晚', 4, 74);
    ctx.font = `9px ${FONT_MONO}`;
    ctx.fillText('2016/10/13', 74, 12);
    return toTex(c, { repeat: false });
  }

  function poster() {
    const [c, ctx] = canvas(96, 128);
    ctx.fillStyle = '#f1ead2';
    ctx.fillRect(0, 0, 96, 128);
    ctx.fillStyle = '#b3241d';
    ctx.fillRect(0, 0, 96, 26);
    ctx.fillStyle = '#fff3c4';
    ctx.font = `bold 15px ${FONT_SERIF}`;
    ctx.fillText('金榜題名', 16, 18);
    ctx.fillStyle = '#2a2520';
    ctx.font = `10px ${FONT_SERIF}`;
    const names = ['林○○ 建中', '王○○ 北一', '陳○○ 師大附中', '張○○ 成功', '李○○ 中山', '黃○○ 松山'];
    names.forEach((n, i) => ctx.fillText(n, 8, 44 + i * 13));
    ctx.font = `9px ${FONT_MONO}`;
    ctx.fillText('2016', 60, 122);
    return toTex(c, { repeat: false });
  }

  function directory() {
    return label(
      [
        { text: '福安大廈　樓層指引', size: 20 },
        { text: '6F　機房', size: 15 },
        { text: '5F　招租中', size: 15 },
        { text: '3F　明日之星補習班', size: 15 },
        { text: '2F　安心牙醫診所', size: 15 },
        { text: '1F　管理室', size: 15 },
        { text: 'B1　停車場', size: 15 },
      ],
      { w: 160, h: 192, bg: '#20262b', fg: '#d9d4c4', border: '#8a8577', align: 'left', pad: 14 },
    );
  }

  function elevatorPanel(with7) {
    const [c, ctx] = canvas(64, 128);
    ctx.fillStyle = '#9da2a3';
    ctx.fillRect(0, 0, 64, 128);
    const keys = with7 ? ['7', '6', '5', '3', '2', '1', 'B1'] : ['6', '5', '3', '2', '1', 'B1'];
    ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    keys.forEach((k, i) => {
      const y = 14 + i * 15;
      ctx.fillStyle = k === '7' ? '#e3b04a' : '#d9dcdc';
      ctx.beginPath();
      ctx.arc(32, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillText(k, 32, y + 0.5);
    });
    ctx.fillStyle = '#d9dcdc';
    ctx.fillRect(18, 116, 28, 8);
    return toTex(c, { repeat: false });
  }

  function mailboxes() {
    const [c, ctx] = canvas(128, 96);
    ctx.fillStyle = '#9b9a8f';
    ctx.fillRect(0, 0, 128, 96);
    ctx.font = `9px ${FONT_MONO}`;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 6; x++) {
        ctx.fillStyle = '#7c7b72';
        ctx.fillRect(4 + x * 20, 4 + y * 23, 18, 21);
        ctx.fillStyle = '#2a2a26';
        ctx.fillRect(7 + x * 20, 8 + y * 23, 12, 2);
        const floor = [6, 5, 3, 2][y];
        ctx.fillText(`${floor}0${x + 1}`, 6 + x * 20, 22 + y * 23);
      }
    }
    return toTex(c, { repeat: false });
  }

  function paperFace() {
    const [c, ctx] = canvas(64, 80);
    ctx.fillStyle = '#e4ddc8';
    ctx.fillRect(0, 0, 64, 80);
    ctx.fillStyle = '#3a342b';
    for (let y = 8; y < 76; y += 6) {
      const w = 30 + ((y * 7) % 20);
      ctx.fillRect(8, y, w, 2);
    }
    ctx.fillStyle = '#a3241b';
    ctx.font = `10px ${FONT_SERIF}`;
    ctx.fillText('第九條', 8, 40);
    ctx.clearRect(44, 34, 20, 14);
    ctx.fillStyle = 'rgba(80,70,50,0.35)';
    ctx.beginPath();
    ctx.arc(20, 28, 5, 0, Math.PI * 2);
    ctx.arc(42, 28, 5, 0, Math.PI * 2);
    ctx.fill();
    return toTex(c, { repeat: false });
  }

  function chenSign() {
    return label([{ text: '五點', size: 44, font: FONT_HAND, color: '#a3241b' }], { w: 128, h: 64, bg: '#efe9d8' });
  }

  return {
    FONT_SERIF, FONT_HAND, FONT_MONO, FONT_SANS,
    tile, wall, ceiling, concrete, carpet, metal, wood, cloth, shutter, city, sky, smoke,
    label, floorSign, exitSign, punchClock, handwriting, whiteboard, logbook, roster,
    tvNews, poster, directory, elevatorPanel, mailboxes, paperFace, chenSign,
  };
})();
