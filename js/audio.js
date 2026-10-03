/*
 * 夜巡守則 — 程序化音效
 *
 * 全部用 Web Audio API 即時合成，不需要任何音檔。
 * 瀏覽器規定聲音必須在玩家互動後才能開始，所以 init() 要在點擊事件裡呼叫。
 */
window.NPAudio = (() => {
  'use strict';

  let ctx = null;
  let master = null;
  let ambLowpass = null;
  let ambGain = null;
  let droneGain = null;
  let muted = false;
  let heartbeatTimer = null;
  let heartbeatInterval = 0;
  const buffers = {};

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    buffers.white = makeNoise(2, 'white');
    buffers.brown = makeNoise(4, 'brown');
    startAmbient();
  }

  function makeNoise(seconds, type) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        d[i] = w;
      }
    }
    return buf;
  }

  function noiseSource(type, loop = false) {
    const src = ctx.createBufferSource();
    src.buffer = buffers[type];
    src.loop = loop;
    return src;
  }

  /* 大樓的底噪：低頻空調聲＋60Hz 日光燈嗡嗡聲＋一條很低的持續音 */
  function startAmbient() {
    const room = noiseSource('brown', true);
    ambLowpass = ctx.createBiquadFilter();
    ambLowpass.type = 'lowpass';
    ambLowpass.frequency.value = 420;
    ambGain = ctx.createGain();
    ambGain.gain.value = 0.22;
    room.connect(ambLowpass).connect(ambGain).connect(master);
    room.start();

    const hum = ctx.createOscillator();
    hum.frequency.value = 60;
    const hum2 = ctx.createOscillator();
    hum2.frequency.value = 120;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.012;
    const flicker = ctx.createOscillator();
    flicker.frequency.value = 0.13;
    const flickerDepth = ctx.createGain();
    flickerDepth.gain.value = 0.006;
    flicker.connect(flickerDepth).connect(humGain.gain);
    hum.connect(humGain);
    hum2.connect(humGain);
    humGain.connect(master);
    hum.start();
    hum2.start();
    flicker.start();

    const drone = ctx.createOscillator();
    drone.type = 'triangle';
    drone.frequency.value = 41.2;
    const drone2 = ctx.createOscillator();
    drone2.type = 'triangle';
    drone2.frequency.value = 41.9;
    droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    drone.connect(droneGain);
    drone2.connect(droneGain);
    droneGain.connect(master);
    drone.start();
    drone2.start();
  }

  /* 依理智值調整氣氛：越低，底噪越亮、持續音越明顯，並加入心跳 */
  function setTension(san) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const fear = 1 - Math.max(0, Math.min(100, san)) / 100;
    ambLowpass.frequency.setTargetAtTime(420 + fear * 900, t, 1.5);
    droneGain.gain.setTargetAtTime(fear * fear * 0.09, t, 2);
    const interval = san < 35 ? 600 + san * 18 : 0;
    if (interval !== heartbeatInterval) {
      heartbeatInterval = interval;
      clearInterval(heartbeatTimer);
      heartbeatTimer = interval ? setInterval(heartbeat, interval) : null;
    }
  }

  function env(param, t0, peak, attack, decay) {
    param.cancelScheduledValues(t0);
    param.setValueAtTime(0.0001, t0);
    param.exponentialRampToValueAtTime(peak, t0 + attack);
    param.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function thump(t0, freq, peak, decay) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, t0 + decay);
    const g = ctx.createGain();
    env(g.gain, t0, peak, 0.005, decay);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + decay + 0.05);
  }

  function noiseHit(t0, { type = 'white', filter = 'bandpass', freq = 1000, q = 1, peak = 0.3, attack = 0.005, decay = 0.2 } = {}) {
    const src = noiseSource(type);
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g.gain, t0, peak, attack, decay);
    src.connect(f).connect(g).connect(master);
    src.start(t0, Math.random());
    src.stop(t0 + attack + decay + 0.05);
  }

  function heartbeat() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    thump(t, 58, 0.35, 0.16);
    thump(t + 0.22, 52, 0.25, 0.2);
  }

  const SFX = {
    knock() {
      const t = ctx.currentTime + 0.4;
      [0, 0.34, 0.68, 1.9, 2.24, 2.58].forEach((dt) => {
        noiseHit(t + dt, { type: 'brown', filter: 'lowpass', freq: 380, peak: 0.9, decay: 0.12 });
        thump(t + dt, 95, 0.4, 0.12);
      });
    },
    ring() {
      const t0 = ctx.currentTime + 0.2;
      for (let r = 0; r < 2; r++) {
        const start = t0 + r * 2.6;
        const g = ctx.createGain();
        g.gain.value = 0;
        const am = ctx.createOscillator();
        am.type = 'square';
        am.frequency.value = 20;
        const amDepth = ctx.createGain();
        amDepth.gain.value = 0.05;
        am.connect(amDepth).connect(g.gain);
        g.gain.setValueAtTime(0.06, start);
        g.gain.setValueAtTime(0, start + 1.2);
        [440, 480].forEach((f) => {
          const o = ctx.createOscillator();
          o.frequency.value = f;
          o.connect(g);
          o.start(start);
          o.stop(start + 1.25);
        });
        g.connect(master);
        am.start(start);
        am.stop(start + 1.25);
      }
    },
    ding() {
      const t = ctx.currentTime + 0.1;
      [[1318.5, 0], [1046.5, 0.45]].forEach(([f, dt]) => {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        const g = ctx.createGain();
        env(g.gain, t + dt, 0.12, 0.01, 1.6);
        o.connect(g).connect(master);
        o.start(t + dt);
        o.stop(t + dt + 1.7);
      });
    },
    static() {
      const t = ctx.currentTime;
      noiseHit(t, { filter: 'highpass', freq: 1800, peak: 0.12, attack: 0.01, decay: 0.7 });
      noiseHit(t + 0.25, { filter: 'bandpass', freq: 3200, q: 4, peak: 0.08, decay: 0.3 });
    },
    sting() {
      const t = ctx.currentTime;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(250, t);
      lp.frequency.exponentialRampToValueAtTime(2200, t + 1.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      lp.connect(g).connect(master);
      [98, 103.8, 146.8, 207.7].forEach((f) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(lp);
        o.start(t);
        o.stop(t + 3.3);
      });
    },
    page() {
      const t = ctx.currentTime;
      noiseHit(t, { filter: 'bandpass', freq: 2600, q: 0.7, peak: 0.08, attack: 0.04, decay: 0.22 });
    },
    scrape() {
      const t = ctx.currentTime + 0.3;
      for (let i = 0; i < 3; i++) {
        noiseHit(t + i * 0.9, { filter: 'bandpass', freq: 3800 + i * 300, q: 9, peak: 0.07, attack: 0.3, decay: 0.5 });
      }
    },
    wind() {
      const t = ctx.currentTime;
      noiseHit(t, { type: 'brown', filter: 'bandpass', freq: 500, q: 2, peak: 0.5, attack: 1.2, decay: 2.5 });
    },
    door() {
      const t = ctx.currentTime + 0.2;
      noiseHit(t, { filter: 'bandpass', freq: 900, q: 12, peak: 0.08, attack: 0.5, decay: 0.9 });
      thump(t + 1.3, 70, 0.3, 0.3);
    },
    click() {
      const t = ctx.currentTime;
      thump(t, 1400, 0.04, 0.03);
    },
    hour() {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.frequency.value = 880;
      const g = ctx.createGain();
      env(g.gain, t, 0.035, 0.005, 0.25);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.3);
    },
  };

  function play(name) {
    if (!ctx || muted || !SFX[name]) return;
    try {
      SFX[name]();
    } catch (err) {
      console.warn('sfx failed', name, err);
    }
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.1);
  }

  return {
    init,
    play,
    setTension,
    setMuted,
    get muted() {
      return muted;
    },
    get ready() {
      return !!ctx;
    },
  };
})();
