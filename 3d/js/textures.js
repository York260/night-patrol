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
    ctx.fillText('第五條', 8, 40);
    ctx.clearRect(44, 34, 20, 14);
    // 角落一個反過來的公司章
    ctx.save();
    ctx.translate(50, 66);
    ctx.scale(-1, 1);
    ctx.strokeStyle = 'rgba(163,36,27,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `6px ${FONT_SERIF}`;
    ctx.fillText('福安', -6, 2);
    ctx.restore();
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

  /* ---------------------------------------------------------------- 人物 */

  const SKIN = { chen: '#8a7364', boss: '#957b6a', child: '#a3897a', woman: '#9b8a80', self: '#8c776a', guard: '#8a7466', blank: '#5b504a', dark: '#1d1a19' };
  const faceCache = {};

  /**
   * 頭部貼圖（128×64，等距柱狀投影）：臉的中心在 u = 0.25，正對 +z。
   * kind：chen | boss | child | woman | self | guard | blank | dark
   */
  function face(kind) {
    if (faceCache[kind]) return faceCache[kind];
    const [c, ctx] = canvas(128, 64);
    const r = rng(kind.length * 97);
    const skin = SKIN[kind] || SKIN.blank;
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, 128, 64);
    // 側臉陰影與下巴
    const sh = ctx.createLinearGradient(0, 0, 128, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.25)');
    sh.addColorStop(0.25, 'rgba(0,0,0,0)');
    sh.addColorStop(0.5, 'rgba(0,0,0,0.3)');
    sh.addColorStop(0.75, 'rgba(0,0,0,0.35)');
    sh.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, 128, 64);
    speckle(ctx, 128, 64, r, 260, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.05)']);
    const cx = 32;
    const hair = (color, top, back, sides = 0) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 128, top);
      ctx.fillRect(56, 0, 72, back);
      if (sides) {
        ctx.fillRect(cx - 17, 0, 4, sides);
        ctx.fillRect(cx + 13, 0, 4, sides);
      }
      speckle(ctx, 128, Math.max(top, back), r, 200, ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.2)']);
    };
    const eyes = (y, w, h, color = '#1a1412', gap = 7) => {
      ctx.fillStyle = color;
      ctx.fillRect(cx - gap - w, y, w, h);
      ctx.fillRect(cx + gap, y, w, h);
    };
    const brows = (y, color = '#2a221d') => {
      ctx.fillStyle = color;
      ctx.fillRect(cx - 13, y, 7, 1);
      ctx.fillRect(cx + 6, y, 7, 1);
    };
    const mouth = (y, w, color = '#4a2e28') => {
      ctx.fillStyle = color;
      ctx.fillRect(cx - w / 2, y, w, 1);
    };
    const nose = (y) => {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(cx - 1, y, 2, 6);
      ctx.fillRect(cx - 3, y + 5, 6, 1);
    };
    if (kind === 'chen') {
      hair('#2b2a28', 15, 34, 22);
      speckle(ctx, 128, 15, r, 60, ['#6d6a64']); // 白頭髮
      brows(22);
      eyes(26, 5, 2);
      ctx.fillStyle = 'rgba(40,20,20,0.35)';
      ctx.fillRect(cx - 13, 29, 6, 2); // 黑眼圈
      ctx.fillRect(cx + 7, 29, 6, 2);
      nose(27);
      mouth(40, 9);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = 'rgba(30,25,22,0.45)';
        ctx.fillRect(cx - 12 + r() * 24, 36 + r() * 12, 1, 1); // 鬍渣
      }
    } else if (kind === 'boss') {
      hair('#1d1c1b', 12, 30, 18);
      ctx.fillStyle = skin;
      ctx.fillRect(cx - 4, 4, 14, 8); // 髮線後退
      brows(22, '#1b1715');
      ctx.strokeStyle = '#161616';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 14, 24, 9, 6);
      ctx.strokeRect(cx + 5, 24, 9, 6);
      ctx.beginPath();
      ctx.moveTo(cx - 5, 26);
      ctx.lineTo(cx + 5, 26);
      ctx.stroke();
      eyes(26, 4, 2);
      nose(28);
      mouth(41, 11, '#3a2622');
    } else if (kind === 'child') {
      hair('#151313', 22, 40, 26);
      ctx.fillStyle = skin;
      ctx.fillRect(cx - 12, 18, 24, 6);
      ctx.fillStyle = '#151313';
      for (let i = 0; i < 6; i++) ctx.fillRect(cx - 12 + i * 4, 18, 3, 3 + (i % 2) * 2); // 瀏海
      ctx.fillStyle = '#060505';
      ctx.beginPath();
      ctx.ellipse(cx - 7, 30, 3.5, 4.5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 7, 30, 3.5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      mouth(42, 4, '#3a2020');
    } else if (kind === 'woman') {
      hair('#0d0c0c', 26, 64, 64);
      eyes(30, 4, 2, '#050404');
      ctx.fillStyle = '#0d0c0c';
      for (let i = 0; i < 9; i++) ctx.fillRect(cx - 14 + i * 3.4 + r() * 2, 0, 1 + Math.floor(r() * 2), 40 + r() * 24); // 蓋住臉的頭髮
      mouth(44, 6, '#3d2222');
    } else if (kind === 'self') {
      hair('#1d1b1a', 14, 32, 20);
      brows(22);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(cx - 9, 27, 4, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 9, 27, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      nose(28);
      ctx.strokeStyle = '#3a2420';
      ctx.beginPath();
      ctx.moveTo(cx - 7, 40);
      ctx.quadraticCurveTo(cx, 44, cx + 7, 40); // 微笑
      ctx.stroke();
    } else if (kind === 'guard') {
      hair('#1f1e1c', 14, 32, 20);
      brows(22);
      ctx.fillStyle = '#1a1412';
      ctx.fillRect(cx - 12, 27, 6, 1); // 閉著眼
      ctx.fillRect(cx + 6, 27, 6, 1);
      nose(28);
      mouth(41, 8);
    } else if (kind === 'dark') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, 128, 64);
    } else {
      // 沒有五官
      hair('#151413', 14, 34);
      const g = ctx.createRadialGradient(cx, 30, 2, cx, 30, 16);
      g.addColorStop(0, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 16, 14, 32, 34);
    }
    faceCache[kind] = toTex(c, { repeat: false });
    return faceCache[kind];
  }

  const clothCache = {};
  function clothing(kind) {
    if (clothCache[kind]) return clothCache[kind];
    const [c, ctx] = canvas(64, 64);
    const r = rng(kind.length * 31);
    if (kind === 'uniform') {
      ctx.fillStyle = '#2b3546';
      ctx.fillRect(0, 0, 64, 64);
      speckle(ctx, 64, 64, r, 300, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.12)']);
      ctx.fillStyle = '#1f2734';
      ctx.fillRect(0, 0, 2, 64);
      ctx.fillRect(62, 0, 2, 64); // 門襟（u=0 正面）
      ctx.fillStyle = '#c9c2a8';
      for (let y = 10; y < 60; y += 10) {
        ctx.fillRect(0, y, 2, 2);
        ctx.fillRect(62, y, 2, 2);
      }
      ctx.strokeStyle = '#1b2230';
      ctx.strokeRect(5, 22, 9, 8);
      ctx.strokeRect(50, 22, 9, 8); // 口袋
      ctx.fillStyle = '#a99a62';
      ctx.fillRect(8, 16, 4, 3); // 臂章
    } else if (kind === 'suit') {
      ctx.fillStyle = '#26272b';
      ctx.fillRect(0, 0, 64, 64);
      speckle(ctx, 64, 64, r, 300, ['rgba(255,255,255,0.04)', 'rgba(0,0,0,0.12)']);
      ctx.fillStyle = '#d9d6cc';
      ctx.beginPath();
      ctx.moveTo(0, 64);
      ctx.lineTo(0, 30);
      ctx.lineTo(7, 64);
      ctx.moveTo(64, 64);
      ctx.lineTo(64, 30);
      ctx.lineTo(57, 64);
      ctx.fill();
      ctx.fillStyle = '#6b1d1a';
      ctx.fillRect(0, 34, 2, 30);
      ctx.fillRect(62, 34, 2, 30); // 領帶
    } else if (kind === 'pajama') {
      ctx.fillStyle = '#9fb3c4';
      ctx.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += 6) {
        ctx.fillStyle = '#7f95a8';
        ctx.fillRect(x, 0, 2, 64);
      }
      blotch(ctx, 64, 64, r, 3, 'rgba(60,50,40,0.3)', 12);
    } else if (kind === 'school') {
      ctx.fillStyle = '#d8d6cf';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#9a9890';
      for (let y = 10; y < 64; y += 12) {
        ctx.fillRect(0, y, 2, 2);
        ctx.fillRect(62, y, 2, 2);
      }
      ctx.fillStyle = '#2a3a6a';
      ctx.fillRect(10, 18, 8, 3); // 學號繡線
    } else {
      // 其他人：褪色的舊衣服
      const tones = ['#3c3a36', '#2f3438', '#40362f', '#33302e'];
      ctx.fillStyle = tones[kind.length % tones.length];
      ctx.fillRect(0, 0, 64, 64);
      speckle(ctx, 64, 64, r, 400, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.15)']);
    }
    clothCache[kind] = toTex(c);
    return clothCache[kind];
  }

  /* ---------------------------------------------------------------- 場景細節 */

  function stain(seed = 1) {
    const [c, ctx] = canvas(64, 64);
    const r = rng(seed);
    for (let i = 0; i < 6; i++) {
      const x = 20 + r() * 24;
      const y = 20 + r() * 24;
      const rad = 8 + r() * 18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(70,52,30,0.55)');
      g.addColorStop(0.7, 'rgba(70,52,30,0.25)');
      g.addColorStop(1, 'rgba(70,52,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    return toTex(c, { repeat: false, nearest: false });
  }

  function talisman(seed = 1) {
    const [c, ctx] = canvas(32, 128);
    const r = rng(seed);
    ctx.fillStyle = '#d8b84a';
    ctx.fillRect(0, 0, 32, 128);
    blotch(ctx, 32, 128, r, 3, 'rgba(120,80,20,0.3)', 14);
    ctx.fillStyle = '#9e1c14';
    ctx.font = `bold 15px ${FONT_SERIF}`;
    ctx.textAlign = 'center';
    ['敕', '令', '鎮'].forEach((ch, i) => ctx.fillText(ch, 16, 20 + i * 18));
    ctx.strokeStyle = '#9e1c14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let y = 66;
    ctx.moveTo(16, y);
    while (y < 120) {
      y += 6;
      ctx.lineTo(8 + r() * 16, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(16, 74, 6, 0, Math.PI * 2);
    ctx.stroke();
    return toTex(c, { repeat: false });
  }

  function clockFace(h = 3, m = 0) {
    const [c, ctx] = canvas(64, 64);
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(32, 32, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ece6d4';
    ctx.beginPath();
    ctx.arc(32, 32, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillRect(32 + Math.sin(a) * 23 - 1, 32 - Math.cos(a) * 23 - 1, 2, 2);
    }
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    const ha = ((h % 12) / 12 + m / 720) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.lineTo(32 + Math.sin(ha) * 13, 32 - Math.cos(ha) * 13);
    ctx.stroke();
    ctx.lineWidth = 2;
    const ma = (m / 60) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.lineTo(32 + Math.sin(ma) * 20, 32 - Math.cos(ma) * 20);
    ctx.stroke();
    return toTex(c, { repeat: false });
  }

  function notices() {
    const [c, ctx] = canvas(192, 128);
    const r = rng(77);
    ctx.fillStyle = '#7a5c3c';
    ctx.fillRect(0, 0, 192, 128);
    speckle(ctx, 192, 128, r, 800, ['#6b5034', '#8a6a48']);
    const paper = (x, y, w, h, rot, lines, accent) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = '#ece6d4';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = accent || '#26221c';
      ctx.font = `bold 11px ${FONT_SERIF}`;
      ctx.fillText(lines[0], 6, 14);
      ctx.fillStyle = '#3a342b';
      ctx.font = `8px ${FONT_SERIF}`;
      lines.slice(1).forEach((l, i) => ctx.fillText(l, 6, 28 + i * 11));
      ctx.fillStyle = '#b3241d';
      ctx.beginPath();
      ctx.arc(w / 2, 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    paper(8, 8, 82, 62, -0.05, ['住戶公告', '本大樓夜間', '不開放出入', '管理室 啟'], '#8a1c16');
    paper(100, 12, 82, 54, 0.06, ['失物招領', '保全制服一件', '名牌：陳', '請洽管理室']);
    paper(30, 74, 96, 46, 0.03, ['電梯保養', '本週電梯', '不停 4 樓'], '#26221c');
    paper(134, 72, 48, 50, -0.08, ['尋人', '…', '…']);
    return toTex(c, { repeat: false });
  }

  function drawings() {
    const [c, ctx] = canvas(192, 96);
    ctx.fillStyle = '#6e5539';
    ctx.fillRect(0, 0, 192, 96);
    const pic = (x, y, rot, fn) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = '#f4f0e4';
      ctx.fillRect(0, 0, 54, 42);
      fn();
      ctx.restore();
    };
    pic(6, 8, -0.04, () => {
      ctx.strokeStyle = '#2a4a8a';
      for (let i = 0; i < 7; i++) ctx.strokeRect(18, 36 - i * 5, 16, 5);
      ctx.fillStyle = '#c02a20';
      ctx.fillRect(24, 3, 4, 3);
    });
    pic(68, 12, 0.05, () => {
      ctx.fillStyle = '#111';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(8 + i * 10, 14, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(7 + i * 10, 17, 2, 14);
      }
      ctx.fillStyle = '#c02a20';
      ctx.font = `9px ${FONT_HAND}`;
      ctx.fillText('等電梯', 14, 40);
    });
    pic(130, 6, -0.02, () => {
      ctx.fillStyle = '#2b3546';
      ctx.fillRect(22, 12, 10, 20);
      ctx.beginPath();
      ctx.arc(27, 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = `8px ${FONT_HAND}`;
      ctx.fillText('七樓的叔叔', 6, 40);
    });
    return toTex(c, { repeat: false });
  }

  function photo(name) {
    const [c, ctx] = canvas(64, 96);
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(0, 0, 64, 96);
    ctx.fillStyle = '#d9d2bf';
    ctx.fillRect(5, 5, 54, 66);
    ctx.fillStyle = '#7d8a90';
    ctx.fillRect(8, 8, 48, 60);
    ctx.fillStyle = '#2b3546';
    ctx.fillRect(14, 46, 36, 22);
    ctx.fillStyle = SKIN.chen;
    ctx.beginPath();
    ctx.ellipse(32, 34, 11, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2a28';
    ctx.fillRect(21, 19, 22, 7);
    ctx.fillStyle = '#1a1412';
    ctx.fillRect(26, 33, 3, 1);
    ctx.fillRect(35, 33, 3, 1);
    ctx.fillRect(28, 41, 8, 1);
    ctx.fillStyle = '#e9e1c8';
    ctx.font = `9px ${FONT_SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillText('優良員工', 32, 82);
    ctx.fillText(name, 32, 92);
    return toTex(c, { repeat: false });
  }

  function plaque(floor, name, bg, fg) {
    return label([{ text: floor, size: 84, font: FONT_MONO, weight: '500' }, { text: name, size: 22 }], { w: 256, h: 192, bg, fg, border: fg });
  }

  function hazard() {
    const [c, ctx] = canvas(64, 16);
    ctx.fillStyle = '#d9b42c';
    ctx.fillRect(0, 0, 64, 16);
    ctx.fillStyle = '#151515';
    for (let x = -16; x < 64; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 16);
      ctx.lineTo(x + 8, 16);
      ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 8, 0);
      ctx.fill();
    }
    return toTex(c);
  }

  function ticket() {
    const [c, ctx] = canvas(96, 40);
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, 96, 40);
    ctx.fillStyle = '#ff3a2a';
    ctx.font = `bold 26px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('013', 60, 21);
    ctx.font = `10px ${FONT_SANS}`;
    ctx.fillText('叫號', 16, 21);
    return toTex(c, { repeat: false });
  }

  function banner(text, sub) {
    return label([{ text, size: 40, color: '#fff3e0' }, { text: sub, size: 14, color: '#ffd9c8', font: FONT_MONO }], { w: 192, h: 96, bg: '#a8241b' });
  }

  function wreathBanner(text) {
    const [c, ctx] = canvas(24, 128);
    ctx.fillStyle = '#efeadb';
    ctx.fillRect(0, 0, 24, 128);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `16px ${FONT_SERIF}`;
    ctx.textAlign = 'center';
    [...text].forEach((ch, i) => ctx.fillText(ch, 12, 22 + i * 24));
    return toTex(c, { repeat: false });
  }

  function nameTag(name) {
    return label([{ text: name, size: 30 }], { w: 96, h: 40, bg: '#e8e2d1', fg: '#1d2a4a', border: '#8a7a50' });
  }

  return {
    FONT_SERIF, FONT_HAND, FONT_MONO, FONT_SANS,
    tile, wall, ceiling, concrete, carpet, metal, wood, cloth, shutter, city, sky, smoke,
    label, floorSign, exitSign, punchClock, handwriting, whiteboard, logbook, roster,
    tvNews, poster, directory, elevatorPanel, mailboxes, paperFace, chenSign,
    face, clothing, stain, talisman, clockFace, notices, drawings, photo, plaque, hazard, ticket, banner, wreathBanner, nameTag,
  };
})();
