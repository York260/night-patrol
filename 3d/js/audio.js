/*
 * 夜巡守則・七樓（3D）— 程序化 3D 音效
 * 全部用 Web Audio 即時合成。定位音效走 HRTF PannerNode，戴耳機可以聽出方向。
 */
window.NP3D_AUDIO = (() => {
  'use strict';

  let ctx = null;
  let master = null;
  let worldBus = null;
  let worldLp = null;
  let winded = 0;
  let pantTimer = null;
  let sfxBus = null;
  let ambBus = null;
  let muted = false;
  const buf = {};
  const amb = {};
  let hbTimer = null;
  let hbInterval = 0;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    // 世界的聲音（有位置的）另走一條：喘氣時會被壓低、變悶，自己的聲音不受影響
    worldLp = ctx.createBiquadFilter();
    worldLp.type = 'lowpass';
    worldLp.frequency.value = 20000;
    worldBus = ctx.createGain();
    worldBus.connect(worldLp).connect(sfxBus);
    ambBus = ctx.createGain();
    ambBus.gain.value = 0.9;
    ambBus.connect(master);
    buf.white = noise(2, 'white');
    buf.brown = noise(4, 'brown');
    buf.pink = noise(3, 'pink');
    startAmbience();
  }

  function noise(seconds, type) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else if (type === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else {
        d[i] = w;
      }
    }
    return b;
  }

  function src(type, loop = false) {
    const s = ctx.createBufferSource();
    s.buffer = buf[type];
    s.loop = loop;
    return s;
  }

  function env(param, t0, peak, a, d) {
    param.cancelScheduledValues(t0);
    param.setValueAtTime(0.0001, t0);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    param.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  /** 輸出節點：有位置就接 HRTF panner，沒有就直接進 sfx bus */
  function out(pos, { ref = 1.2, roll = 1.3 } = {}) {
    if (!pos) return { node: sfxBus, panner: null };
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.maxDistance = 40;
    p.rolloffFactor = roll;
    setPannerPos(p, pos);
    p.connect(worldBus);
    return { node: p, panner: p };
  }

  function setPannerPos(p, pos) {
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = pos.y;
      p.positionZ.value = pos.z;
    } else {
      p.setPosition(pos.x, pos.y, pos.z);
    }
  }

  function setListener(pos, fwd) {
    if (!ctx) return;
    const L = ctx.listener;
    if (L.positionX) {
      const t = ctx.currentTime;
      L.positionX.setTargetAtTime(pos.x, t, 0.02);
      L.positionY.setTargetAtTime(pos.y, t, 0.02);
      L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02);
      L.forwardY.setTargetAtTime(fwd.y, t, 0.02);
      L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  function hit(t0, dest, { type = 'white', filter = 'bandpass', freq = 1000, q = 1, peak = 0.3, a = 0.004, d = 0.2, rate = 1 } = {}) {
    const s = src(type);
    s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g.gain, t0, peak, a, d);
    s.connect(f).connect(g).connect(dest);
    s.start(t0, Math.random() * 1.5);
    s.stop(t0 + a + d + 0.05);
  }

  function tone(t0, dest, { freq = 440, type = 'sine', peak = 0.1, a = 0.01, d = 0.5, glide = 1 } = {}) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glide !== 1) o.frequency.exponentialRampToValueAtTime(freq * glide, t0 + a + d);
    const g = ctx.createGain();
    env(g.gain, t0, peak, a, d);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + a + d + 0.05);
  }

  /* ---------------------------------------------------------------- 環境聲 */

  function startAmbience() {
    // 大樓底噪
    const room = src('brown', true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    room.connect(lp).connect(g).connect(ambBus);
    room.start();
    amb.roomLp = lp;
    amb.roomGain = g;

    // 日光燈 60Hz 嗡嗡聲
    const hum = ctx.createOscillator();
    hum.frequency.value = 120;
    hum.type = 'sawtooth';
    const hlp = ctx.createBiquadFilter();
    hlp.type = 'lowpass';
    hlp.frequency.value = 500;
    const hg = ctx.createGain();
    hg.gain.value = 0.006;
    hum.connect(hlp).connect(hg).connect(ambBus);
    hum.start();
    amb.humGain = hg;

    // 風
    const wind = src('pink', true);
    const wbp = ctx.createBiquadFilter();
    wbp.type = 'bandpass';
    wbp.frequency.value = 420;
    wbp.Q.value = 0.8;
    const wg = ctx.createGain();
    wg.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 180;
    lfo.connect(lfoG).connect(wbp.frequency);
    wind.connect(wbp).connect(wg).connect(ambBus);
    wind.start();
    lfo.start();
    amb.windGain = wg;

    // 恐懼持續音
    const d1 = ctx.createOscillator();
    d1.type = 'triangle';
    d1.frequency.value = 41.2;
    const d2 = ctx.createOscillator();
    d2.type = 'triangle';
    d2.frequency.value = 43.7;
    const dg = ctx.createGain();
    dg.gain.value = 0;
    d1.connect(dg);
    d2.connect(dg);
    dg.connect(ambBus);
    d1.start();
    d2.start();
    amb.droneGain = dg;

    // 雜訊層（低理智）
    const hiss = src('white', true);
    const hhp = ctx.createBiquadFilter();
    hhp.type = 'highpass';
    hhp.frequency.value = 3000;
    const hsg = ctx.createGain();
    hsg.gain.value = 0;
    hiss.connect(hhp).connect(hsg).connect(ambBus);
    hiss.start();
    amb.hissGain = hsg;
  }

  /** kind: building | parking | wind | void；lights：日光燈是否亮著 */
  function setAmbience(kind, lights) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const room = { building: 0.2, parking: 0.32, wind: 0.16, void: 0.05, guard: 0.18 }[kind] ?? 0.2;
    amb.roomGain.gain.setTargetAtTime(room, t, 0.8);
    amb.roomLp.frequency.setTargetAtTime(kind === 'parking' ? 260 : 380, t, 0.8);
    amb.humGain.gain.setTargetAtTime(lights ? 0.006 : 0, t, 0.2);
    amb.windGain.gain.setTargetAtTime(kind === 'wind' ? 0.12 : 0, t, 1.2);
  }

  function setTension(san) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const fear = 1 - Math.max(0, Math.min(100, san)) / 100;
    amb.droneGain.gain.setTargetAtTime(fear * fear * 0.1, t, 2);
    amb.hissGain.gain.setTargetAtTime(fear > 0.7 ? (fear - 0.7) * 0.04 : 0, t, 1);
    const interval = san < 35 ? 520 + san * 16 : 0;
    if (interval !== hbInterval) {
      hbInterval = interval;
      clearInterval(hbTimer);
      hbTimer = interval ? setInterval(heartbeat, interval) : null;
    }
  }

  function heartbeat() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    tone(t, sfxBus, { freq: 58, peak: 0.32, a: 0.005, d: 0.16, glide: 0.6 });
    tone(t + 0.22, sfxBus, { freq: 52, peak: 0.22, a: 0.005, d: 0.2, glide: 0.6 });
  }

  /* ---------------------------------------------------------------- 單次音效 */

  const SFX = {
    step(dest, { mat = 'tile', gain = 1, rate = 1 } = {}) {
      const t = ctx.currentTime;
      const cfg = {
        tile: { freq: 1800, q: 1.4, peak: 0.07 },
        concrete: { freq: 900, q: 0.9, peak: 0.09 },
        carpet: { freq: 500, q: 0.7, peak: 0.04 },
        metal: { freq: 2600, q: 3, peak: 0.06 },
      }[mat] || { freq: 1500, q: 1, peak: 0.06 };
      hit(t, dest, { freq: cfg.freq * (0.9 + Math.random() * 0.2), q: cfg.q, peak: cfg.peak * gain, d: 0.07, rate });
      tone(t, dest, { freq: 90, peak: 0.05 * gain, a: 0.003, d: 0.06, glide: 0.6 });
    },
    heavyStep(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { type: 'brown', filter: 'lowpass', freq: 300, peak: 0.9, d: 0.18 });
      tone(t, dest, { freq: 60, peak: 0.3, a: 0.004, d: 0.2, glide: 0.5 });
      hit(t + 0.05, dest, { freq: 3200, q: 6, peak: 0.03, d: 0.25 }); // 紙張摩擦
    },
    knock(dest) {
      const t = ctx.currentTime + 0.05;
      [0, 0.33, 0.66].forEach((dt) => {
        hit(t + dt, dest, { type: 'brown', filter: 'lowpass', freq: 400, peak: 1.1, d: 0.12 });
        tone(t + dt, dest, { freq: 100, peak: 0.45, a: 0.003, d: 0.12, glide: 0.6 });
      });
    },
    ring(dest) {
      const t0 = ctx.currentTime + 0.05;
      const g = ctx.createGain();
      g.gain.value = 0;
      const am = ctx.createOscillator();
      am.type = 'square';
      am.frequency.value = 20;
      const amd = ctx.createGain();
      amd.gain.value = 0.06;
      am.connect(amd).connect(g.gain);
      g.gain.setValueAtTime(0.07, t0);
      g.gain.setValueAtTime(0, t0 + 1.1);
      [440, 480].forEach((f) => {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        o.connect(g);
        o.start(t0);
        o.stop(t0 + 1.15);
      });
      g.connect(dest);
      am.start(t0);
      am.stop(t0 + 1.15);
    },
    ding(dest) {
      const t = ctx.currentTime;
      tone(t, dest, { freq: 1318.5, peak: 0.14, d: 1.4 });
      tone(t + 0.42, dest, { freq: 1046.5, peak: 0.14, d: 1.6 });
    },
    slide(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { type: 'pink', filter: 'bandpass', freq: 700, q: 2, peak: 0.12, a: 0.2, d: 0.9 });
      tone(t + 1.05, dest, { freq: 80, peak: 0.12, a: 0.004, d: 0.12 });
    },
    motor(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { type: 'brown', filter: 'lowpass', freq: 180, peak: 0.5, a: 0.6, d: 2.8 });
      tone(t, dest, { freq: 55, type: 'sawtooth', peak: 0.03, a: 0.6, d: 2.8 });
    },
    punch(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { freq: 2400, q: 3, peak: 0.2, d: 0.05 });
      hit(t + 0.08, dest, { type: 'brown', filter: 'lowpass', freq: 600, peak: 0.6, d: 0.1 });
      tone(t + 0.08, dest, { freq: 150, peak: 0.1, a: 0.002, d: 0.1 });
    },
    static(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { filter: 'highpass', freq: 1500, peak: 0.16, a: 0.01, d: 0.8 });
      hit(t + 0.2, dest, { freq: 3200, q: 4, peak: 0.1, d: 0.35 });
    },
    sting(dest) {
      const t = ctx.currentTime;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(250, t);
      lp.frequency.exponentialRampToValueAtTime(2400, t + 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      lp.connect(g).connect(dest);
      [98, 103.8, 146.8, 207.7].forEach((f) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(lp);
        o.start(t);
        o.stop(t + 3.1);
      });
    },
    scare(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { filter: 'highpass', freq: 800, peak: 0.5, a: 0.003, d: 0.9 });
      [233, 247, 311, 466].forEach((f) => tone(t, dest, { freq: f, type: 'sawtooth', peak: 0.06, a: 0.01, d: 1.4, glide: 0.92 }));
      tone(t, dest, { freq: 50, peak: 0.6, a: 0.003, d: 0.5, glide: 0.5 });
    },
    page(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { freq: 2600, q: 0.7, peak: 0.09, a: 0.03, d: 0.2 });
    },
    scrape(dest) {
      const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) hit(t + i * 0.9, dest, { freq: 3800 + i * 300, q: 9, peak: 0.12, a: 0.3, d: 0.5 });
    },
    door(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { freq: 900, q: 12, peak: 0.1, a: 0.4, d: 0.8 });
      tone(t + 1.1, dest, { freq: 70, peak: 0.3, a: 0.003, d: 0.3 });
    },
    slam(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { type: 'brown', filter: 'lowpass', freq: 500, peak: 1.2, d: 0.35 });
      tone(t, dest, { freq: 65, peak: 0.5, a: 0.003, d: 0.35, glide: 0.6 });
    },
    lock(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { freq: 3000, q: 5, peak: 0.15, d: 0.04 });
      hit(t + 0.12, dest, { freq: 2000, q: 5, peak: 0.18, d: 0.06 });
    },
    click(dest) {
      tone(ctx.currentTime, dest, { freq: 1600, peak: 0.04, a: 0.002, d: 0.03 });
    },
    flashlight(dest) {
      const t = ctx.currentTime;
      hit(t, dest, { freq: 4000, q: 3, peak: 0.12, d: 0.025 });
    },
    chalk(dest) {
      const t = ctx.currentTime;
      for (let i = 0; i < 4; i++) hit(t + i * 0.18, dest, { freq: 5200, q: 8, peak: 0.08, a: 0.02, d: 0.12 });
    },
    laugh(dest) {
      const t = ctx.currentTime;
      for (let i = 0; i < 9; i++) {
        const f = 180 + Math.random() * 220;
        tone(t + i * 0.13 + Math.random() * 0.05, dest, { freq: f, type: 'sawtooth', peak: 0.025, a: 0.01, d: 0.12, glide: 0.8 });
      }
    },
    drip(dest) {
      tone(ctx.currentTime, dest, { freq: 1200 + Math.random() * 600, peak: 0.05, a: 0.002, d: 0.12, glide: 0.4 });
    },
    chime(dest) {
      const t = ctx.currentTime;
      tone(t, dest, { freq: 880, peak: 0.05, d: 0.3 });
      tone(t + 0.18, dest, { freq: 880, peak: 0.05, d: 0.3 });
    },
    sms(dest) {
      const t = ctx.currentTime;
      tone(t, dest, { freq: 1568, peak: 0.06, d: 0.12 });
      tone(t + 0.15, dest, { freq: 2093, peak: 0.06, d: 0.2 });
    },
  };

  function play(name, pos = null, opts = {}) {
    if (!ctx || muted || !SFX[name]) return;
    try {
      const o = out(pos, opts);
      SFX[name](o.node, opts);
    } catch (err) {
      console.warn('sfx', name, err);
    }
  }

  /** 像人在說話的含糊低語，沒有實際字詞（字幕負責意思） */
  const VOICES = {
    man: { f0: 110, formants: [500, 1400], gain: 0.5 },
    boss: { f0: 100, formants: [450, 1200], gain: 0.5 },
    chen: { f0: 92, formants: [420, 1100], gain: 0.5 },
    woman: { f0: 210, formants: [650, 1800], gain: 0.45 },
    child: { f0: 290, formants: [800, 2200], gain: 0.4 },
    self: { f0: 150, formants: [560, 1500], gain: 0.45 },
    many: { f0: 130, formants: [520, 1500], gain: 0.35, crowd: 3 },
  };

  function voice(kind, seconds, pos = null) {
    if (!ctx || muted) return;
    const v = VOICES[kind] || VOICES.man;
    const o = out(pos, { ref: 1.5, roll: 1.1 });
    const t0 = ctx.currentTime + 0.05;
    const n = Math.max(2, Math.round(seconds * 4.5));
    const copies = v.crowd || 1;
    for (let c = 0; c < copies; c++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const f0 = v.f0 * (1 + (c - 1) * 0.07);
      osc.frequency.setValueAtTime(f0, t0);
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.Q.value = 6;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.Q.value = 8;
      const g = ctx.createGain();
      g.gain.value = 0;
      const mix = ctx.createGain();
      mix.gain.value = v.gain * 0.5;
      osc.connect(f1).connect(g);
      osc.connect(f2).connect(g);
      g.connect(mix).connect(o.node);
      let t = t0 + c * 0.07;
      for (let i = 0; i < n; i++) {
        const dur = 0.12 + Math.random() * 0.12;
        f1.frequency.setValueAtTime(v.formants[0] * (0.8 + Math.random() * 0.5), t);
        f2.frequency.setValueAtTime(v.formants[1] * (0.8 + Math.random() * 0.5), t);
        osc.frequency.setTargetAtTime(f0 * (0.9 + Math.random() * 0.25), t, 0.03);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        t += dur + 0.02 + (Math.random() < 0.15 ? 0.15 : 0);
      }
      osc.start(t0);
      osc.stop(t + 0.1);
    }
  }

  /** 循環音效（電話鈴、引擎、呼吸），回傳可以停止、可以移動的控制物件 */
  function loop(name, pos = null, opts = {}) {
    if (!ctx) return { stop() {}, setPos() {} };
    const o = out(pos, opts);
    let alive = true;
    let timer = null;
    const nodes = [];
    if (name === 'ring') {
      const fire = () => {
        if (!alive) return;
        if (!muted) SFX.ring(o.node);
        timer = setTimeout(fire, 2600);
      };
      fire();
    } else if (name === 'engine') {
      const s = src('brown', true);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 140;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      s.connect(lp).connect(g).connect(o.node);
      s.start();
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 38;
      const og = ctx.createGain();
      og.gain.value = 0.02;
      osc.connect(og).connect(o.node);
      osc.start();
      nodes.push(s, osc);
    } else if (name === 'machine') {
      const s = src('brown', true);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 220;
      bp.Q.value = 2;
      const g = ctx.createGain();
      g.gain.value = 0.6;
      s.connect(bp).connect(g).connect(o.node);
      s.start();
      nodes.push(s);
    } else if (name === 'breath') {
      const fire = () => {
        if (!alive) return;
        if (!muted) {
          const t = ctx.currentTime;
          hit(t, o.node, { type: 'pink', filter: 'bandpass', freq: 600, q: 1.5, peak: 0.25, a: 0.5, d: 0.7 });
        }
        timer = setTimeout(fire, 1900 + Math.random() * 600);
      };
      fire();
    } else if (name === 'whisper') {
      const fire = () => {
        if (!alive) return;
        voice('many', 1.6, null);
        timer = setTimeout(fire, 2600 + Math.random() * 1600);
      };
      fire();
    } else if (name === 'tv') {
      const s = src('white', true);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2400;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      s.connect(bp).connect(g).connect(o.node);
      s.start();
      nodes.push(s);
    }
    return {
      stop() {
        alive = false;
        clearTimeout(timer);
        nodes.forEach((n) => {
          try {
            n.stop();
          } catch {
            /* 已停止 */
          }
        });
        if (o.panner) setTimeout(() => o.panner.disconnect(), 3000);
      },
      setPos(p) {
        if (o.panner) setPannerPos(o.panner, p);
      },
    };
  }

  /**
   * 喘氣程度 0–1：跑完會喘，喘氣聲蓋過四周（有位置的聲音變小、變悶）。
   * 自己的腳步與喘氣不受影響。
   */
  function setWinded(k) {
    k = Math.max(0, Math.min(1, k || 0));
    if (!ctx || Math.abs(k - winded) < 0.02) return;
    winded = k;
    const t = ctx.currentTime;
    worldBus.gain.setTargetAtTime(1 - 0.72 * k, t, 0.15);
    worldLp.frequency.setTargetAtTime(650 * Math.pow(20000 / 650, 1 - k), t, 0.15);
    if (k > 0.1 && !pantTimer) pant();
  }

  function pant() {
    if (winded <= 0.1) {
      pantTimer = null;
      return;
    }
    if (!muted) {
      const t = ctx.currentTime;
      const peak = 0.08 + winded * 0.16;
      hit(t, sfxBus, { type: 'pink', filter: 'bandpass', freq: 1100, q: 1.2, peak, a: 0.05, d: 0.22 });
      hit(t + 0.3, sfxBus, { type: 'pink', filter: 'bandpass', freq: 700, q: 1.0, peak: peak * 1.2, a: 0.04, d: 0.3 });
    }
    pantTimer = setTimeout(pant, 900 - winded * 380);
  }

  function setMuted(v) {
    muted = v;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.1);
  }

  return {
    init, play, voice, loop, setListener, setAmbience, setTension, setMuted, setWinded,
    get muted() {
      return muted;
    },
    get ready() {
      return !!ctx;
    },
  };
})();
