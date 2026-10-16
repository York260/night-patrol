/*
 * 夜巡守則・七樓（3D）— 引擎
 *
 * 負責：渲染（低解析度＋PSX 風格後製）、玩家控制、碰撞、輸入（滑鼠鍵盤與觸控）、
 * HUD 與各種介面、電梯與樓梯移動、監視器畫面、事件腳本的執行環境（G）。
 * 每一夜的劇情都在 director.js，透過 G 這個介面操作世界。
 */
(() => {
  'use strict';

  const D = window.NP3D_DATA;
  const TEX = window.NP3D_TEX;
  const AU = window.NP3D_AUDIO;
  const $ = (id) => document.getElementById(id);
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ================================================================ 常數 */

  // 時間節奏：巡邏時段走得慢，留時間打卡與探索；03:00 前後與 03:00–04:00 收緊
  const PACE = [
    [280, 2.2], // 22:30–02:40 巡邏：現實 2.2 秒 = 遊戲 1 分鐘
    [300, 1.2], // 02:40–03:00 逼近第五條
    [360, 1.2], // 03:00–04:00
    [Infinity, 1.6], // 04:00–06:00
  ];
  const secPerMin = (t) => PACE.find(([until]) => t < until)[1];
  const TIME = { START: 30, LOCK: 300, UNLOCK: 360, DOOR7: 420, END: 480 };
  const EYE = 1.6;
  const RADIUS = 0.28;
  const WALK = 2.3;
  const RUN = 3.8;
  const BAT_DRAIN = 100 / 280;
  const RENDER_H = 270;
  const NIGHT_NAMES = { 1: '第一夜', 2: '第二夜', 3: '第三夜' };
  const KEYS = { save: 'np3d-save-v1', endings: 'np3d-endings-v1', settings: 'np3d-settings-v1', hints: 'np3d-hints-v1' };
  const FLOORS = D.FLOORS;
  const MARKS = ['', 'trust', 'doubt'];
  const MARK_GLYPH = { '': '○', trust: '✓', doubt: '✗' };

  const store = {
    get(k, f) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? f : JSON.parse(v);
      } catch {
        return f;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* 無法存檔時照常遊戲 */
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* 同上 */
      }
    },
  };

  const settings = Object.assign({ sens: 1, muted: false, hints: true }, store.get(KEYS.settings, {}));

  /* ================================================================ 狀態 */

  const S = {
    night: 1, name: '', san: 100, battery: 100, flash: false, time: 0, cps: [], clues: [], flags: [],
    warnings: 0, missed: 0, marks: {}, area: '1F', nf: {}, signedIn: false, blackout: false,
  };
  const P = {
    pos: V3(), yaw: 0, pitch: 0, bob: 0, stepAcc: 0, moveLock: 0, lookLock: 0, running: false, winded: 0,
    rail: null, sitting: false, speed: 0, shake: 0, shakeT: 0, lookBackAllowed: true,
  };
  let mode = 'boot'; // boot | title | card | play | ending
  let nightBase = null;
  let busy = false;
  let modal = null;

  /* ================================================================ 渲染 */

  let renderer;
  let world;
  let scene;
  let camera;
  let rt;
  let post;
  const rig = { points: [], hemi: null, flash: null, flashTarget: null, aux: null, auxTarget: null };
  const feed = { atlas: null, rt13: null, cams: [], cam13: null, idx: 0, mats: [], mat13: null };
  const shadowProxy = { player: null };
  let flashDir = V3(0, 0, -1);

  const POST_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const POST_FS = `
    precision highp float;
    uniform sampler2D tDiffuse; uniform vec2 res; uniform float time, fear, fade, flash, hurt, dawn;
    varying vec2 vUv;
    float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float w = fear * fear;
      uv.x += sin(uv.y * 18.0 + time * 1.7) * 0.0035 * w;
      uv.y += sin(uv.x * 14.0 + time * 1.3) * 0.0025 * w;
      float ca = 0.0012 + 0.006 * w;
      vec3 c = vec3(texture2D(tDiffuse, uv + vec2(ca, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.0)).b);
      c = pow(max(c, 0.0), vec3(1.0 / 2.2));
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, vec3(l), 0.2 + 0.45 * fear);
      c *= vec3(0.95, 1.0, 1.05);
      c = mix(c, c * vec3(1.08, 1.0, 0.92), dawn);
      float d = distance(vUv, vec2(0.5)) * 1.3;
      c *= mix(1.0, smoothstep(1.1, 0.25 - 0.15 * fear, d), 0.8);
      vec2 px = floor(vUv * res);
      float g = hash(px + fract(time * 7.0) * 113.0);
      c += (g - 0.5) * (0.045 + 0.08 * fear);
      c = floor(c * 26.0 + bayer4(px)) / 26.0;
      c = mix(c, vec3(g * 0.9), flash);
      c = mix(c, c * vec3(1.3, 0.45, 0.42), hurt);
      c *= 1.0 - fade;
      gl_FragColor = vec4(c, 1.0);
    }`;

  const MON_FS = `
    precision highp float;
    uniform sampler2D map; uniform vec4 rect; uniform float power, time, glitch;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = rect.xy + vUv * rect.zw;
      vec3 c = texture2D(map, uv).rgb;
      float l = dot(c, vec3(0.3, 0.59, 0.11));
      l = pow(l, 0.75) * 1.5;
      float scan = 0.82 + 0.18 * sin(vUv.y * 220.0 + time * 4.0);
      float n = hash(vUv * vec2(140.0, 100.0) + fract(time)) * 0.2;
      vec3 col = vec3(l * 0.82, l, l * 0.88) * scan + n * 0.6 - 0.04;
      col = mix(col, vec3(hash(vUv * 80.0 + time)), glitch);
      float vig = smoothstep(0.78, 0.25, distance(vUv, vec2(0.5)));
      gl_FragColor = vec4(col * vig * power, 1.0);
    }`;
  const MON_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

  function initRenderer() {
    const canvas = $('view');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 48);
    camera.rotation.order = 'YXZ';
    rt = new THREE.WebGLRenderTarget(480, RENDER_H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rt.texture }, res: { value: new THREE.Vector2(480, RENDER_H) },
        time: { value: 0 }, fear: { value: 0 }, fade: { value: 1 }, flash: { value: 0 }, hurt: { value: 0 }, dawn: { value: 0 },
      },
      vertexShader: POST_VS,
      fragmentShader: POST_FS,
      depthTest: false,
      depthWrite: false,
    });
    post = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };
    post.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    window.addEventListener('resize', resize);
    resize();
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    baseFov = aspect < 1 ? 82 : 72;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    const rw = Math.round(RENDER_H * aspect);
    rt.setSize(rw, RENDER_H);
    post.mat.uniforms.res.value.set(rw, RENDER_H);
  }

  function initWorld() {
    world = window.NP3D_WORLD.build(D.AREA_NAMES);
    scene = world.scene;
    scene.fog = new THREE.FogExp2(0x050607, 0.1);
    scene.background = new THREE.Color(0x020303);
    rig.hemi = new THREE.HemisphereLight(0x2d3a46, 0x08090a, 0.42);
    scene.add(rig.hemi);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.PointLight(0xdfe6d8, 0, 10, 1.2);
      scene.add(p);
      rig.points.push({ light: p, spot: null });
    }
    rig.flash = new THREE.SpotLight(0xfff0d6, 0, 17, 0.44, 0.55, 1.4);
    rig.flashTarget = new THREE.Object3D();
    rig.flash.target = rig.flashTarget;
    scene.add(rig.flash, rig.flashTarget);
    rig.aux = new THREE.SpotLight(0xffd29a, 0, 40, 0.7, 0.35, 0.6);
    rig.aux.castShadow = true;
    rig.aux.shadow.mapSize.set(512, 512);
    rig.aux.shadow.camera.near = 0.3;
    rig.aux.shadow.camera.far = 40;
    rig.aux.shadow.bias = -0.002;
    rig.auxTarget = new THREE.Object3D();
    rig.aux.target = rig.auxTarget;
    scene.add(rig.aux, rig.auxTarget);
    // 玩家的影子（看不見，但會投影）
    const body = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 1.15, 8), world.M.invisible);
    torso.position.y = 1.0;
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.9, 6), world.M.invisible);
    legs.position.y = 0.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), world.M.invisible);
    head.position.y = 1.72;
    body.add(torso, legs, head);
    body.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    body.visible = false;
    scene.add(body);
    shadowProxy.player = body;
    initFeeds();
  }

  function initFeeds() {
    feed.atlas = new THREE.WebGLRenderTarget(512, 288, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter });
    feed.rt13 = new THREE.WebGLRenderTarget(128, 96, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter });
    const mk = (f) => {
      const c = new THREE.PerspectiveCamera(62, 4 / 3, 0.1, 32);
      c.position.copy(f.pos);
      c.lookAt(f.look);
      return c;
    };
    feed.cams = world.feeds.map(mk);
    feed.cam13 = mk(world.feed13);
    const A = world.areas['1F'];
    A.props.monitors.forEach((m) => {
      const col = m.cell % 4;
      const row = Math.floor(m.cell / 4);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: feed.atlas.texture }, rect: { value: new THREE.Vector4(col / 4, 1 - (row + 1) / 3, 1 / 4, 1 / 3) },
          power: { value: 1 }, time: { value: 0 }, glitch: { value: 0 },
        },
        vertexShader: MON_VS,
        fragmentShader: MON_FS,
      });
      m.mesh.material = mat;
      m.rectDefault = mat.uniforms.rect.value.clone();
      feed.mats.push(mat);
    });
    feed.mat13 = new THREE.ShaderMaterial({
      uniforms: { map: { value: feed.rt13.texture }, rect: { value: new THREE.Vector4(0, 0, 1, 1) }, power: { value: 1 }, time: { value: 0 }, glitch: { value: 0 } },
      vertexShader: MON_VS,
      fragmentShader: MON_FS,
    });
    A.props.monitor13.material = feed.mat13;
    A.props.monitor13.visible = false;
    A.props.monitor13Box.visible = false;
  }

  const mon = { power: true, all13: false, show13: false, glitch: 0, cam13: null };

  function renderFeeds() {
    const inGuard = S.area === '1F' && inZone('guardRoom');
    if (!inGuard && !(mon.show13 || mon.all13)) return;
    if (!inGuard) return;
    const fog = scene.fog;
    const hemiI = rig.hemi.intensity;
    const flashI = rig.flash.intensity;
    scene.fog = null;
    rig.hemi.intensity = 1.25;
    rig.flash.intensity = 0;
    const screens = world.areas['1F'].props.monitors.map((m) => m.mesh);
    const vis13 = world.areas['1F'].props.monitor13.visible;
    screens.forEach((m) => (m.visible = false));
    world.areas['1F'].props.monitor13.visible = false;
    for (let k = 0; k < 2; k++) {
      const i = feed.idx;
      feed.idx = (feed.idx + 1) % 13;
      if (i === 12) {
        // 第十三台攝影機：腳本可以把它移到別的地方（mon.cam13 = {pos, look}）
        const at = mon.cam13 || world.feed13;
        feed.cam13.position.copy(at.pos);
        feed.cam13.lookAt(at.look);
        renderer.setRenderTarget(feed.rt13);
        renderer.render(scene, feed.cam13);
        continue;
      }
      const col = i % 4;
      const row = Math.floor(i / 4);
      const vx = col * 128;
      const vy = (2 - row) * 96;
      feed.atlas.viewport.set(vx, vy, 128, 96);
      feed.atlas.scissor.set(vx, vy, 128, 96);
      feed.atlas.scissorTest = true;
      renderer.setRenderTarget(feed.atlas);
      renderer.render(scene, feed.cams[i]);
    }
    feed.atlas.scissorTest = false;
    screens.forEach((m) => (m.visible = true));
    world.areas['1F'].props.monitor13.visible = vis13;
    scene.fog = fog;
    rig.hemi.intensity = hemiI;
    rig.flash.intensity = flashI;
  }

  function updateMonitors(t) {
    const all = [...feed.mats, feed.mat13];
    for (const m of all) {
      m.uniforms.time.value = t;
      m.uniforms.power.value = mon.power ? 1 : 0;
      m.uniforms.glitch.value = mon.glitch;
    }
    const A = world.areas['1F'];
    feed.mats.forEach((m, i) => {
      if (mon.all13) {
        m.uniforms.map.value = feed.rt13.texture;
        m.uniforms.rect.value.set(0, 0, 1, 1);
      } else {
        m.uniforms.map.value = feed.atlas.texture;
        m.uniforms.rect.value.copy(A.props.monitors[i].rectDefault);
      }
    });
    A.props.monitor13.visible = mon.show13;
    A.props.monitor13Box.visible = mon.show13;
  }

  /* ================================================================ 區域與燈光 */

  const areaMode = {}; // 區域的燈光覆寫：'dark' | 'lit' | 'red'

  function area(id = S.area) {
    return world.areas[id];
  }

  function applyLights() {
    const A = area();
    const amb = A.ambient;
    scene.fog.color.setHex(amb.fog);
    scene.fog.density = amb.density;
    scene.background.setHex(amb.fog);
    rig.hemi.color.setHex(amb.sky);
    rig.hemi.groundColor.setHex(amb.ground);
    const ov = areaMode[A.id];
    const spots = A.id === '4F' && ov === 'lit' ? A.props.litSpots : A.lightSpots;
    rig.points.forEach((p, i) => {
      const s = spots[i];
      p.spot = s || null;
      if (!s) {
        p.light.intensity = 0;
        return;
      }
      p.light.position.set(s.x, s.y, s.z);
      p.light.color.setHex(s.color);
      p.light.distance = s.distance;
    });
    for (const id of Object.keys(world.areas)) {
      const a = world.areas[id];
      const on = !S.blackout && areaMode[id] !== 'dark' && !(id === '4F' && areaMode[id] !== 'lit') && id !== '7F';
      a.tubeMat.color.setHex(on ? 0xeef3e6 : 0x2a2b28);
    }
    AU.setAmbience(A.sound, lightsOn());
  }

  function lightsOn() {
    const A = area();
    if (S.blackout) return false;
    if (areaMode[A.id] === 'dark') return false;
    if (A.id === '4F') return areaMode[A.id] === 'lit';
    return A.id !== '7F';
  }

  function updateLights(dt, t) {
    const A = area();
    const on = lightsOn();
    rig.hemi.intensity = A.ambient.hemi * (on ? 1 : 0.55) * (areaMode[A.id] === 'dawn' ? 2.5 : 1);
    for (const p of rig.points) {
      const s = p.spot;
      if (!s) continue;
      let target = 0;
      if (on) {
        target = s.intensity;
        if (s.flicker && Math.random() < s.flicker * dt * 3) target *= Math.random() * 0.3;
      } else if (S.blackout && s.guard && A.id === '1F') {
        target = 0.3;
        p.light.color.setHex(0x5a7c9e);
      } else if (A.id === '7F' && s.x > A.ox + 1.6) {
        target = 0.28;
        p.light.color.setHex(0x9a3a2e);
      }
      if (on && s.guard) p.light.color.setHex(s.color);
      p.light.intensity = lerp(p.light.intensity, target, Math.min(1, dt * 12));
    }
  }

  function setArea(id) {
    S.area = id;
    applyLights();
    if (window.NP3D_DIRECTOR.onEnterArea) window.NP3D_DIRECTOR.onEnterArea(G, id);
  }

  function inZone(name, pos = P.pos, areaId = S.area) {
    const z = world.areas[areaId].zones[name];
    return !!z && pos.x >= z.minX && pos.x <= z.maxX && pos.z >= z.minZ && pos.z <= z.maxZ;
  }

  /* ================================================================ 玩家 */

  const input = { keys: new Set(), mdx: 0, mdy: 0, joy: { x: 0, y: 0, active: false }, look: { dx: 0, dy: 0 }, interact: false, runHeld: false };
  let pointerLocked = false;
  let dragLook = false;
  let touchMode = false;
  let expectUnlock = false;

  function forward() {
    return V3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
  }

  function collide(pos, axis, delta) {
    const A = area();
    for (const c of A.colliders) {
      if (!c.enabled) continue;
      const minX = c.minX - RADIUS;
      const maxX = c.maxX + RADIUS;
      const minZ = c.minZ - RADIUS;
      const maxZ = c.maxZ + RADIUS;
      if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
        if (axis === 'x') pos.x = delta > 0 ? minX - 0.001 : maxX + 0.001;
        else pos.z = delta > 0 ? minZ - 0.001 : maxZ + 0.001;
      }
    }
  }

  function updatePlayer(dt) {
    // 視角
    const sens = 0.0022 * settings.sens;
    if (!P.lookLock && !P.cine) {
      P.yaw -= (input.mdx * sens + input.look.dx * 0.0055);
      P.pitch -= (input.mdy * sens + input.look.dy * 0.0055);
      P.pitch = clamp(P.pitch, -1.4, 1.35);
    }
    input.mdx = 0;
    input.mdy = 0;
    input.look.dx = 0;
    input.look.dy = 0;

    if (P.rail) {
      const r = P.rail;
      r.t += dt / r.dur;
      const k = Math.min(1, r.t);
      const seg = k * (r.pts.length - 1);
      const i = Math.min(r.pts.length - 2, Math.floor(seg));
      const f = seg - i;
      const a = r.pts[i];
      const b = r.pts[i + 1];
      P.pos.set(lerp(a.x, b.x, f), lerp(a.y, b.y, f), lerp(a.z, b.z, f));
      P.bob += dt * 9;
      P.stepAcc += dt * 2.2;
      if (P.stepAcc > 1) {
        P.stepAcc = 0;
        AU.play('step', null, { mat: 'concrete' });
      }
      if (k >= 1) {
        const done = r.done;
        P.rail = null;
        done();
      }
      updateWind(dt, false);
      return;
    }

    let mx = 0;
    let mz = 0;
    let running = false;
    if (!P.moveLock && !modal && !P.cine) {
      const k = input.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) mz += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) mz -= 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
      running = k.has('ShiftLeft') || k.has('ShiftRight') || input.runHeld;
      if (input.joy.active) {
        mx += input.joy.x;
        mz += -input.joy.y;
      }
    }
    // 七樓走廊這類地方：低著頭照影子，跑不起來
    if (S.nf.noRun) running = false;
    const len = Math.hypot(mx, mz);
    if (P.sitting && len > 0.1) standUp();
    updateWind(dt, running && len > 0.1 && !P.sitting);
    if (P.sitting) {
      P.speed = 0;
      return;
    }
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const speed = (running ? RUN : WALK) * Math.min(1, len);
    P.speed = speed;
    const sin = Math.sin(P.yaw);
    const cos = Math.cos(P.yaw);
    const vx = (mx * cos - mz * sin) * speed * dt;
    const vz = (-mx * sin - mz * cos) * speed * dt;
    if (vx) {
      P.pos.x += vx;
      collide(P.pos, 'x', vx);
    }
    if (vz) {
      P.pos.z += vz;
      collide(P.pos, 'z', vz);
    }
    const moved = Math.hypot(vx, vz);
    if (moved > 0) {
      P.bob += moved * 3.2;
      P.stepAcc += moved;
      if (P.stepAcc > (running ? 0.85 : 0.62)) {
        P.stepAcc = 0;
        AU.play('step', null, { mat: stepMat(), gain: running ? 1.4 : 1 });
      }
    }
  }

  /**
   * 跑步的代價：跑越久越喘（最多 5 秒），停下來才慢慢平復。
   * 喘的時候四周有位置的聲音會被蓋過（audio.setWinded）。演出中不喘，免得蓋掉演出的聲音。
   */
  function updateWind(dt, running) {
    P.running = running;
    if (running) P.winded = Math.min(5, P.winded + dt);
    else P.winded = Math.max(0, P.winded - dt * (S.nf.noRun ? 3 : 1));
    const k = P.cine || P.moveLock ? 0 : clamp((P.winded - 0.6) / 2.4, 0, 1);
    AU.setWinded(k);
  }

  /* ================================================================ 操作提示：只在需要的那一刻出現 */

  // 看過的提示記在這份存檔；開新遊戲才會重新出現，重來這一夜不會
  const hints = { seen: new Set(store.get(KEYS.hints, [])), cur: null, walk: 0 };

  function hintText(id) {
    if (id === 'flash') return touchMode ? ['', '按「手電筒」打開手電筒'] : ['F', '打開手電筒'];
    if (id === 'battery') return ['', '保全室門邊的櫃子可以換電池'];
    if (id === 'run') return touchMode ? ['', '按住「跑」跑步'] : ['Shift', '按住跑步'];
    return ['', '喘的時候，聽不清楚四周的聲音'];
  }

  function showHint(id, maxSec, done) {
    const [key, text] = hintText(id);
    $('hint-key').hidden = !key;
    $('hint-key').textContent = key;
    $('hint-text').textContent = text;
    const el = $('hint');
    el.hidden = false;
    el.classList.remove('out');
    hints.cur = { id, t: 0, maxSec, done };
  }

  function hideHint(now = false) {
    const el = $('hint');
    hints.cur = null;
    if (now) {
      el.hidden = true;
      return;
    }
    el.classList.add('out');
    setTimeout(() => {
      if (!hints.cur) el.hidden = true;
    }, 500);
  }

  function updateHints(dt) {
    const lockTime = S.time >= TIME.LOCK && S.time < TIME.UNLOCK;
    const quiet = !settings.hints || mode !== 'play' || !!modal || P.cine || P.moveLock > 0 || P.rail || !S.signedIn || lockTime;
    const cur = hints.cur;
    if (cur) {
      // 被演出打斷就先收起來，不算看過，之後還會再出現
      if (quiet) return hideHint(true);
      cur.t += dt;
      if (cur.done() || cur.t > cur.maxSec) {
        hints.seen.add(cur.id);
        store.set(KEYS.hints, [...hints.seen]);
        hideHint();
      }
      return;
    }
    if (quiet) {
      hints.walk = 0;
      return;
    }
    const want = (id) => !hints.seen.has(id);
    const night1 = S.night === 1;
    const inGuard = S.area === '1F' && inZone('guardRoom');
    if (night1 && want('flash') && !S.flash && S.area !== '1F' && (S.area === 'B1' || !lightsOn())) return showHint('flash', 12, () => S.flash);
    if (night1 && want('battery') && S.battery <= 30) return showHint('battery', 8, () => S.battery > 90);
    if (P.speed > 0.5 && !P.running && !inGuard) hints.walk += P.speed * dt;
    else if (P.speed < 0.1 || P.running) hints.walk = 0;
    if (night1 && want('run') && hints.walk > 6) return showHint('run', 8, () => P.running);
    if (want('winded') && P.winded > 2.2) return showHint('winded', 3.5, () => false);
  }

  function stepMat() {
    const A = area();
    if (inZone('landing')) return 'concrete';
    if (inZone('cab')) return 'metal';
    return A.stepMat;
  }

  function updateCamera(dt, t) {
    const bob = P.rail || P.speed > 0.1 ? Math.sin(P.bob) * 0.035 : 0;
    const sitY = P.sitting ? -0.45 : 0;
    camera.position.set(P.pos.x, P.pos.y + EYE + bob + sitY, P.pos.z);
    let sx = 0;
    let sy = 0;
    if (P.shakeT > 0) {
      P.shakeT -= dt;
      sx = (Math.random() - 0.5) * P.shake;
      sy = (Math.random() - 0.5) * P.shake;
    }
    camera.rotation.set(P.pitch + sy, P.yaw + sx, 0);
    // 手電筒：跟著視線，稍微延遲；理智很低時手會抖
    const f = forward();
    flashDir.lerp(f, Math.min(1, dt * 14)).normalize();
    const shaky = S.san < 20 || S.nf.shaky;
    const jit = shaky ? 0.05 + (20 - Math.min(20, S.san)) * 0.004 : 0;
    const dir = flashDir.clone();
    if (jit) dir.add(V3((Math.random() - 0.5) * jit, (Math.random() - 0.5) * jit, (Math.random() - 0.5) * jit)).normalize();
    const right = V3(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    rig.flash.position.copy(camera.position).addScaledVector(right, 0.18).add(V3(0, -0.15, 0));
    rig.flashTarget.position.copy(rig.flash.position).addScaledVector(dir, 4);
    let fi = 0;
    if (S.flash && S.battery > 0) {
      fi = 2.3 * (S.nf.flashScale ?? 1);
      if (S.battery < 15 && Math.random() < 0.12) fi *= Math.random();
    }
    rig.flash.intensity = lerp(rig.flash.intensity, fi, Math.min(1, dt * 20));
    if (shadowProxy.player.visible) {
      shadowProxy.player.position.set(P.pos.x, P.pos.y, P.pos.z);
      shadowProxy.player.rotation.y = P.yaw;
    }
    AU.setListener(camera.position, f);
  }

  function setFlash(on, silent) {
    if (on && S.battery <= 0) {
      toast('手電筒沒電了');
      on = false;
    }
    if (S.flash !== on && !silent) AU.play('flashlight');
    S.flash = on;
    renderHud();
  }

  /** 沿著路徑（本地座標）自動移動，玩家仍可以轉頭 */
  function rail(points, dur, areaId = S.area) {
    const A = world.areas[areaId];
    const pts = points.map(([x, y, z]) => V3(x + A.ox, y, z));
    return new Promise((resolve, reject) => {
      const tok = token;
      P.rail = {
        pts, dur, t: 0,
        done: () => (tok === token ? resolve() : reject(new Abort())),
      };
      const d = pts[pts.length - 1].clone().sub(pts[0]);
      if (d.lengthSq() > 0.01 && points.face !== false) P.yaw = Math.atan2(-d.x, -d.z);
    });
  }

  function teleport(areaId, x, z, yaw, y = 0) {
    const A = world.areas[areaId];
    P.pos.set(x + A.ox, y, z);
    if (yaw != null) P.yaw = yaw;
    P.rail = null;
    if (areaId !== S.area) setArea(areaId);
  }

  function sitDown() {
    const a = area().anchors.chair;
    P.sitting = true;
    P.pos.set(a.x, 0, a.z);
    P.yaw = Math.PI / 2;
    P.pitch = -0.05;
    toast('坐下休息。時間過得比較快。移動就會站起來。');
  }

  function standUp() {
    if (!P.sitting) return;
    P.sitting = false;
  }

  /* ================================================================ 腳本執行環境 */

  class Abort extends Error {}
  class EndSignal extends Error {
    constructor(id, cause) {
      super(id);
      this.id = id;
      this.cause = cause;
    }
  }
  let token = 0;
  const timers = [];
  const watchers = [];
  const frameHooks = new Set();

  function wait(sec, real = false) {
    const tok = token;
    return new Promise((res, rej) => timers.push({ t: sec, res, rej, tok, real }));
  }

  function waitUntil(pred, timeout = Infinity) {
    const tok = token;
    return new Promise((res, rej) => watchers.push({ pred, t: timeout, res, rej, tok }));
  }

  function tick(dt, worldPaused) {
    for (let i = timers.length - 1; i >= 0; i--) {
      const w = timers[i];
      if (w.tok !== token) {
        timers.splice(i, 1);
        w.rej(new Abort());
        continue;
      }
      if (worldPaused && !w.real) continue;
      w.t -= dt;
      if (w.t <= 0) {
        timers.splice(i, 1);
        w.res();
      }
    }
    for (let i = watchers.length - 1; i >= 0; i--) {
      const w = watchers[i];
      if (w.tok !== token) {
        watchers.splice(i, 1);
        w.rej(new Abort());
        continue;
      }
      if (worldPaused) continue;
      let ok = false;
      try {
        ok = w.pred();
      } catch (e) {
        console.error(e);
      }
      if (ok) {
        watchers.splice(i, 1);
        w.res(true);
        continue;
      }
      w.t -= dt;
      if (w.t <= 0) {
        watchers.splice(i, 1);
        w.res(false);
      }
    }
  }

  function abortAll() {
    token += 1;
    P.rail = null;
    P.running = false;
    P.winded = 0;
    AU.setWinded(0);
    if ($('hint')) hideHint(true);
    tweens.length = 0;
    cineDepth = 0;
    document.body.classList.remove('cine');
    P.cine = false;
    fx.fear = null;
    if (camera) {
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
    }
    tick(0, false);
    frameHooks.clear();
    loops.forEach((l) => l.stop());
    loops.clear();
  }

  function runScript(fn) {
    const tok = token;
    Promise.resolve()
      .then(() => fn(G))
      .catch((e) => {
        if (e instanceof Abort) return;
        if (e instanceof EndSignal) {
          if (tok === token) endGame(e.id, e.cause);
          return;
        }
        console.error(e);
      });
  }

  const loops = new Set();

  /* ================================================================ 互動 */

  const interactables = [];
  let focus = null;
  let iid = 0;

  function addInteract(def) {
    const it = { id: def.id || `i${++iid}`, reach: 2.0, angle: 0.5, ...def };
    removeInteract(it.id);
    interactables.push(it);
    return it.id;
  }

  function removeInteract(id) {
    const i = interactables.findIndex((x) => x.id === id);
    if (i >= 0) interactables.splice(i, 1);
  }

  function updateFocus() {
    focus = null;
    if (mode !== 'play' || modal || busy || P.rail) {
      renderPrompt();
      return;
    }
    const f = forward();
    let best = Infinity;
    for (const it of interactables) {
      if (it.area !== S.area) continue;
      if (it.when && !it.when()) continue;
      const to = it.pos.clone().sub(camera.position);
      const dist = to.length();
      if (dist > it.reach) continue;
      to.normalize();
      const ang = Math.acos(clamp(to.dot(f), -1, 1));
      if (ang > it.angle) continue;
      if (ang < best) {
        best = ang;
        focus = it;
      }
    }
    renderPrompt();
  }

  function useFocus() {
    if (!focus || modal || busy || mode !== 'play') return;
    const it = focus;
    AU.play('click');
    runScript(async () => it.use(G));
  }

  function lookingAt(pos, deg = 12, maxDist = 30) {
    const to = pos.clone().sub(camera.position);
    const d = to.length();
    if (d > maxDist) return false;
    to.normalize();
    return Math.acos(clamp(to.dot(forward()), -1, 1)) < (deg * Math.PI) / 180;
  }

  /** 玩家朝向和某個方向的水平夾角（弧度，0 = 正對） */
  function yawOff(dirX, dirZ) {
    const f = V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    const d = V3(dirX, 0, dirZ).normalize();
    return Math.acos(clamp(f.dot(d), -1, 1));
  }

  function registerBase() {
    for (const id of FLOORS) {
      const A = world.areas[id];
      if (A.elevator) {
        addInteract({ id: `call-${id}`, area: id, pos: A.anchors.elevCall, reach: 1.6, label: '按電梯', when: () => A.elevator.target === 0, use: () => openElevator(id) });
        addInteract({ id: `panel-${id}`, area: id, pos: A.anchors.elevPanel, reach: 1.4, angle: 0.6, label: '選擇樓層', when: () => inZone('cab'), use: () => elevatorPanel(id) });
      }
      if (A.stairs) {
        addInteract({ id: `up-${id}`, area: id, pos: A.anchors.stairsUp, reach: 1.9, angle: 0.65, label: '上樓', use: () => useStairs('up') });
        if (id !== 'B1') addInteract({ id: `down-${id}`, area: id, pos: A.anchors.stairsDown, reach: 1.9, angle: 0.65, label: '下樓', use: () => useStairs('down') });
      }
      if (A.anchors.punch) {
        addInteract({ id: `punch-${id}`, area: id, pos: A.anchors.punch, reach: 1.6, label: () => (S.cps.includes(id) ? '已打卡' : '打卡'), use: () => punch(id) });
      }
    }
    const G1 = world.areas['1F'];
    addInteract({ id: 'battery', area: '1F', pos: G1.anchors.battery, reach: 1.5, label: '換電池', use: () => {
      S.battery = 100;
      AU.play('click');
      toast('換上了新電池');
    } });
    addInteract({ id: 'chair', area: '1F', pos: G1.anchors.chair, reach: 1.6, angle: 0.7, label: '坐下休息', when: () => !P.sitting && S.signedIn, use: () => sitDown() });
    addInteract({ id: 'power', area: '1F', pos: G1.anchors.power, reach: 1.5, label: () => (mon.power ? '關閉螢幕' : '打開螢幕'), use: () => {
      mon.power = !mon.power;
      AU.play('click');
      AU.play('static');
      window.NP3D_DIRECTOR.onPower?.(G, mon.power);
    } });
    addInteract({ id: 'logbook', area: '1F', pos: G1.anchors.logbook, reach: 1.6, label: () => window.NP3D_DIRECTOR.logbookLabel(G), use: () => window.NP3D_DIRECTOR.onLogbook(G) });
    addInteract({ id: 'exit', area: '1F', pos: G1.anchors.exit, reach: 2.2, angle: 0.6, label: '推門離開', use: () => window.NP3D_DIRECTOR.onExit(G) });
  }

  function punch(id) {
    if (S.cps.includes(id)) {
      toast('這裡已經打過卡了');
      return;
    }
    S.cps.push(id);
    AU.play('punch', area(id).anchors.punch);
    toast(`${id} 打卡完成（${S.cps.length} / 5）`);
    renderHud();
    window.NP3D_DIRECTOR.onPunch?.(G, id);
  }

  /* ================================================================ 電梯 */

  function updateDoors(dt) {
    for (const id of Object.keys(world.areas)) {
      const A = world.areas[id];
      for (const d of Object.values(A.doors)) {
        d.angle = lerp(d.angle, d.target, Math.min(1, dt * 5));
        d.pivot.rotation.y = d.angle;
        d.collider.enabled = Math.abs(d.target) < 0.01;
      }
      const e = A.elevator;
      if (e) {
        e.open = lerp(e.open, e.target, Math.min(1, dt * 3.2));
        const o = e.open * 0.6;
        e.doorL.position.z = -1.8 - o;
        e.doorR.position.z = -1.2 + o;
        e.collider.enabled = e.open < 0.85;
        if (e.target === 1 && id === S.area && !busy) {
          e.idle = inZone('cab') ? 0 : (e.idle || 0) + dt;
          if (e.idle > 6) closeElevator(id);
        }
      }
    }
  }

  function openElevator(id) {
    const e = world.areas[id].elevator;
    if (e.target === 1) return;
    e.target = 1;
    e.idle = 0;
    AU.play('ding', world.areas[id].anchors.elevCall);
    AU.play('slide', world.areas[id].anchors.elevCall);
  }

  function closeElevator(id) {
    const e = world.areas[id].elevator;
    if (e.target === 0) return;
    e.target = 0;
    AU.play('slide', world.areas[id].anchors.elevCall);
  }

  async function elevatorPanel(from) {
    if (busy) return;
    const floors = FLOORS.filter((f) => f !== from);
    const extra = window.NP3D_DIRECTOR.panelExtra?.(G) || [];
    const opts = [...floors.map((f) => D.AREA_NAMES[f]), ...extra.map((x) => x.label), '不坐了'];
    const i = await choice('要去幾樓？', opts);
    if (i < floors.length) await ride(from, floors[i]);
    else if (i < floors.length + extra.length) await extra[i - floors.length].use(G);
  }

  function cabOffset(fromId) {
    const A = world.areas[fromId];
    return { x: P.pos.x - A.ox, z: P.pos.z };
  }

  async function ride(from, to) {
    busy = true;
    P.moveLock++;
    try {
      closeElevator(from);
      await wait(1.2);
      AU.play('motor');
      P.shake = 0.004;
      P.shakeT = 2.6;
      await wait(1.6);
      const stop = window.NP3D_DIRECTOR.elevatorStop?.(G, from, to);
      let cur = from;
      if (stop) {
        const off = cabOffset(cur);
        teleport('4F', off.x, off.z);
        cur = '4F';
        world.areas['4F'].elevator.target = 0;
        world.areas['4F'].elevator.open = 0;
        await wait(0.8);
        AU.play('ding');
        P.moveLock--;
        const res = await stop(G);
        P.moveLock++;
        if (res === 'warped') return;
        closeElevator('4F');
        await wait(1.3);
        AU.play('motor');
        P.shake = 0.004;
        P.shakeT = 2.4;
        await wait(2.2);
      }
      const off = cabOffset(cur);
      teleport(to, off.x, off.z);
      world.areas[to].elevator.open = 0;
      await wait(0.6);
      AU.play('ding');
      world.areas[to].elevator.target = 1;
      world.areas[to].elevator.idle = 0;
      AU.play('slide');
    } finally {
      P.moveLock = Math.max(0, P.moveLock - 1);
      busy = false;
    }
  }

  /* ================================================================ 樓梯 */

  function defaultStairs(from, dir) {
    const i = FLOORS.indexOf(from);
    if (i < 0) return null;
    const j = dir === 'up' ? i + 1 : i - 1;
    if (j < 0) return null;
    if (j >= FLOORS.length) return { blocked: '再上去是頂樓，鐵門從這一側鎖著。' };
    return { area: FLOORS[j], arrive: dir === 'up' ? 'below' : 'above' };
  }

  async function useStairs(dir, override) {
    if (busy) return;
    const from = S.area;
    const tgt = override || window.NP3D_DIRECTOR.stairsTarget?.(G, from, dir) || defaultStairs(from, dir);
    if (!tgt) return;
    if (tgt.blocked) {
      toast(tgt.blocked);
      return;
    }
    busy = true;
    P.moveLock++;
    try {
      const A = area(from);
      await rail(dir === 'up' ? A.stairs.upPath : A.stairs.downPath, 1.3, from);
      await fade(1, 0.3);
      const B = world.areas[tgt.area];
      const path = tgt.arrive === 'below' ? B.stairs.fromBelow : B.stairs.fromAbove;
      teleport(tgt.area, path[0][0], path[0][2], null, path[0][1]);
      const fadeIn = fade(0, 0.35);
      await rail(path, 1.2, tgt.area);
      await fadeIn;
    } finally {
      P.moveLock = Math.max(0, P.moveLock - 1);
      busy = false;
    }
    const hook = window.NP3D_DIRECTOR.onLanding;
    if (hook) runScript(() => hook(G, tgt.area, dir, from, tgt));
  }

  /* ================================================================ 視覺效果 */

  const fx = { fade: 1, fadeTarget: 1, fadeSpeed: 2, flash: 0, hurt: 0, dawn: 0, fear: null };
  const tweens = [];
  let baseFov = 72;

  function fade(to, sec) {
    fx.fadeTarget = to;
    fx.fadeSpeed = Math.abs(to - fx.fade) / Math.max(0.01, sec);
    return wait(sec + 0.02, true);
  }

  function flash(amount = 0.8) {
    fx.flash = Math.max(fx.flash, amount);
  }

  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

  function tween(sec, step) {
    return new Promise((resolve) => {
      let t = 0;
      tweens.push((dt) => {
        t += dt / Math.max(0.01, sec);
        const k = Math.min(1, t);
        step(ease(k), k);
        if (k >= 1) {
          resolve();
          return true;
        }
        return false;
      });
    });
  }

  /** 把鏡頭轉向某個世界座標（電影式提示，也用在死亡場面） */
  let lookSeq = 0;
  function lookAt(pos, sec = 0.8) {
    const id = ++lookSeq; // 新的鏡頭指令會取代還在進行中的舊指令
    // 從玩家的眼睛算（不用 camera.position：同一幀剛瞬移時，相機還在舊位置）
    const eye = V3(P.pos.x, P.pos.y + EYE + (P.sitting ? -0.45 : 0), P.pos.z);
    const d = pos.clone().sub(eye);
    const ty = Math.atan2(-d.x, -d.z);
    const tp = Math.atan2(d.y, Math.hypot(d.x, d.z));
    const y0 = P.yaw;
    const p0 = P.pitch;
    let dy = ty - y0;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    return tween(sec, (k) => {
      if (id !== lookSeq) return;
      P.yaw = y0 + dy * k;
      P.pitch = p0 + (tp - p0) * k;
    });
  }

  function fovTo(v, sec = 0.5) {
    const f0 = camera.fov;
    const target = v == null ? baseFov : v;
    return tween(sec, (k) => {
      camera.fov = f0 + (target - f0) * k;
      camera.updateProjectionMatrix();
    });
  }

  let cineDepth = 0;
  function cine(on) {
    cineDepth = Math.max(0, cineDepth + (on ? 1 : -1));
    const active = cineDepth > 0;
    document.body.classList.toggle('cine', active);
    P.cine = active;
  }

  function updateTweens(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i](dt)) tweens.splice(i, 1);
  }

  function updateFx(dt) {
    const d = fx.fadeTarget - fx.fade;
    fx.fade += Math.sign(d) * Math.min(Math.abs(d), fx.fadeSpeed * dt);
    fx.flash = Math.max(0, fx.flash - dt * 2.2);
    fx.hurt = Math.max(0, fx.hurt - dt * 1.5);
    const u = post.mat.uniforms;
    u.fade.value = fx.fade;
    u.flash.value = fx.flash;
    u.hurt.value = fx.hurt * 0.6;
    u.dawn.value = fx.dawn;
    u.fear.value = fx.fear != null ? fx.fear : clamp(1 - S.san / 100, 0, 1);
  }

  /* ================================================================ 數值 */

  function changeSan(delta, opts = {}) {
    const before = S.san;
    S.san = clamp(S.san + delta, 0, 100);
    const diff = S.san - before;
    if (diff < -0.5 && !opts.silent) {
      fx.hurt = Math.min(1, fx.hurt + Math.min(0.9, -diff / 25));
      if (diff <= -3) toast(`理智 −${Math.round(-diff)}`, 'bad');
    }
    AU.setTension(S.san);
    renderHud();
    if (S.san <= 0 && mode === 'play' && !S.nf.sanDead) {
      const where = D.AREA_NAMES[S.area] || S.area;
      const cause = `理智歸零（${NIGHT_NAMES[S.night]} ${clock()}・${where}）`;
      S.nf.sanDead = true;
      abortAll();
      const hook = window.NP3D_DIRECTOR.onSanZero;
      if (hook) runScript((g) => hook(g, cause));
      else endGame('E_SAN', cause);
      throw new Abort();
    }
    if (S.nf.sanDead) throw new Abort();
  }

  function updateStats(dt) {
    if (!S.signedIn) return;
    // 時間
    if (!S.nf.timeFrozen) {
      const scale = P.sitting ? 8 : 1;
      S.time = Math.min(TIME.END, S.time + (dt / secPerMin(S.time)) * scale);
    }
    // 電量
    if (S.flash && S.battery > 0) {
      S.battery = Math.max(0, S.battery - BAT_DRAIN * dt);
      if (S.battery <= 0) {
        setFlash(false, true);
        toast('手電筒沒電了');
      }
    }
    // 理智
    const lit = lightsOn();
    let ds = 0;
    if (S.area === '1F' && inZone('guardRoom') && lit) ds += P.sitting ? 1.2 : 0.3;
    else if (!lit && !(S.flash && S.battery > 0)) ds -= 0.22;
    if (ds) {
      try {
        changeSan(ds * dt, { silent: true });
      } catch {
        /* 結局已處理 */
      }
    }
  }

  function clock(t = S.time) {
    const m = Math.floor(t);
    const h = (22 + Math.floor(m / 60)) % 24;
    return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  /* ================================================================ HUD */

  function renderHud() {
    if (!$('hud')) return;
    $('hud-night').textContent = NIGHT_NAMES[S.night];
    $('hud-clock').textContent = clock();
    $('hud-san-bar').style.width = `${S.san}%`;
    $('hud-san').dataset.level = S.san < 20 ? 'crit' : S.san < 45 ? 'low' : 'ok';
    const cells = $('hud-bat').children;
    for (let i = 0; i < cells.length; i++) cells[i].classList.toggle('on', S.battery > i * 20 + 1);
    $('hud-bat').classList.toggle('lit', S.flash && S.battery > 0);
    const cp = $('hud-cp');
    if (cp.childElementCount !== D.CHECKPOINTS.length) {
      cp.innerHTML = '';
      for (const id of D.CHECKPOINTS) {
        const el = document.createElement('span');
        el.className = 'cp-floor';
        el.dataset.floor = id;
        el.textContent = id;
        cp.append(el);
      }
    }
    for (const el of cp.children) el.classList.toggle('done', S.cps.includes(el.dataset.floor));
    cp.setAttribute('aria-label', `打卡進度 ${S.cps.length} / 5`);
    $('touch-flash').classList.toggle('on', S.flash);
  }

  function renderPrompt() {
    const el = $('prompt');
    const btn = $('touch-use');
    if (!focus) {
      el.hidden = true;
      btn.classList.remove('ready');
      btn.textContent = '互動';
      return;
    }
    const label = typeof focus.label === 'function' ? focus.label() : focus.label;
    el.hidden = false;
    $('prompt-key').textContent = touchMode ? '點' : 'E';
    $('prompt-text').textContent = label;
    btn.classList.add('ready');
    btn.textContent = label;
  }

  let objectiveText = '';
  function objective(text) {
    objectiveText = text || '';
    $('hud-obj').textContent = objectiveText;
    $('hud-obj').hidden = !objectiveText;
  }

  function toast(msg, kind = '') {
    const host = $('toasts');
    const n = document.createElement('p');
    n.className = `toast ${kind}`.trim();
    n.textContent = msg;
    host.append(n);
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => n.classList.add('out'), 2400);
    setTimeout(() => n.remove(), 2900);
  }

  let subTimer = 0;
  function subtitle(text, kind = 'say', dur = 3) {
    const el = $('subtitle');
    el.textContent = text;
    el.dataset.kind = kind;
    el.hidden = false;
    clearTimeout(subTimer);
    subTimer = setTimeout(() => (el.hidden = true), dur * 1000);
  }

  function fmt(text) {
    return text.replace(/\{name\}/g, S.name || '新人');
  }

  async function say(text, o = {}) {
    const t = fmt(text);
    const dur = o.dur ?? Math.min(6, 1.4 + t.length * 0.085);
    subtitle(t, 'say', dur + 0.2);
    if (o.who) AU.voice(o.who, Math.min(dur, 0.6 + t.length * 0.07), o.pos || null);
    await wait(dur);
  }

  async function think(text, dur) {
    const t = fmt(text);
    const d = dur ?? Math.min(6, 1.4 + t.length * 0.08);
    subtitle(t, 'think', d + 0.2);
    await wait(d);
  }

  /* ================================================================ 介面：選擇、筆記、卡片 */

  function releasePointer() {
    if (document.pointerLockElement) {
      expectUnlock = true;
      document.exitPointerLock();
    }
  }

  function grabPointer() {
    if (touchMode || dragLook) return;
    const c = $('view');
    if (document.pointerLockElement === c) return;
    try {
      const r = c.requestPointerLock();
      if (r && r.catch) r.catch(() => (dragLook = true));
    } catch {
      dragLook = true;
    }
  }

  /** 選項畫面：鎖定滑鼠時用滑鼠上下／數字鍵選擇，點擊或 E 確認；觸控直接點 */
  function choice(prompt, options) {
    return new Promise((resolve, reject) => {
      const tok = token;
      const el = $('choice');
      $('choice-prompt').textContent = fmt(prompt);
      const list = $('choice-list');
      list.innerHTML = '';
      let sel = 0;
      let acc = 0;
      const btns = options.map((o, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ch';
        b.innerHTML = `<span class="ch-k">${i + 1}</span><span class="ch-t"></span>`;
        b.querySelector('.ch-t').textContent = fmt(o);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          pick(i);
        });
        b.addEventListener('pointerenter', () => setSel(i));
        list.append(b);
        return b;
      });
      const setSel = (i) => {
        sel = (i + btns.length) % btns.length;
        btns.forEach((b, k) => b.classList.toggle('sel', k === sel));
      };
      setSel(0);
      const done = () => {
        el.hidden = true;
        modal = null;
      };
      const pick = (i) => {
        done();
        AU.play('click');
        if (!pointerLocked) grabPointer();
        if (tok !== token) reject(new Abort());
        else resolve(i);
      };
      modal = {
        kind: 'choice',
        key(code) {
          if (/^Digit[1-9]$/.test(code)) {
            const n = Number(code.slice(5)) - 1;
            if (n < btns.length) pick(n);
          } else if (code === 'KeyW' || code === 'ArrowUp') setSel(sel - 1);
          else if (code === 'KeyS' || code === 'ArrowDown') setSel(sel + 1);
          else if (code === 'KeyE' || code === 'Space' || code === 'Enter') pick(sel);
        },
        mouse(dy) {
          acc += dy;
          if (Math.abs(acc) > 45) {
            setSel(sel + Math.sign(acc));
            acc = 0;
          }
        },
        click() {
          pick(sel);
        },
      };
      el.hidden = false;
    });
  }

  function note(n) {
    const data = typeof n === 'string' ? D.CLUES[n] : n;
    if (typeof n === 'string' && !S.clues.includes(n)) {
      S.clues.push(n);
      toast(`找到線索：${data.title}`, 'clue');
      $('book-badge').hidden = false;
    }
    AU.play('page');
    return new Promise((resolve) => {
      $('note-title').textContent = data.title;
      // 一張紙條上可能有兩段不同的字跡
      const txt = $('note-text');
      if (data.parts) {
        txt.innerHTML = '';
        data.parts.forEach((p) => {
          const el = document.createElement('span');
          el.className = `note-part ${p.style}`;
          el.textContent = fmt(p.text);
          txt.append(el);
        });
      } else txt.textContent = fmt(data.text);
      $('note-card').classList.toggle('hand', !!data.hand);
      // 老陳的紙條蓋公司的章；它描出來的章是反的
      $('note-stamp').innerHTML = data.stamp ? stamp(data.stamp === 'flip', 'note') : '';
      $('note').hidden = false;
      const close = () => {
        $('note').hidden = true;
        modal = null;
        if (!pointerLocked) grabPointer();
        resolve();
      };
      modal = {
        kind: 'note',
        key(code) {
          if (['KeyE', 'Space', 'Enter', 'Escape'].includes(code)) close();
        },
        click: close,
      };
      $('note-close').onclick = (e) => {
        e.stopPropagation();
        close();
      };
    });
  }

  /**
   * 值班日誌的簽到頁：列出前面的簽名，今天這一行由玩家簽。
   * o.rows：[{date, in, out}]；o.editable：第一夜要填名字，之後只要按「簽名」。
   */
  function signSheet(o = {}) {
    return new Promise((resolve) => {
      releasePointer();
      $('sign').hidden = false;
      const body = $('sign-rows');
      body.innerHTML = '';
      for (const r of o.rows || []) {
        const tr = document.createElement('tr');
        for (const v of [r.date, r.in, r.out]) {
          const td = document.createElement('td');
          td.textContent = v || '';
          tr.append(td);
        }
        body.append(tr);
      }
      $('sign-today').textContent = o.date || '';
      $('sign-label').textContent = o.editable === false ? '確認後在上班欄簽名' : '在上班欄簽下你的名字';
      const f = $('sign-name');
      f.value = S.name || '';
      f.readOnly = o.editable === false;
      setTimeout(() => (o.editable === false ? $('sign-go') : f).focus(), 30);
      modal = { kind: 'sign', key() {}, click() {} };
      $('sign-form').onsubmit = (e) => {
        e.preventDefault();
        const v = f.value.replace(/\s+/g, ' ').trim().slice(0, 8) || '新人';
        $('sign').hidden = true;
        modal = null;
        grabPointer();
        resolve(v);
      };
    });
  }

  function nameInput() {
    return signSheet({ editable: true });
  }

  /** 夜晚開場與結算的文字卡 */
  function card({ kicker, title, lines, stats, button, log }) {
    return new Promise((resolve) => {
      releasePointer();
      $('card-kicker').textContent = kicker || '';
      $('card-title').textContent = title || '';
      $('card-title').hidden = !title;
      const body = $('card-lines');
      body.innerHTML = '';
      lines.filter(Boolean).forEach((l, i) => {
        const p = document.createElement('p');
        p.textContent = fmt(l);
        p.style.setProperty('--d', i);
        body.append(p);
      });
      // 巡邏紀錄（值班日誌）：一條守則一行；紅筆那行不是你寫的
      const lg = $('card-log');
      lg.innerHTML = '';
      $('card-log-wrap').hidden = !(log && log.length);
      (log || []).forEach((e) => {
        const li = document.createElement('li');
        if (e.forged) li.className = 'forged';
        const n = document.createElement('span');
        n.className = 'log-rule';
        n.textContent = /^[\d・]+$/.test(e.rule) ? `第 ${e.rule} 條` : e.rule;
        const t = document.createElement('span');
        t.className = 'log-text';
        t.textContent = fmt(e.text);
        li.append(n, t);
        lg.append(li);
      });
      const st = $('card-stats');
      st.innerHTML = '';
      st.hidden = !stats;
      (stats || []).forEach(([k, v]) => {
        const row = document.createElement('div');
        row.className = 'stat-row';
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = v;
        row.append(dt, dd);
        st.append(row);
      });
      const btn = $('card-go');
      btn.textContent = button || '繼續';
      $('card').hidden = false;
      setTimeout(() => btn.focus({ preventScroll: true }), 50);
      btn.onclick = () => {
        $('card').hidden = true;
        AU.init();
        resolve();
      };
    });
  }

  /* ================================================================ 守則（手冊） */

  let bookView = 'now';

  function starPoints(cx, cy, o, n) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? n : o;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  }
  const STAR = starPoints(50, 40, 6, 2.6);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function stamp(flip, uid) {
    return `<svg class="stamp${flip ? ' flip' : ''}" viewBox="0 0 100 100" role="img" aria-label="福安物業管理有限公司印章">
      <defs><path id="arc-${uid}" d="M 15 54 A 35 35 0 0 1 85 54"/></defs>
      <circle cx="50" cy="50" r="46" class="st-ring"/><circle cx="50" cy="50" r="38.5" class="st-ring thin"/>
      <text class="st-arc"><textPath href="#arc-${uid}" startOffset="50%" text-anchor="middle">福安物業管理有限公司</textPath></text>
      <polygon points="${STAR}" class="st-star"/><text x="50" y="64" text-anchor="middle" class="st-main">管理專用章</text></svg>`;
  }

  function ruleRow(id, readonly) {
    const r = D.RULES[id];
    const mark = (!readonly && S.marks[id]) || '';
    const sign = r.sign ? `<span class="sign">——${esc(r.sign)}</span>` : '';
    const btn = readonly ? '' : `<button type="button" class="mark" data-rule="${id}" aria-label="第 ${r.n} 條記號">${MARK_GLYPH[mark]}</button>`;
    return `<li class="rule ${r.ink}"><span class="rn">${r.n}.</span><span class="rt">${esc(r.text)}${sign}</span>${btn}</li>`;
  }

  function renderBook() {
    const photo = bookView === 'photo';
    const n = photo ? 1 : S.night;
    const hb = D.HANDBOOKS[n];
    let html = photo ? '<p class="photo-cap">IMG_2158.JPG・第一夜 21:59 拍攝</p>' : '';
    hb.pages.forEach((pg, pi) => {
      html += `<article class="hb-page${photo ? ' photo' : ''}">`;
      if (pi === 0) html += '<header class="hb-head"><p class="hb-org">福安大廈</p><h3>夜間保全守則</h3><p class="hb-sub">請勿攜出保全室</p></header>';
      html += `<ol class="hb-rules">${pg.rules.map((id) => ruleRow(id, photo)).join('')}</ol>`;
      if (pg.footer) html += `<p class="hb-footer">${esc(D.FOOTERS[pg.footer])}</p>`;
      html += `${stamp(pg.stamp === 'flip', `${photo ? 'p' : 'n'}${n}${pi}`)}<p class="hb-folio">－ ${pi + 1} －</p></article>`;
    });
    if (hb.hand.length) html += `<article class="hb-page hb-back"><p class="hb-back-note">（第二頁背面）</p><ol class="hb-rules">${hb.hand.map((id) => ruleRow(id, photo)).join('')}</ol></article>`;
    $('book-rules').innerHTML = html;
    $('book-clues').innerHTML = S.clues.length
      ? S.clues.map((id) => {
        const c = D.CLUES[id];
        const st = c.stamp ? `<div class="clue-stamp">${stamp(c.stamp === 'flip', `clue-${id}`)}</div>` : '';
        const body = c.parts ? c.parts.map((p) => `<span class="note-part ${p.style}">${esc(p.text)}</span>`).join('') : esc(c.text);
        return `<article class="clue${c.hand ? ' hand' : ''}${c.stamp ? ' stamped' : ''}"><h4>${esc(c.title)}</h4><p>${body}</p>${st}</article>`;
      }).join('')
      : '<p class="empty">還沒有找到任何線索。巡邏時，留意那些不該出現的東西。</p>';
    document.querySelectorAll('.bk-view').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === bookView)));
  }

  function openBook(tab = 'rules') {
    if (mode !== 'play' || (modal && modal.kind !== 'book')) return;
    releasePointer();
    renderBook();
    setBookTab(tab);
    $('book').hidden = false;
    $('book-badge').hidden = true;
    AU.play('page');
    modal = {
      kind: 'book',
      key(code) {
        if (['KeyH', 'Tab', 'Escape'].includes(code)) closeBook();
      },
      click() {},
    };
  }

  function closeBook() {
    $('book').hidden = true;
    modal = null;
    grabPointer();
  }

  function setBookTab(tab) {
    document.querySelectorAll('.bk-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $('book-rules-wrap').hidden = tab !== 'rules';
    $('book-clues').hidden = tab !== 'clues';
  }

  /* ================================================================ 夜晚流程 */

  function freshState() {
    return { night: 1, name: '', san: 100, clues: [], flags: [], warnings: 0, missed: 0, marks: {} };
  }

  // 第三夜 05:00 的重來點：走上 6F 樓梯、要進七樓之前記下來；只在這一局有效
  let checkpoint = null;
  const VOLATILE_NF = ['on7', 'shaky', 'flashScale', 'timeFrozen', 'noRun', 'lockedIn', 'sanDead'];

  function takeCheckpoint() {
    const nf = clone(S.nf);
    VOLATILE_NF.forEach((k) => delete nf[k]);
    checkpoint = {
      night: S.night, name: S.name, san: S.san, battery: S.battery, cps: [...S.cps], clues: [...S.clues],
      flags: [...S.flags], warnings: S.warnings, missed: S.missed, marks: clone(S.marks), time: S.time, nf,
    };
  }

  async function startNight(base, resume = null) {
    abortAll();
    if (!resume) checkpoint = null;
    mode = 'card';
    $('title').hidden = true;
    $('ending').hidden = true;
    $('hud').hidden = true;
    $('touch').hidden = true;
    if (!resume) {
      nightBase = clone(base);
      store.set(KEYS.save, nightBase);
    }
    Object.assign(S, clone(base));
    if (S.night > 1 && !resume) S.san = clamp(S.san + 25, 0, 100);
    S.battery = 100;
    S.flash = false;
    S.cps = [];
    S.nf = {};
    S.time = 0;
    S.signedIn = false;
    S.blackout = false;
    Object.keys(areaMode).forEach((k) => delete areaMode[k]);
    mon.power = true;
    mon.all13 = false;
    mon.show13 = false;
    mon.glitch = 0;
    mon.cam13 = null;
    fx.dawn = 0;
    shadowProxy.player.visible = false;
    rig.aux.intensity = 0;
    P.sitting = false;
    P.pitch = 0;
    P.moveLock = 0; // 上一夜可能停在死亡場面（鎖住移動）
    P.lookLock = 0;
    interactables.splice(0, interactables.length);
    registerBase();
    window.NP3D_DIRECTOR.setupNight(G);
    const A = world.areas['1F'];
    teleport('1F', A.anchors.spawn.x - A.ox, A.anchors.spawn.z, Math.PI / 2);
    applyLights();
    renderHud();
    fx.fade = 1;
    fx.fadeTarget = 1;
    if (resume) {
      // 從 05:00 重來：狀態回到要上七樓之前，人站在 6F 的樓梯口
      S.san = resume.san;
      S.battery = resume.battery;
      S.cps = [...resume.cps];
      // 互動登記時已經抓住 S.nf 這個物件，所以要填進去，不能換掉
      Object.assign(S.nf, clone(resume.nf), { resumed: true });
      S.time = resume.time;
      S.signedIn = true;
      window.NP3D_DIRECTOR.onResume?.(G);
      teleport('6F', 2.6, -2.0, -Math.PI / 2);
      applyLights();
      renderHud();
      beginPlay();
      toast('05:00。樓梯間的方向，傳來一聲很輕的開門聲。');
      return;
    }
    const intro = D.INTROS[S.night].map((l) => (typeof l === 'function' ? l(S) : l));
    await card({ kicker: `${NIGHT_NAMES[S.night]}・21:58`, title: NIGHT_NAMES[S.night], lines: intro, button: '開始值班' });
    beginPlay();
  }

  function beginPlay() {
    mode = 'play';
    $('hud').hidden = false;
    $('touch').hidden = !touchMode;
    grabPointer();
    fade(0, 1.2).catch(() => {});
    AU.setTension(S.san);
    objective('在保全室的日誌上簽到');
    runScript((g) => window.NP3D_DIRECTOR.startNight(g));
  }

  async function endNight() {
    const missed = 5 - S.cps.length;
    S.missed = missed;
    if (missed > 0) S.warnings += 1;
    abortAll();
    mode = 'card';
    $('hud').hidden = true;
    $('touch').hidden = true;
    await fade(1, 0.8).catch(() => {});
    const lines = [D.SUMMARY_LINES[S.night]];
    if (missed > 0) lines.push(S.warnings >= 2 ? '你又少打了卡。林主任不會再給你機會了。' : `少打了 ${missed} 個卡。林主任一定會注意到。`);
    const tonight = S.clues.filter((c) => !(nightBase.clues || []).includes(c)).map((c) => D.CLUES[c].title);
    await card({
      kicker: `${NIGHT_NAMES[S.night]}・06:00`,
      title: `${NIGHT_NAMES[S.night]}結束`,
      lines,
      stats: [['打卡', `${S.cps.length} / 5`], ['理智', String(Math.round(S.san))], ['新的線索', tonight.length ? tonight.join('、') : '沒有']],
      log: window.NP3D_DIRECTOR.patrolLog?.(G) || [],
      button: S.warnings >= 2 ? '隔天早上' : '迎接下一夜',
    });
    if (S.warnings >= 2) {
      endGame('E_FIRED');
      return;
    }
    const next = { night: S.night + 1, name: S.name, san: S.san, clues: S.clues, flags: S.flags, warnings: S.warnings, missed: S.missed, marks: S.marks };
    startNight(next);
  }

  function endGame(id, cause) {
    if (mode === 'ending') return;
    abortAll();
    mode = 'ending';
    modal = null;
    ['choice', 'note', 'book', 'sign', 'card', 'pause'].forEach((x) => ($(x).hidden = true));
    releasePointer();
    $('hud').hidden = true;
    $('touch').hidden = true;
    fx.fade = 1;
    fx.fadeTarget = 1;
    const e = D.ENDINGS[id];
    const found = store.get(KEYS.endings, []);
    if (!found.includes(id)) store.set(KEYS.endings, [...found, id]);
    if (['E_TRUE', 'E_DAWN', 'E_SIGN', 'E_FIRED'].includes(id)) store.del(KEYS.save);
    const idx = D.ENDING_ORDER.indexOf(id) + 1;
    $('end-no').textContent = `結局 ${String(idx).padStart(2, '0')}／${D.ENDING_ORDER.length}`;
    $('end-kind').textContent = e.kind;
    $('end-kind').dataset.kind = e.kind;
    $('end-title').textContent = e.title;
    $('end-cause').hidden = !cause;
    $('end-cause').textContent = cause ? `死因：${cause}` : '';
    const body = $('end-text');
    body.innerHTML = '';
    e.text.forEach((t, i) => {
      const p = document.createElement('p');
      p.textContent = fmt(t);
      p.style.setProperty('--d', i);
      body.append(p);
    });
    $('end-hint').textContent = e.hint;
    $('end-retry').textContent = `重來${NIGHT_NAMES[nightBase ? nightBase.night : 1]}`;
    $('end-retry5').hidden = !(checkpoint && checkpoint.night === S.night && id !== 'E_TRUE');
    $('ending').hidden = false;
    AU.play(e.kind === '壞結局' ? 'sting' : 'page');
    AU.setTension(100);
  }

  /* ================================================================ 標題、選單、收藏 */

  function showTitle() {
    abortAll();
    mode = 'title';
    modal = null;
    ['hud', 'touch', 'ending', 'card', 'pause', 'gallery', 'help', 'book', 'choice', 'note', 'sign'].forEach((x) => ($(x).hidden = true));
    $('title').hidden = false;
    releasePointer();
    const save = store.get(KEYS.save, null);
    const btn = $('btn-continue');
    btn.hidden = !(save && NIGHT_NAMES[save.night]);
    if (!btn.hidden) btn.textContent = `繼續值班（${NIGHT_NAMES[save.night]}）`;
    $('ending-count').textContent = `${store.get(KEYS.endings, []).length} / ${D.ENDING_ORDER.length}`;
    S.area = '1F';
    S.blackout = false;
    S.time = 0;
    const A = world.areas['1F'];
    P.pos.set(A.ox + 2.4, 0, 22.6);
    P.yaw = 0.3;
    P.pitch = 0.02;
    applyLights();
    fade(0, 1.5).catch(() => {});
  }

  function pause() {
    if (mode !== 'play' || modal) return;
    modal = { kind: 'pause', key(code) {
      if (code === 'Escape') resume();
    }, click() {} };
    $('pause').hidden = false;
    $('sens').value = String(settings.sens);
  }

  function resume() {
    $('pause').hidden = true;
    modal = null;
    grabPointer();
  }

  function showGallery() {
    const found = store.get(KEYS.endings, []);
    $('gallery-count').textContent = `已解鎖 ${found.length} / ${D.ENDING_ORDER.length}`;
    $('gallery-grid').innerHTML = D.ENDING_ORDER.map((id, i) => {
      const e = D.ENDINGS[id];
      const got = found.includes(id);
      return `<li class="g-card${got ? ' got' : ''}" data-kind="${got ? esc(e.kind) : ''}"><span class="g-no">${String(i + 1).padStart(2, '0')}</span><span class="g-title">${got ? esc(e.title) : '？？？'}</span><span class="g-kind">${got ? esc(e.kind) : '尚未解鎖'}</span></li>`;
    }).join('');
    $('gallery').hidden = false;
  }

  function showHelp() {
    $('help-rows').innerHTML = D.CONTROLS.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join('');
    $('help').hidden = false;
  }

  /* ================================================================ 輸入綁定 */

  function bindInput() {
    const canvas = $('view');
    document.addEventListener('keydown', (e) => {
      AU.init();
      if (e.code === 'Tab') e.preventDefault();
      if (modal && modal.key) {
        if (modal.kind === 'sign') return;
        e.preventDefault();
        modal.key(e.code);
        return;
      }
      if (mode !== 'play') return;
      input.keys.add(e.code);
      if (e.code === 'KeyF' && !e.repeat) setFlash(!S.flash);
      if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) {
        e.preventDefault();
        if (P.sitting) standUp();
        else useFocus();
      }
      if ((e.code === 'KeyH' || e.code === 'Tab') && !e.repeat) openBook();
      if (e.code === 'Escape') pause();
    });
    document.addEventListener('keyup', (e) => input.keys.delete(e.code));
    window.addEventListener('blur', () => input.keys.clear());

    canvas.addEventListener('click', () => {
      AU.init();
      if (mode !== 'play') return;
      if (modal && modal.click) {
        modal.click();
        return;
      }
      if (!pointerLocked) grabPointer();
    });
    document.addEventListener('pointerlockchange', () => {
      pointerLocked = document.pointerLockElement === canvas;
      if (pointerLocked) lockGrace = performance.now() + 120;
      // 鎖定比簽到頁晚一步生效時，要把滑鼠還給玩家，否則按不到「簽名」
      if (pointerLocked && modal && modal.kind === 'sign') {
        releasePointer();
        return;
      }
      document.body.classList.toggle('locked', pointerLocked);
      if (!pointerLocked && mode === 'play' && !modal && !expectUnlock) pause();
      expectUnlock = false;
      $('click-hint').hidden = pointerLocked || touchMode || mode !== 'play' || !!modal || dragLook;
    });
    document.addEventListener('pointerlockerror', () => {
      dragLook = true;
      $('click-hint').hidden = true;
    });
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lockGrace = 0;
    document.addEventListener('mousemove', (e) => {
      if (pointerLocked) {
        // 剛鎖定滑鼠的那一下，瀏覽器常會送來一筆很大的位移，丟掉它，免得視角突然甩開
        if (performance.now() < lockGrace || Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
        if (modal && modal.mouse) modal.mouse(e.movementY);
        else if (!modal) {
          input.mdx += e.movementX;
          input.mdy += e.movementY;
        }
      } else if (dragging && dragLook && !modal) {
        input.mdx += (e.clientX - lastX) * 1.4;
        input.mdy += (e.clientY - lastY) * 1.4;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    document.addEventListener('mouseup', () => (dragging = false));

    // 觸控
    const joyEl = $('joy');
    const knob = $('joy-knob');
    let joyId = null;
    let lookId = null;
    let jx0 = 0;
    let jy0 = 0;
    let lx = 0;
    let ly = 0;
    const enableTouch = () => {
      if (touchMode) return;
      touchMode = true;
      document.body.classList.add('touch-mode');
      if (mode === 'play') $('touch').hidden = false;
      $('click-hint').hidden = true;
    };
    canvas.addEventListener('touchstart', (e) => {
      enableTouch();
      AU.init();
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.42 && joyId == null) {
          joyId = t.identifier;
          jx0 = t.clientX;
          jy0 = t.clientY;
          joyEl.style.left = `${jx0}px`;
          joyEl.style.top = `${jy0}px`;
          joyEl.hidden = false;
          input.joy.active = true;
        } else if (lookId == null) {
          lookId = t.identifier;
          lx = t.clientX;
          ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          const dx = clamp((t.clientX - jx0) / 55, -1, 1);
          const dy = clamp((t.clientY - jy0) / 55, -1, 1);
          input.joy.x = dx;
          input.joy.y = dy;
          knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
        } else if (t.identifier === lookId) {
          input.look.dx += (t.clientX - lx) * settings.sens;
          input.look.dy += (t.clientY - ly) * settings.sens;
          lx = t.clientX;
          ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null;
          input.joy.active = false;
          input.joy.x = 0;
          input.joy.y = 0;
          joyEl.hidden = true;
          knob.style.transform = '';
        }
        if (t.identifier === lookId) lookId = null;
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
    $('touch-use').addEventListener('click', () => {
      if (P.sitting) standUp();
      else useFocus();
    });
    $('touch-flash').addEventListener('click', () => setFlash(!S.flash));
    // 「跑」：按住才跑（搖桿推到底不再自動跑，免得手機玩家一直誤跑）
    const runBtn = $('touch-run');
    const runOn = (e) => {
      e.preventDefault();
      input.runHeld = true;
      runBtn.classList.add('on');
    };
    const runOff = () => {
      input.runHeld = false;
      runBtn.classList.remove('on');
    };
    runBtn.addEventListener('pointerdown', runOn);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => runBtn.addEventListener(ev, runOff));
    window.addEventListener('blur', runOff);
    $('touch-book').addEventListener('click', () => openBook());
    $('touch-menu').addEventListener('click', () => pause());

    // 介面按鈕
    $('btn-new').addEventListener('click', () => {
      AU.init();
      hints.seen.clear();
      store.del(KEYS.hints);
      startNight(freshState());
    });
    $('btn-continue').addEventListener('click', () => {
      AU.init();
      const s = store.get(KEYS.save, null);
      if (s) startNight(s);
    });
    $('btn-gallery').addEventListener('click', showGallery);
    $('btn-help').addEventListener('click', showHelp);
    $('btn-sound').addEventListener('click', toggleSound);
    $('gallery-close').addEventListener('click', () => ($('gallery').hidden = true));
    $('help-close').addEventListener('click', () => ($('help').hidden = true));
    $('pause-resume').addEventListener('click', resume);
    $('pause-retry').addEventListener('click', () => {
      $('pause').hidden = true;
      modal = null;
      startNight(nightBase);
    });
    $('pause-help').addEventListener('click', showHelp);
    $('pause-sound').addEventListener('click', toggleSound);
    const hintLabel = () => ($('pause-hints').textContent = settings.hints ? '操作提示：開' : '操作提示：關');
    hintLabel();
    $('pause-hints').addEventListener('click', () => {
      settings.hints = !settings.hints;
      store.set(KEYS.settings, settings);
      hintLabel();
    });
    $('pause-title').addEventListener('click', showTitle);
    $('sens').addEventListener('input', (e) => {
      settings.sens = Number(e.target.value);
      store.set(KEYS.settings, settings);
    });
    $('end-retry').addEventListener('click', () => startNight(nightBase || freshState()));
    $('end-retry5').addEventListener('click', () => {
      if (!checkpoint) return;
      const cp = checkpoint;
      startNight({ night: cp.night, name: cp.name, san: cp.san, clues: cp.clues, flags: cp.flags, warnings: cp.warnings, missed: cp.missed, marks: cp.marks }, cp);
    });
    $('end-gallery').addEventListener('click', showGallery);
    $('end-title-btn').addEventListener('click', showTitle);
    $('book-close').addEventListener('click', closeBook);
    document.querySelectorAll('.bk-tab').forEach((b) => b.addEventListener('click', () => setBookTab(b.dataset.tab)));
    document.querySelectorAll('.bk-view').forEach((b) => b.addEventListener('click', () => {
      bookView = b.dataset.view;
      AU.play('page');
      renderBook();
    }));
    $('book-rules').addEventListener('click', (e) => {
      const b = e.target.closest('.mark');
      if (!b) return;
      const id = b.dataset.rule;
      const next = MARKS[(MARKS.indexOf(S.marks[id] || '') + 1) % MARKS.length];
      if (next) S.marks[id] = next;
      else delete S.marks[id];
      renderBook();
    });
    $('click-hint').addEventListener('click', () => grabPointer());
  }

  function toggleSound() {
    settings.muted = !settings.muted;
    store.set(KEYS.settings, settings);
    AU.setMuted(settings.muted);
    if (!settings.muted) AU.init();
    const label = settings.muted ? '聲音：關' : '聲音：開';
    $('btn-sound').textContent = label;
    $('pause-sound').textContent = label;
  }

  /* ================================================================ 主迴圈 */

  let last = performance.now();
  let elapsed = 0;

  // 測試用：每畫一幀模擬幾步（遊戲邏輯變快，但不多花渲染時間）。正式遊戲永遠是 1
  let simSteps = 1;

  function simulate(dt) {
    elapsed += dt;
    const worldPaused = mode !== 'play' || !!modal;
    if (mode === 'play' && !modal) {
      updatePlayer(dt);
      updateStats(dt);
      updateHints(dt);
      updateDoors(dt);
      try {
        window.NP3D_DIRECTOR.update(G, dt);
        for (const f of frameHooks) f(dt);
      } catch (e) {
        if (!(e instanceof Abort)) console.error(e);
      }
    } else if (mode === 'title') {
      P.yaw = 0.3 + Math.sin(elapsed * 0.08) * 0.22;
      updateDoors(dt);
    }
    tick(dt, worldPaused);
    if (!worldPaused || mode === 'title') updateTweens(dt);
    if (!worldPaused || mode === 'title') updateFigures(dt, elapsed);
    updateCamera(dt, elapsed);
    updateLights(dt, elapsed);
    updateFx(dt);
    if (mode === 'play' && Math.floor(elapsed * 4) !== Math.floor((elapsed - dt) * 4)) renderHud();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (let i = 0; i < simSteps; i++) simulate(i === 0 ? dt : 0.05);
    world.M.led.color.setHex(Math.floor(elapsed * 1.3) % 2 ? 0xff2a1a : 0x2a0805);
    if (mode === 'play') updateFocus();
    updateMonitors(elapsed);
    post.mat.uniforms.time.value = elapsed;
    if (S.area === '1F') renderFeeds();
    shadowNeeded();
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(post.scene, post.cam);
    requestAnimationFrame(frame);
  }

  function updateFigures(dt, t) {
    const list = world.figures;
    const inGuard = S.area === '1F';
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      if (f.userData.dead) {
        list.splice(i, 1);
        continue;
      }
      if (!f.visible || !f.parent || !f.parent.visible) continue;
      const a = f.userData.area;
      if (a !== S.area && !(inGuard && a === '7F')) continue;
      f.userData.update(dt, t, camera.position);
    }
  }

  function shadowNeeded() {
    renderer.shadowMap.needsUpdate = rig.aux.intensity > 0.01;
  }

  /* ================================================================ G：給腳本使用的介面 */

  const G = {
    D, TEX, AU, TIME, V3,
    get S() { return S; },
    get P() { return P; },
    get world() { return world; },
    get night() { return S.night; },
    get area() { return S.area; },
    get time() { return S.time; },
    get nf() { return S.nf; },
    get busy() { return busy; },
    get camera() { return camera; },
    hasFlag: (f) => S.flags.includes(f),
    addFlag: (f) => {
      if (!S.flags.includes(f)) S.flags.push(f);
    },
    wait, waitUntil,
    run: runScript,
    ending: (id, cause) => {
      throw new EndSignal(id, cause);
    },
    endGame,
    endNight: () => endNight(),
    checkpoint: () => takeCheckpoint(),
    say, think, toast, objective, clock: () => clock(),
    choice, note, nameInput, signSheet,
    san: (d, o) => changeSan(d, o),
    battery: (d) => {
      S.battery = clamp(S.battery + d, 0, 100);
      if (S.battery <= 0) setFlash(false, true);
    },
    setBattery: (v) => {
      S.battery = clamp(v, 0, 100);
      if (S.battery <= 0) setFlash(false, true);
    },
    setFlash,
    get flashOn() { return S.flash && S.battery > 0; },
    get running() { return P.running; },
    get winded() { return P.winded; },
    sfx: (name, pos, o) => AU.play(name, pos || null, o),
    voice: (kind, sec, pos) => AU.voice(kind, sec, pos || null),
    loop: (name, pos, o) => {
      const l = AU.loop(name, pos || null, o);
      loops.add(l);
      return { stop: () => { l.stop(); loops.delete(l); }, setPos: (p) => l.setPos(p) };
    },
    flash, hurt: (v = 0.8) => (fx.hurt = Math.max(fx.hurt, v)),
    fade,
    shake: (amt, dur) => {
      P.shake = amt;
      P.shakeT = dur;
    },
    lock: () => P.moveLock++,
    unlock: () => (P.moveLock = Math.max(0, P.moveLock - 1)),
    lockLook: (v) => (P.lookLock = v ? 1 : 0),
    teleport, setArea, rail, useStairs,
    inZone: (n, pos) => inZone(n, pos),
    dist: (p) => Math.hypot(p.x - P.pos.x, p.z - P.pos.z),
    looking: lookingAt, yawOff, forward,
    addInteract, removeInteract,
    figure: (kind, areaId, x, z, yaw = 0, o = {}) => {
      const A = world.areas[areaId];
      const obj = world.makeFigure(kind, o);
      obj.userData.area = areaId;
      obj.position.set(x, o.y || 0, z);
      obj.rotation.y = yaw;
      if (o.anim || o.track) obj.userData.setAnim(o.anim || 'idle', { track: !!o.track });
      A.group.add(obj);
      const h = {
        obj,
        get world() { return V3(obj.position.x + A.ox, obj.position.y, obj.position.z); },
        get headPos() { return V3(obj.position.x + A.ox, obj.position.y + (kind === 'child' ? 1.05 : kind === 'tall' ? 2.15 : 1.6) - (o.seated ? 0.45 : 0), obj.position.z); },
        remove: () => {
          obj.userData.dead = true;
          A.group.remove(obj);
        },
        setPos: (nx, nz) => obj.position.set(nx, obj.position.y, nz),
        face: (wx, wz) => {
          obj.rotation.y = Math.atan2(wx - (obj.position.x + A.ox), wz - obj.position.z);
        },
        anim: (mode, opts) => obj.userData.setAnim(mode, opts),
        track: (on, snap) => obj.userData.setAnim(obj.userData.anim.mode, { track: on, snap: !!snap }),
        turn: (yaw, sec = 1) => {
          const y0 = obj.rotation.y;
          return tween(sec, (k) => (obj.rotation.y = y0 + (yaw - y0) * k));
        },
        walkTo: (wx, wz, speed = 1.1) => new Promise((resolve) => {
          const prev = obj.userData.anim.mode;
          obj.userData.setAnim('walk', { speed });
          h.face(wx, wz);
          tweens.push((dt) => {
            const dx = wx - (obj.position.x + A.ox);
            const dz = wz - obj.position.z;
            const d = Math.hypot(dx, dz);
            const step = speed * dt;
            if (d <= step) {
              obj.position.x = wx - A.ox;
              obj.position.z = wz;
              obj.userData.setAnim(prev === 'walk' ? 'idle' : prev, { speed: 0 });
              resolve();
              return true;
            }
            obj.position.x += (dx / d) * step;
            obj.position.z += (dz / d) * step;
            return false;
          });
        }),
      };
      return h;
    },
    lookAt,
    fov: fovTo,
    cine,
    fear: (v) => (fx.fear = v),
    tween,
    onFrame: (fn) => {
      frameHooks.add(fn);
      return () => frameHooks.delete(fn);
    },
    areaMode: (id, m) => {
      if (m) areaMode[id] = m;
      else delete areaMode[id];
      applyLights();
    },
    blackout: (on) => {
      S.blackout = on;
      applyLights();
    },
    lightsOn,
    door: (areaId, id, open) => {
      const d = world.areas[areaId].doors[id];
      d.target = open === true ? d.openAngle : open === false ? 0 : open;
    },
    elevator: (areaId, open) => (open ? openElevator(areaId) : closeElevator(areaId)),
    mon,
    get monitorsOn() { return mon.power; },
    standUp,
    get sitting() { return P.sitting; },
    aux: (o) => {
      if (!o) {
        rig.aux.intensity = 0;
        return;
      }
      const A = world.areas[o.area || S.area];
      rig.aux.position.set(o.pos[0] + A.ox, o.pos[1], o.pos[2]);
      rig.auxTarget.position.set(o.target[0] + A.ox, o.target[1], o.target[2]);
      rig.aux.color.setHex(o.color ?? 0xffd29a);
      rig.aux.intensity = o.intensity ?? 1.6;
      rig.aux.angle = o.angle ?? 0.7;
      rig.aux.distance = o.distance ?? 40;
    },
    shadow: (on) => (shadowProxy.player.visible = on),
    dawn: (v) => (fx.dawn = v),
    exitPointer: releasePointer,
    get pos() { return P.pos; },
    get yaw() { return P.yaw; },
    get pitch() { return P.pitch; },
    setYaw: (y) => (P.yaw = y),
    setPitch: (p) => (P.pitch = p),
    applyLights,
    abortErrors: Abort,
  };

  /* ================================================================ 啟動 */

  async function loadFonts() {
    if (!document.fonts || !document.fonts.load) return;
    const sample = '福安大廈守則緊急出口陳陣七樓繼續往上出口在上面明日之星補習班安心牙醫診所機房閒人勿進電池保全室專用值班日誌上班下班交班五點影子照著走不要回頭開門接電話它沒有影子手電筒一直自己的光移開管誰叫你都假裝成任何人但早餐金榜題名樓層指引招租中停車場管理室共有幾層作答時間六七第九條夜表巡邏打卡繳費機';
    const fams = ['"Iansui"', '"Noto Serif TC"', '"Cactus Classical Serif"', '"IBM Plex Mono"'];
    const all = Promise.all(fams.map((f) => document.fonts.load(`24px ${f}`, sample).catch(() => null)));
    await Promise.race([all, new Promise((r) => setTimeout(r, 3500))]);
  }

  async function boot() {
    if (!window.THREE) {
      $('boot-msg').textContent = '無法載入 3D 引擎（three.js）。請確認網路連線後重新整理頁面。';
      return;
    }
    try {
      initRendererCheck();
    } catch (e) {
      $('boot-msg').textContent = '這個瀏覽器無法使用 WebGL，沒辦法執行 3D 遊戲。';
      console.error(e);
      return;
    }
    $('boot-msg').textContent = '正在載入福安大廈……';
    await loadFonts();
    initRenderer();
    initWorld();
    bindInput();
    AU.setMuted(settings.muted);
    const label = settings.muted ? '聲音：關' : '聲音：開';
    $('btn-sound').textContent = label;
    $('pause-sound').textContent = label;
    if (window.matchMedia('(pointer: coarse)').matches) {
      touchMode = true;
      document.body.classList.add('touch-mode');
    }
    $('boot').hidden = true;
    showTitle();
    requestAnimationFrame(frame);
  }

  function initRendererCheck() {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) throw new Error('no webgl');
  }

  window.NP3D_DEBUG = {
    G, S, P,
    get world() { return world; },
    setTime: (m) => (S.time = m),
    /** 測試用快轉：每幀模擬 n 步（1–8） */
    setSpeed: (n) => (simSteps = Math.max(1, Math.min(8, Math.round(n)))),
    start: () => startNight(freshState()),
    startNight: (b) => startNight(b),
    begin: () => {
      $('card').hidden = true;
      beginPlay();
    },
    get mode() { return mode; },
    get focus() { return focus && (typeof focus.label === 'function' ? focus.label() : focus.label); },
    use: () => useFocus(),
    interactables,
    endGame,
  };

  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') {
    try {
      hot.snapshot(() => ({}));
    } catch {
      /* 不在檢視器中 */
    }
  }
  if (hot && typeof hot.ready === 'function') hot.ready(() => boot());
  else boot();
})();
