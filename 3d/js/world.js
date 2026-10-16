/*
 * 夜巡守則・七樓（3D）— 大樓模型
 *
 * 每一層樓是一個「區域」，彼此沿 X 軸相隔 200 公尺擺放（濃霧會遮住其他區域）。
 * 上下樓時，引擎會在黑幕中把玩家傳送到另一個區域；每層樓的電梯車廂與樓梯平台
 * 都用同一套模板，所以傳送前後的相對位置完全一致，看不出接縫。
 *
 * 座標慣例（區域內的本地座標）：
 *   走廊沿 +Z，x ∈ [-1.5, 1.5]；z < 0 是電梯廳。
 *   電梯車廂在左（x < -1.5），樓梯平台在右（x > 1.5）。
 *   地板 y = 0，天花板 y = 3。
 */
window.NP3D_WORLD = (() => {
  'use strict';

  const SPACING = 200;
  const AREA_IDS = ['B1', '1F', '2F', '3F', '5F', '6F', '4F', '7F'];
  const H = 3;

  /* ================================================================ 材質 */

  function makeMaterials(TEX) {
    const lam = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, ...extra });
    const uv = (m, u, v) => {
      m.userData.uv = [u, v];
      return m;
    };
    const M = {
      wall: uv(lam(TEX.wall()), 2, 3),
      wallClinic: uv(lam(TEX.wall('#d8dbd3', '#a9c4c9', '#5f8790', 12)), 2, 3),
      wallSchool: uv(lam(TEX.wall('#d7d1bc', '#b9a77d', '#7a5f3a', 13)), 2, 3),
      wallOffice: uv(lam(TEX.wall('#c9c9c2', '#9a9d9e', '#5d6163', 14)), 2, 3),
      wallStair: uv(lam(TEX.wall('#bdbab0', '#7d8277', '#4a4f47', 15)), 2, 3),
      wallGuard: uv(lam(TEX.wall('#cfc9b6', '#8e8770', '#5a5440', 16)), 2, 3),
      wall7: uv(lam(TEX.wall('#b9b2a2', '#857a68', '#5a3b30', 17)), 2, 3),
      tile: uv(lam(TEX.tile()), 1.2, 1.2),
      tileLobby: uv(lam(TEX.tile('#8f8b80', '#5a564e', 18)), 1.6, 1.6),
      tileClinic: uv(lam(TEX.tile('#d6dad4', '#9aa3a3', 19)), 1.0, 1.0),
      tileSchool: uv(lam(TEX.tile('#b8a98c', '#7a6b52', 20)), 1.2, 1.2),
      ceil: uv(lam(TEX.ceiling()), 1.2, 1.2),
      concrete: uv(lam(TEX.concrete()), 2, 2),
      concreteDark: uv(lam(TEX.concrete(22, '#5f5e5b')), 2, 2),
      carpet: uv(lam(TEX.carpet()), 2, 2),
      cab: uv(lam(TEX.metal('#8c9192', 23)), 1, 2.4),
      cabFloor: uv(lam(TEX.metal('#3b3d3e', 24)), 1, 1),
      doorGreen: uv(lam(TEX.metal('#3f5148', 25)), 1.2, 2.2),
      doorGrey: uv(lam(TEX.metal('#5c6062', 26)), 1.2, 2.2),
      iron: uv(lam(TEX.metal('#4a3b33', 27)), 1.2, 2.2),
      wood: uv(lam(TEX.wood()), 1, 1),
      woodDark: uv(lam(TEX.wood(28, '#3e2c1e')), 1, 1),
      cloth: uv(lam(TEX.cloth()), 1.5, 1.5),
      fabric: uv(lam(TEX.cloth(29)), 1.2, 1.2),
      shutter: uv(lam(TEX.shutter()), 1, 0.8),
      asphalt: uv(lam(TEX.concrete(30, '#2a2a2b')), 3, 3),
      plain: lam(null, { color: 0x8a8a84 }),
      plastic: lam(null, { color: 0x6d7a80 }),
      darkPlastic: lam(null, { color: 0x2a2d30 }),
      rubber: lam(null, { color: 0x151515 }),
      white: lam(null, { color: 0xd8d6cc }),
      red: lam(null, { color: 0x8a1c16 }),
      redString: new THREE.MeshBasicMaterial({ color: 0x9e1a14 }),
      carPaint: lam(null, { color: 0x5a1f1d }),
      carGlass: lam(null, { color: 0x111518 }),
      glass: new THREE.MeshLambertMaterial({ color: 0x9fb4ba, transparent: true, opacity: 0.16, depthWrite: false }),
      aquarium: new THREE.MeshBasicMaterial({ color: 0x1d4a5a, transparent: true, opacity: 0.55, depthWrite: false }),
      tube: new THREE.MeshBasicMaterial({ color: 0xeef3e6 }),
      tubeDead: new THREE.MeshLambertMaterial({ color: 0x55574f }),
      exit: new THREE.MeshBasicMaterial({ map: TEX.exitSign() }),
      city: new THREE.MeshBasicMaterial({ map: TEX.city() }),
      skyNight: new THREE.MeshBasicMaterial({ map: TEX.sky(false), fog: false }),
      skyDawn: new THREE.MeshBasicMaterial({ map: TEX.sky(true), fog: false }),
      lamp: new THREE.MeshBasicMaterial({ color: 0xf2b866 }),
      screenOff: new THREE.MeshBasicMaterial({ color: 0x050607 }),
      tv: new THREE.MeshBasicMaterial({ map: TEX.tvNews() }),
      body: lam(null, { color: 0x121214 }),
      uniform: lam(null, { color: 0x2b3545 }),
      shirt: lam(null, { color: 0x8b9099 }),
      suit: lam(null, { color: 0x1b1b20 }),
      skin: lam(null, { color: 0x6b5b50 }),
      face: lam(TEX.paperFace()),
      hair: lam(null, { color: 0x0b0a0a }),
      puddle: new THREE.MeshPhongMaterial({ color: 0x0a0c0d, specular: 0x8a8f90, shininess: 80, transparent: true, opacity: 0.85 }),
      flowers: lam(null, { color: 0xe8e4da }),
      flowersY: lam(null, { color: 0xd8b84a }),
      led: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
      punch: lam(TEX.punchClock()),
      smoke: new THREE.PointsMaterial({ map: TEX.smoke(), size: 0.9, color: 0x8f8a80, transparent: true, opacity: 0.35, depthWrite: false }),
      invisible: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    };
    return M;
  }

  /* ================================================================ 幾何工具 */

  /** 依照世界座標計算 UV，讓相鄰的牆面、地板貼圖無縫接續 */
  function worldUV(geo, u, v) {
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    const uvA = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i));
      const nz = Math.abs(n.getZ(i));
      let a;
      let b;
      if (nx > 0.5) {
        a = p.getZ(i);
        b = p.getY(i);
      } else if (nz > 0.5) {
        a = p.getX(i);
        b = p.getY(i);
      } else {
        a = p.getX(i);
        b = p.getZ(i);
      }
      uvA.setXY(i, a / u, b / v);
    }
    uvA.needsUpdate = true;
  }

  function newArea(id, index, M, labels) {
    const ox = index * SPACING;
    const group = new THREE.Group();
    group.position.set(ox, 0, 0);
    const A = {
      id, index, ox, group, M,
      colliders: [], zones: {}, anchors: {}, lightSpots: [], props: {}, doors: {}, rooms: [],
      ambient: { fog: 0x050607, density: 0.11, sky: 0x2d3a46, ground: 0x08090a, hemi: 0.42 },
      sound: 'building', stepMat: 'tile', label: labels[id] || id,
      tubeMat: M.tube.clone(),
    };

    A.w = (x, y, z) => new THREE.Vector3(x + ox, y, z);

    A.box = (x0, x1, y0, y1, z0, z1, mat, o = {}) => {
      const w = x1 - x0;
      const h = y1 - y0;
      const d = z1 - z0;
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      if (mat && mat.userData && mat.userData.uv) worldUV(geo, mat.userData.uv[0], mat.userData.uv[1]);
      const mesh = new THREE.Mesh(geo, mat);
      if (o.receive) mesh.receiveShadow = true;
      if (o.cast) mesh.castShadow = true;
      (o.parent || group).add(mesh);
      if (o.collide !== false && h > 0.3 && !o.parent) A.collide(x0, x1, z0, z1, o.cid);
      return mesh;
    };

    A.collide = (x0, x1, z0, z1, id) => {
      const c = { minX: x0 + ox, maxX: x1 + ox, minZ: z0, maxZ: z1, enabled: true, id };
      A.colliders.push(c);
      return c;
    };

    A.floor = (x0, x1, z0, z1, mat, y = 0, o = {}) => A.box(x0, x1, y - 0.1, y, z0, z1, mat, { collide: false, receive: true, ...o });
    A.ceil = (x0, x1, z0, z1, mat, y = H) => A.box(x0, x1, y, y + 0.1, z0, z1, mat, { collide: false });

    /**
     * 沿 Z 方向的牆（固定 x）。gaps：[[z0, z1]] 門洞；[[z0, z1, sill, top]] 窗；
     * [[z0, z1, 'open']] 整段不建牆。
     */
    A.wallZ = (x, z0, z1, gaps, mat, h = H, t = 0.2, o = {}) => {
      const segs = cut(z0, z1, gaps);
      for (const s of segs) {
        if (s.kind === 'solid') A.box(x - t / 2, x + t / 2, 0, h, s.a, s.b, mat, o);
        else if (s.kind === 'door') A.box(x - t / 2, x + t / 2, s.top, h, s.a, s.b, mat, { ...o, collide: false });
        else if (s.kind === 'window') {
          A.box(x - t / 2, x + t / 2, 0, s.sill, s.a, s.b, mat, o);
          A.box(x - t / 2, x + t / 2, s.top, h, s.a, s.b, mat, { ...o, collide: false });
          A.collide(x - t / 2, x + t / 2, s.a, s.b);
        }
      }
    };

    A.wallX = (z, x0, x1, gaps, mat, h = H, t = 0.2, o = {}) => {
      const segs = cut(x0, x1, gaps);
      for (const s of segs) {
        if (s.kind === 'solid') A.box(s.a, s.b, 0, h, z - t / 2, z + t / 2, mat, o);
        else if (s.kind === 'door') A.box(s.a, s.b, s.top, h, z - t / 2, z + t / 2, mat, { ...o, collide: false });
        else if (s.kind === 'window') {
          A.box(s.a, s.b, 0, s.sill, z - t / 2, z + t / 2, mat, o);
          A.box(s.a, s.b, s.top, h, z - t / 2, z + t / 2, mat, { ...o, collide: false });
          A.collide(s.a, s.b, z - t / 2, z + t / 2);
        }
      }
    };

    A.plane = (w, h, mat, x, y, z, rotY = 0, o = {}) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotY;
      if (o.rotX) mesh.rotation.x = o.rotX;
      if (o.receive) mesh.receiveShadow = true;
      (o.parent || group).add(mesh);
      return mesh;
    };

    /** 貼圖招牌：自動建立材質 */
    A.sign = (tex, w, h, x, y, z, rotY, o = {}) => {
      const mat = o.basic
        ? new THREE.MeshBasicMaterial({ map: tex, transparent: !!o.alpha, alphaTest: o.alpha ? 0.4 : 0 })
        : new THREE.MeshLambertMaterial({ map: tex, transparent: !!o.alpha, alphaTest: o.alpha ? 0.4 : 0 });
      return A.plane(w, h, mat, x, y, z, rotY, o);
    };

    A.tube = (x, z, o = {}) => {
      const len = o.len || 1.2;
      const along = o.axis === 'x';
      const mat = o.dead ? M.tubeDead : A.tubeMat;
      const y = o.y ?? H - 0.04;
      const m = along
        ? A.box(x - len / 2, x + len / 2, y - 0.05, y, z - 0.06, z + 0.06, mat, { collide: false })
        : A.box(x - 0.06, x + 0.06, y - 0.05, y, z - len / 2, z + len / 2, mat, { collide: false });
      A.box(along ? x - len / 2 - 0.05 : x - 0.12, along ? x + len / 2 + 0.05 : x + 0.12, y, y + 0.03, along ? z - 0.12 : z - len / 2 - 0.05, along ? z + 0.12 : z + len / 2 + 0.05, M.plain, { collide: false });
      return m;
    };

    A.light = (x, y, z, o = {}) => {
      A.lightSpots.push({ x: x + ox, y, z, color: o.color ?? 0xdfe6d8, intensity: o.intensity ?? 1.0, distance: o.distance ?? 10, flicker: o.flicker || 0, guard: !!o.guard });
    };

    A.zone = (name, x0, x1, z0, z1) => {
      A.zones[name] = { minX: x0 + ox, maxX: x1 + ox, minZ: z0, maxZ: z1 };
      return A.zones[name];
    };

    A.anchor = (name, x, y, z) => {
      A.anchors[name] = A.w(x, y, z);
      return A.anchors[name];
    };

    /** 可開關的門。hinge 是門軸位置；dir 決定門板往哪個方向延伸 */
    A.door = (id, hx, hz, axis, width, dirSign, mat, openAngle) => {
      const pivot = new THREE.Group();
      pivot.position.set(hx, 0, hz);
      const leafGeo = axis === 'z' ? new THREE.BoxGeometry(0.06, 2.1, width) : new THREE.BoxGeometry(width, 2.1, 0.07);
      const leaf = new THREE.Mesh(leafGeo, mat);
      if (axis === 'z') leaf.position.set(0, 1.05, (dirSign * width) / 2);
      else leaf.position.set((dirSign * width) / 2, 1.05, 0);
      pivot.add(leaf);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), M.plain);
      if (axis === 'z') knob.position.set(0.06, 1.0, dirSign * (width - 0.1));
      else knob.position.set(dirSign * (width - 0.1), 1.0, 0.06);
      pivot.add(knob);
      group.add(pivot);
      const c = axis === 'z'
        ? A.collide(hx - 0.08, hx + 0.08, Math.min(hz, hz + dirSign * width), Math.max(hz, hz + dirSign * width))
        : A.collide(Math.min(hx, hx + dirSign * width), Math.max(hx, hx + dirSign * width), hz - 0.08, hz + 0.08);
      A.doors[id] = { pivot, leaf, collider: c, angle: 0, target: 0, openAngle };
      return A.doors[id];
    };

    return A;
  }

  /** 把一段牆切成實心段、門洞、窗戶 */
  function cut(a0, a1, gaps = []) {
    const sorted = [...gaps].sort((p, q) => p[0] - q[0]);
    const out = [];
    let cur = a0;
    for (const g of sorted) {
      const [g0, g1, x, y] = g;
      if (g0 > cur) out.push({ kind: 'solid', a: cur, b: g0 });
      if (x === 'open') {
        /* 不建牆 */
      } else if (typeof x === 'number') out.push({ kind: 'window', a: g0, b: g1, sill: x, top: y });
      else out.push({ kind: 'door', a: g0, b: g1, top: 2.1 });
      cur = Math.max(cur, g1);
    }
    if (cur < a1) out.push({ kind: 'solid', a: cur, b: a1 });
    return out;
  }

  /* ================================================================ 人物 */

  /**
   * 有骨架的人物：骨盆、脊椎、頸、頭、肩、肘、手、髖、膝、腳，全部是可轉動的節點。
   * kind：adult | child | woman | tall | guard | boss | chen | self
   * o：seated | floor | crouch（姿勢）、paperFace（守則臉）、tag（名牌文字）、variant（衣服顏色）
   * 動畫由 userData.update(dt, t, camPos) 驅動，模式見 setAnim。
   */
  const PROFILE = {
    adult: { h: 1.72, leg: 1, torso: 1, girth: 1, arm: 1, head: 1, hand: 1 },
    child: { h: 1.18, leg: 0.86, torso: 0.92, girth: 0.92, arm: 0.92, head: 1.38, hand: 0.9 },
    woman: { h: 1.62, leg: 1, torso: 0.98, girth: 0.86, arm: 0.98, head: 1, hand: 0.9 },
    tall: { h: 2.25, leg: 1.04, torso: 1.02, girth: 0.74, arm: 1.5, head: 1.02, hand: 2.4 },
    guard: { h: 1.74, leg: 1, torso: 1, girth: 1.02, arm: 1, head: 1, hand: 1 },
    boss: { h: 1.72, leg: 1, torso: 1, girth: 1.08, arm: 1, head: 1, hand: 1 },
    chen: { h: 1.7, leg: 1, torso: 1, girth: 0.98, arm: 1, head: 1, hand: 1 },
    self: { h: 1.72, leg: 1, torso: 1, girth: 1, arm: 1, head: 1, hand: 1 },
  };

  function figureMats(M, kind, o) {
    const TEX = window.NP3D_TEX;
    M._fig = M._fig || {};
    const key = `${kind}|${o.variant || 0}|${o.paperFace ? 1 : 0}`;
    if (M._fig[key]) return M._fig[key];
    const lam = (map, color) => new THREE.MeshLambertMaterial(map ? { map } : { color });
    const dark = lam(null, 0x161514);
    let m;
    if (kind === 'guard' || kind === 'chen' || kind === 'self') {
      m = { top: lam(TEX.clothing('uniform')), bottom: lam(null, 0x1e232c), shoes: lam(null, 0x0d0d0d), skin: lam(null, 0x8a7466), head: lam(TEX.face(kind === 'guard' ? 'guard' : kind)) };
    } else if (kind === 'boss') {
      m = { top: lam(TEX.clothing('suit')), bottom: lam(null, 0x232428), shoes: lam(null, 0x0d0d0d), skin: lam(null, 0x957b6a), head: o.paperFace ? lam(null, 0x957b6a) : lam(TEX.face('boss')) };
    } else if (kind === 'woman') {
      m = { top: lam(TEX.clothing('pajama')), bottom: lam(TEX.clothing('pajama')), shoes: lam(null, 0x9b8a80), skin: lam(null, 0x9b8a80), head: lam(TEX.face('woman')) };
    } else if (kind === 'child') {
      m = { top: lam(TEX.clothing('school')), bottom: lam(null, 0x24304e), shoes: lam(null, 0x1a1a1a), skin: lam(null, 0xa3897a), head: lam(TEX.face('child')) };
    } else if (kind === 'tall') {
      m = { top: dark, bottom: dark, shoes: dark, skin: lam(null, 0x221d1b), head: dark };
    } else {
      const tones = ['old-a', 'old-bb', 'old-ccc', 'old-dddd'];
      const cloth = lam(TEX.clothing(tones[(o.variant || 0) % tones.length]));
      m = { top: cloth, bottom: lam(null, 0x1f1d1c), shoes: lam(null, 0x111111), skin: lam(null, 0x4a403a), head: lam(TEX.face('blank')) };
    }
    M._fig[key] = m;
    return m;
  }

  function limb(r0, r1, len, mat, seg = 7) {
    const geo = new THREE.CylinderGeometry(r0, r1, len, seg);
    geo.translate(0, -len / 2, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  function makeFigure(M, kind = 'adult', o = {}) {
    const TEX = window.NP3D_TEX;
    const P = PROFILE[kind] || PROFILE.adult;
    const s = P.h / 1.72;
    const mats = figureMats(M, kind, o);
    const g = new THREE.Group();
    const root = new THREE.Group();
    g.add(root);

    const tl = 0.43 * s * P.leg; // 大腿＝小腿長
    const hipY = 0.06 * s + tl * 2;
    const hips = new THREE.Group();
    hips.position.y = hipY;
    root.add(hips);
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s * P.girth, 0.15 * s * P.girth, 0.14 * s, 9), mats.bottom);
    pelvis.scale.z = 0.75;
    pelvis.position.y = 0.02 * s;
    hips.add(pelvis);

    const legs = [-1, 1].map((side) => {
      const thigh = new THREE.Group();
      thigh.position.set(side * 0.09 * s * P.girth, 0, 0);
      hips.add(thigh);
      thigh.add(limb(0.075 * s, 0.058 * s, tl, mats.bottom));
      const knee = new THREE.Group();
      knee.position.y = -tl;
      thigh.add(knee);
      knee.add(limb(0.056 * s, 0.042 * s, tl, kind === 'woman' ? mats.bottom : mats.bottom));
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.085 * s, 0.06 * s, 0.22 * s), mats.shoes);
      foot.position.set(0, -tl - 0.02 * s, 0.05 * s);
      foot.castShadow = true;
      knee.add(foot);
      return { thigh, knee };
    });

    const spine = new THREE.Group();
    spine.position.y = 0.06 * s;
    hips.add(spine);
    const tH = 0.56 * s * P.torso;
    const prof = [[0.001, 0], [0.15, 0], [0.16, 0.08], [0.142, 0.24], [0.17, 0.4], [0.192, 0.5], [0.175, 0.6], [0.09, 0.66], [0.001, 0.68]]
      .map(([r, y]) => new THREE.Vector2(r * s * P.girth, (y / 0.68) * tH));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 12), mats.top);
    torso.scale.set(1.12, 1, 0.74);
    torso.castShadow = true;
    spine.add(torso);

    const neck = new THREE.Group();
    neck.position.y = tH * 0.97;
    spine.add(neck);
    const neckGeo = new THREE.CylinderGeometry(0.046 * s, 0.054 * s, 0.09 * s, 7);
    neckGeo.translate(0, 0.045 * s, 0);
    neck.add(new THREE.Mesh(neckGeo, mats.skin));
    const head = new THREE.Group();
    head.position.y = 0.08 * s;
    neck.add(head);
    const hr = 0.108 * s * P.head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(hr, 14, 10), mats.head);
    skull.scale.set(0.9, kind === 'tall' ? 1.4 : 1.13, 0.98);
    skull.position.y = hr * 0.95;
    skull.castShadow = true;
    head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.72, 10, 6, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), mats.head);
    jaw.position.set(0, hr * 0.62, hr * 0.12);
    jaw.scale.set(0.95, 1.1, 0.95);
    head.add(jaw);

    if (kind === 'tall' || o.paperFace) {
      const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(hr * 1.7, hr * 2.2), M.face);
      faceMesh.position.set(0, hr * 1.0, hr * 0.97);
      head.add(faceMesh);
    }
    if (kind === 'guard') {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.95, hr * 0.98, hr * 0.55, 12), mats.top);
      cap.position.y = hr * 1.75;
      const brim = new THREE.Mesh(new THREE.BoxGeometry(hr * 1.5, hr * 0.08, hr * 0.8), mats.shoes);
      brim.position.set(0, hr * 1.5, hr * 0.85);
      const badge = new THREE.Mesh(new THREE.BoxGeometry(hr * 0.35, hr * 0.3, 0.01), M.lamp);
      badge.position.set(0, hr * 1.8, hr * 0.97);
      head.add(cap, brim, badge);
    }
    if (kind === 'woman') {
      const back = new THREE.Mesh(new THREE.BoxGeometry(hr * 1.9, hr * 4.2, hr * 0.5), M.hair);
      back.position.set(0, hr * -0.1, -hr * 0.55);
      head.add(back);
      for (const side of [-1, 1]) {
        const strand = new THREE.Mesh(new THREE.BoxGeometry(hr * 0.5, hr * 3.2, hr * 0.25), M.hair);
        strand.position.set(side * hr * 0.55, hr * 0.2, hr * 0.78);
        head.add(strand);
      }
    }
    if (kind === 'child') {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.36 * s, 0.14 * s), M.red);
      bag.position.set(0, tH * 0.55, -0.17 * s);
      bag.castShadow = true;
      spine.add(bag);
    }
    if (kind === 'boss') {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.22 * s, 0.01), M.red);
      tie.position.set(0, tH * 0.72, 0.145 * s * P.girth);
      spine.add(tie);
    }
    if (o.tag) {
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.08 * s, 0.034 * s), new THREE.MeshLambertMaterial({ map: TEX.nameTag(o.tag) }));
      tag.position.set(0.085 * s, tH * 0.74, 0.142 * s * P.girth);
      if (o.mirrorTag) tag.scale.x = -1; // 它描出來的名牌，字是反的
      spine.add(tag);
    }

    const arms = [-1, 1].map((side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.2 * s * P.girth, tH * 0.86, 0);
      spine.add(sh);
      const al = 0.3 * s * P.arm;
      sh.add(limb(0.05 * s, 0.043 * s, al, mats.top));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 7, 5), mats.top);
      sh.add(ball);
      const elbow = new THREE.Group();
      elbow.position.y = -al;
      sh.add(elbow);
      elbow.add(limb(0.043 * s, 0.034 * s, al * 0.92, kind === 'child' ? mats.skin : mats.top));
      const handGeo = new THREE.BoxGeometry(0.055 * s, 0.1 * s * P.hand, 0.028 * s);
      handGeo.translate(0, -0.05 * s * P.hand, 0);
      const hand = new THREE.Mesh(handGeo, mats.skin);
      hand.position.y = -al * 0.92;
      hand.castShadow = true;
      elbow.add(hand);
      sh.rotation.z = side * 0.06;
      return { sh, elbow, hand };
    });

    const rig = { root, hips, spine, neck, head, legs, arms, hipY, tl, s };
    const anim = { mode: o.anim || 'idle', track: false, phase: Math.random() * 10, speed: 0, look: { yaw: 0, pitch: 0 }, twitch: 0 };

    function pose() {
      rig.hips.position.y = hipY;
      rig.spine.rotation.set(0, 0, 0);
      legs.forEach((l) => {
        l.thigh.rotation.set(0, 0, 0);
        l.knee.rotation.set(0, 0, 0);
      });
      if (o.seated) {
        rig.hips.position.y = 0.47;
        legs.forEach((l) => {
          l.thigh.rotation.x = -Math.PI / 2;
          l.knee.rotation.x = Math.PI / 2;
        });
      } else if (o.floor) {
        rig.hips.position.y = 0.1 * s;
        legs.forEach((l, i) => {
          l.thigh.rotation.x = -1.35;
          l.thigh.rotation.y = (i ? 1 : -1) * 0.25;
          l.knee.rotation.x = 0.55;
        });
        rig.spine.rotation.x = 0.18;
      } else if (o.crouch) {
        rig.hips.position.y = 0.32 * s;
        legs.forEach((l) => {
          l.thigh.rotation.x = -2.1;
          l.knee.rotation.x = 2.3;
        });
        rig.spine.rotation.x = 0.45;
      }
      if (kind === 'tall') rig.spine.rotation.x = 0.28;
    }
    pose();

    const tmp = new THREE.Vector3();
    g.userData = {
      kind, rig, anim, head, armL: arms[0].sh, armR: arms[1].sh, torso, root,
      setAnim(mode, opts = {}) {
        anim.mode = mode;
        Object.assign(anim, opts);
      },
      update(dt, t, cam) {
        const ph = t + anim.phase;
        // 呼吸
        torso.scale.y = 1 + Math.sin(ph * 1.7) * 0.012;
        root.rotation.z = Math.sin(ph * 0.6) * 0.01;
        const L = arms[0];
        const R = arms[1];
        const relax = () => {
          for (const [i, a] of arms.entries()) {
            a.sh.rotation.x += (0 - a.sh.rotation.x) * Math.min(1, dt * 4);
            a.sh.rotation.z = (i ? 1 : -1) * 0.06 + Math.sin(ph * 1.7) * 0.01;
            a.elbow.rotation.x += (-0.12 - a.elbow.rotation.x) * Math.min(1, dt * 4);
          }
        };
        if (anim.mode !== 'walk' && !o.seated && !o.floor && !o.crouch) {
          for (const l of legs) {
            l.thigh.rotation.x *= Math.max(0, 1 - dt * 6);
            l.knee.rotation.x *= Math.max(0, 1 - dt * 6);
          }
        }
        switch (anim.mode) {
          case 'write':
            R.sh.rotation.x = -1.75 + Math.sin(ph * 3.1) * 0.08;
            R.sh.rotation.z = 0.25;
            R.elbow.rotation.x = -0.5 + Math.sin(ph * 6.3) * 0.18;
            L.sh.rotation.x = -0.2;
            break;
          case 'reach':
            // 舉高手臂、往斜上方寫字（影子上看得出是哪一隻手）
            R.sh.rotation.x = -2.55 + Math.sin(ph * 3.1) * 0.06;
            R.sh.rotation.z = 0.55 + Math.sin(ph * 2.3) * 0.05;
            R.elbow.rotation.x = -0.35 + Math.sin(ph * 6.3) * 0.2;
            L.sh.rotation.x = -0.1;
            L.sh.rotation.z = -0.08;
            break;
          case 'beckon':
            R.sh.rotation.x = -1.45;
            R.elbow.rotation.x = -0.9 + Math.sin(ph * 5.5) * 0.65;
            L.sh.rotation.x = 0;
            break;
          case 'hold':
            L.sh.rotation.x = -1.25;
            R.sh.rotation.x = -1.25;
            L.elbow.rotation.x = -0.5;
            R.elbow.rotation.x = -0.5;
            break;
          case 'swing':
            relax();
            if (o.seated) legs.forEach((l, i) => (l.knee.rotation.x = Math.PI / 2 + Math.sin(ph * 2.6 + i * Math.PI) * 0.35));
            break;
          case 'rock':
            relax();
            rig.spine.rotation.x = (o.crouch ? 0.45 : 0.2) + Math.sin(ph * 1.4) * 0.14;
            break;
          case 'twitch':
            relax();
            if (Math.random() < dt * 1.2) anim.twitch = (Math.random() - 0.5) * 1.4;
            anim.twitch *= Math.pow(0.02, dt);
            head.rotation.z = anim.twitch + 0.25;
            arms.forEach((a, i) => (a.elbow.rotation.x = -0.1 + Math.sin(ph * 13 + i) * 0.05));
            break;
          case 'walk': {
            const sp = Math.min(1.5, anim.speed);
            anim.walkT = (anim.walkT || 0) + dt * (3 + sp * 3);
            const w = Math.sin(anim.walkT) * 0.5 * Math.min(1, sp);
            legs[0].thigh.rotation.x = w;
            legs[1].thigh.rotation.x = -w;
            legs[0].knee.rotation.x = Math.max(0, -Math.sin(anim.walkT)) * 0.7 * Math.min(1, sp);
            legs[1].knee.rotation.x = Math.max(0, Math.sin(anim.walkT)) * 0.7 * Math.min(1, sp);
            L.sh.rotation.x = -w * 0.7;
            R.sh.rotation.x = w * 0.7;
            break;
          }
          case 'lean':
            relax();
            rig.spine.rotation.x += (0.6 - rig.spine.rotation.x) * Math.min(1, dt * 2);
            break;
          default:
            relax();
        }
        // 盯著鏡頭看
        if (anim.track && cam) {
          tmp.copy(cam);
          g.worldToLocal(tmp);
          const headY = hipY + tH + 0.2 * s;
          const yaw = Math.max(-1.25, Math.min(1.25, Math.atan2(tmp.x, tmp.z)));
          const pitch = Math.max(-0.6, Math.min(0.6, -Math.atan2(tmp.y - headY, Math.hypot(tmp.x, tmp.z))));
          anim.look.yaw += (yaw - anim.look.yaw) * Math.min(1, dt * (anim.snap ? 30 : 2.5));
          anim.look.pitch += (pitch - anim.look.pitch) * Math.min(1, dt * 2.5);
          head.rotation.y = anim.look.yaw;
          head.rotation.x = anim.look.pitch;
        }
      },
    };
    g.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    return g;
  }

  /* ================================================================ 共用模板 */

  function shell(A, o) {
    const M = A.M;
    const L = o.L ?? 24;
    const wm = o.wallMat || M.wall;
    const fm = o.floorMat || M.tile;
    A.floor(-1.6, 1.6, -3, L, fm);
    A.ceil(-1.6, 1.6, -3, L, M.ceil);
    A.wallX(-3, -1.6, 1.6, [], wm);
    if (!o.noEnd) {
      const gaps = o.endDoor ? [[-0.6, 0.6]] : o.endWindow === false ? [] : [[-0.8, 0.8, 1.0, 2.3]];
      A.wallX(L, -1.6, 1.6, gaps, wm);
      if (!o.endDoor && o.endWindow !== false) {
        A.plane(1.6, 1.3, M.city, 0, 1.65, L + 0.2, Math.PI);
        A.plane(1.6, 1.3, M.glass, 0, 1.65, L, Math.PI);
      }
    }
    const leftGaps = [...(o.elevator === false ? [] : [[-2.1, -0.9]]), ...(o.leftGaps || [])];
    const rightGaps = [...(o.stairs === false ? [] : [[-2.1, -0.9]]), ...(o.rightGaps || [])];
    A.wallZ(-1.5, -3, L, leftGaps, wm);
    A.wallZ(1.5, -3, L, rightGaps, wm);
    A.tube(0, -1.5, { len: 1.0 });
    A.light(0, 2.6, -1.5, { intensity: 0.8 });
    if (o.elevator !== false) cab(A);
    if (o.stairs !== false) landing(A, o);
    A.zone('hall', -1.5, 1.5, -3, 0);
    A.zone('corridor', -1.5, 1.5, 0, L);
  }

  function cab(A) {
    const M = A.M;
    const x0 = -3.9;
    const z0 = -2.6;
    const z1 = -0.4;
    A.floor(x0, -1.4, z0, z1, M.cabFloor);
    A.ceil(x0, -1.6, z0, z1, M.cab, 2.6);
    A.box(x0 - 0.2, x0, 0, 2.7, z0 - 0.1, z1 + 0.1, M.cab);
    A.box(x0, -1.6, 0, 2.7, z0 - 0.2, z0, M.cab);
    A.box(x0, -1.6, 0, 2.7, z1, z1 + 0.2, M.cab);
    A.box(x0, -1.6, 2.6, 3, z0, z1, M.cab, { collide: false });
    A.box(-3.2, -2.3, 2.55, 2.58, -1.9, -1.1, A.tubeMat, { collide: false });
    A.box(x0 + 0.02, x0 + 0.06, 0.9, 0.95, z0 + 0.2, z1 - 0.2, M.plain, { collide: false });
    const dl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.1, 0.62), M.cab);
    const dr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.1, 0.62), M.cab);
    dl.position.set(-1.64, 1.05, -1.8);
    dr.position.set(-1.64, 1.05, -1.2);
    A.group.add(dl, dr);
    const panelMesh = A.sign(window.NP3D_TEX.elevatorPanel(false), 0.2, 0.4, -2.2, 1.25, -0.61, Math.PI);
    A.sign(window.NP3D_TEX.label('▲▼', { w: 32, h: 32, bg: '#9da2a3', size: 14 }), 0.1, 0.1, -1.39, 1.2, -0.45, Math.PI / 2);
    A.elevator = {
      doorL: dl, doorR: dr, open: 0, target: 0,
      collider: A.collide(-1.66, -1.44, -2.1, -0.9, 'elevDoor'),
      cab: A.zone('cab', x0, -1.6, z0, z1),
      panelMesh,
      threshold: -1.55 + A.ox,
    };
    A.anchor('elevCall', -1.39, 1.2, -0.45);
    A.anchor('elevPanel', -2.2, 1.25, -0.61);
  }

  function landing(A, o) {
    const M = A.M;
    const wm = M.wallStair;
    A.floor(1.4, 4.0, -4.0, 0.2, M.concrete);
    A.ceil(1.6, 4.0, -4.0, 0.2, M.concrete, H);
    A.box(1.5, 7.4, -2.4, 5, -4.2, -4.0, wm);
    A.box(1.5, 7.4, -2.4, 5, 0.2, 0.4, wm);
    A.box(7.2, 7.4, -2.4, 5, -4.2, 0.4, wm, { collide: false });
    A.box(4.0, 7.2, -2.4, 5, -2.06, -1.94, wm, { collide: false });
    A.box(4.0, 7.2, 4.6, 4.7, -4.0, 0.2, M.concrete, { collide: false });
    for (let i = 0; i < 10; i++) {
      const xa = 4.0 + i * 0.3;
      A.box(xa, xa + 0.3, -0.2, (i + 1) * 0.18, -4.0, -2.06, M.concrete, { collide: false });
      A.box(xa, xa + 0.3, -2.4, -(i + 1) * 0.18, -1.94, 0.2, M.concrete, { collide: false });
    }
    A.box(4.0, 7.2, 0.95, 1.0, -2.1, -1.9, M.iron, { collide: false });
    A.collide(3.95, 7.4, -4.0, 0.2);
    const sign = A.sign(window.NP3D_TEX.floorSign(o.sign || A.label), 0.9, 0.45, 1.61, 2.38, -1.5, Math.PI / 2);
    A.sign(window.NP3D_TEX.floorSign(o.sign || A.label), 0.6, 0.3, 3.2, 1.75, -3.89, 0);
    A.plane(0.5, 0.19, M.exit, 1.39, 2.45, -1.5, -Math.PI / 2);
    A.tube(2.8, -1.9, { len: 1.0 });
    A.light(2.8, 2.6, -1.9, { intensity: 0.7, color: 0xd9e0d0 });
    A.stairs = {
      sign,
      zone: A.zone('landing', 1.5, 4.0, -4.0, 0.2),
      up: { x: 4.05, y: 0.8, z: -3.0 },
      down: { x: 4.05, y: 0.4, z: -0.9 },
      upPath: [[3.5, 0, -3.0], [4.1, 0.05, -3.0], [6.8, 1.65, -3.0]],
      downPath: [[3.5, 0, -0.9], [4.1, -0.05, -0.9], [6.8, -1.65, -0.9]],
      fromBelow: [[6.8, -1.65, -0.9], [4.1, -0.05, -0.9], [2.6, 0, -0.9]],
      fromAbove: [[6.8, 1.65, -3.0], [4.1, 0.05, -3.0], [2.6, 0, -3.0]],
    };
    A.anchor('stairsUp', 4.05, 0.8, -3.0);
    A.anchor('stairsDown', 4.05, 0.4, -0.9);
  }

  function punchClock(A, x, z, rotY) {
    const M = A.M;
    const dx = Math.abs(Math.sin(rotY)) > 0.5 ? Math.sign(Math.sin(rotY)) * 0.04 : 0;
    const dz = Math.abs(Math.cos(rotY)) > 0.5 ? Math.sign(Math.cos(rotY)) * 0.04 : 0;
    const m = A.plane(0.3, 0.45, M.punch, x + dx, 1.35, z + dz, rotY);
    const backing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.06), M.plain);
    backing.position.set(x, 1.35, z);
    backing.rotation.y = rotY;
    A.group.add(backing);
    A.props.punch = m;
    A.anchor('punch', x + dx * 2, 1.35, z + dz * 2);
  }

  function chair(A, x, z, rotY, mat) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), mat);
    seat.position.y = 0.44;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), mat);
    back.position.set(0, 0.72, -0.22);
    g.add(seat, back);
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.04), A.M.darkPlastic);
      leg.position.set(lx, 0.22, lz);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    A.group.add(g);
    return g;
  }

  function car(A, x, z, color) {
    const M = A.M;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    A.group.add(g);
    const paint = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.7, 1.75), paint);
    body.position.y = 0.6;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 1.55), M.carGlass);
    cabin.position.set(0.2, 1.22, 0);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 1.5), paint);
    roof.position.set(0.25, 1.52, 0);
    g.add(body, cabin, roof);
    for (const [wx, wz] of [[-1.25, -0.8], [1.25, -0.8], [-1.25, 0.8], [1.25, 0.8]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10), M.rubber);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.32, wz);
      g.add(w);
    }
    const lights = [];
    for (const lz of [-0.6, 0.6]) {
      const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.14), M.plain);
      hl.position.set(-1.91, 0.68, lz);
      hl.rotation.y = -Math.PI / 2;
      g.add(hl);
      lights.push(hl);
    }
    const cover = new THREE.Group();
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(3.95, 0.82, 1.9), M.cloth);
    c1.position.y = 0.55;
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.7, 1.75), M.cloth);
    c2.position.set(0.2, 1.25, 0);
    cover.add(c1, c2);
    g.add(cover);
    A.collide(x - 2.0, x + 2.0, z - 1.0, z + 1.0);
    return { group: g, cover, lights, paint, seat: new THREE.Vector3(x + 0.35 + A.ox, 0.05, z - 0.38) };
  }

  /* ================================================================ 各樓層 */

  function buildB1(A) {
    const M = A.M;
    A.sound = 'parking';
    A.stepMat = 'concrete';
    A.ambient = { fog: 0x040505, density: 0.095, sky: 0x2a2f33, ground: 0x070707, hemi: 0.38 };
    shell(A, { L: 0, noEnd: true, wallMat: M.wallStair, floorMat: M.concrete, sign: 'B1' });
    A.floor(-10, 10, 0, 26, M.concreteDark);
    A.ceil(-10, 10, 0, 26, M.concrete, 2.8);
    A.wallX(0, -10.1, -1.5, [], M.concrete);
    A.wallX(0, 1.5, 10.1, [], M.concrete);
    A.wallZ(-10, 0, 26, [], M.concrete);
    A.wallZ(10, 0, 26, [], M.concrete);
    A.wallX(26, -10.1, 10.1, [[-3, 3, 'open']], M.concrete);
    A.box(-3, 3, 0, 2.8, 26, 26.2, M.shutter);
    for (const px of [-4.5, 4.5]) {
      for (const pz of [7, 14, 21]) A.box(px - 0.3, px + 0.3, 0, 2.8, pz - 0.3, pz + 0.3, M.concrete);
    }
    for (let z = 2.6; z < 22; z += 2.6) A.box(5.4, 10, 0.001, 0.012, z - 0.04, z + 0.04, M.white, { collide: false });
    for (let z = 3; z < 25; z += 3) A.box(-0.05, 0.05, 0.001, 0.012, z, z + 1.4, M.white, { collide: false });
    A.box(-6.1, -5.9, 2.5, 2.7, 0, 26, M.plain, { collide: false });
    A.box(6.9, 7.1, 2.55, 2.75, 0, 26, M.plain, { collide: false });
    A.props.cars = [car(A, 7.9, 3.9, 0x3b4248), car(A, 7.9, 9.1, 0x5a1f1d), car(A, 7.9, 14.3, 0x2e3a2e)];
    A.box(-3.6, -2.9, 0, 1.3, 1.1, 1.6, M.plastic);
    A.sign(window.NP3D_TEX.label(['繳費機', 'PAY'], { w: 64, h: 64, bg: '#5d6c72', fg: '#e6ece9', size: 16 }), 0.5, 0.5, -3.25, 0.9, 1.62, 0);
    A.props.batteryBox = A.box(-3.4, -3.1, 1.3, 1.42, 1.2, 1.45, M.red, { collide: false });
    A.anchor('freeBattery', -3.25, 1.36, 1.35);
    punchClock(A, -4.19, 7, Math.PI / 2);
    A.plane(0.5, 0.19, M.exit, 0, 2.5, -2.89, 0);
    for (const [x, z] of [[0, 6], [0, 16], [6, 11]]) A.tube(x, z, { len: 1.2 });
    A.tube(-6, 20, { dead: true });
    A.light(0, 2.5, 6, { intensity: 0.9 });
    A.light(0, 2.5, 16, { intensity: 0.75, flicker: 0.3 });
    A.light(6, 2.5, 11, { intensity: 0.7 });
    A.zone('parking', -10, 10, 0, 26);
    A.anchor('stalkerSpawn', -8, 0, 24);
  }

  function build1F(A) {
    const M = A.M;
    A.ambient = { fog: 0x060708, density: 0.085, sky: 0x323d46, ground: 0x0a0a0b, hemi: 0.45 };
    shell(A, { L: 12, noEnd: true, floorMat: M.tileLobby, leftGaps: [[4.4, 8.0, 1.0, 2.1], [9.4, 10.6]], sign: '1F' });
    // 保全室
    A.floor(-5.5, -1.5, 2.6, 11.2, M.tile);
    A.ceil(-5.5, -1.5, 2.6, 11.2, M.ceil);
    A.wallX(2.6, -5.6, -1.5, [], M.wallGuard);
    A.wallX(11.2, -5.6, -1.5, [], M.wallGuard);
    A.wallZ(-5.5, 2.6, 11.2, [], M.wallGuard);
    A.plane(3.6, 1.1, M.glass, -1.5, 1.55, 6.2, Math.PI / 2);
    A.door('guard', -1.5, 10.6, 'z', 1.2, -1, M.doorGrey, Math.PI / 2);
    A.doors.guard.target = A.doors.guard.openAngle;
    A.doors.guard.angle = A.doors.guard.openAngle;
    A.doors.guard.pivot.rotation.y = A.doors.guard.openAngle;
    A.doors.guard.collider.enabled = false;
    A.box(-5.5, -4.7, 0, 0.76, 3.3, 8.6, M.wood);
    A.box(-5.5, -4.7, 0.76, 0.8, 3.3, 8.6, M.woodDark, { collide: false });
    // 監視器牆：4 × 3
    const cols = [4.1, 4.75, 5.4, 6.05];
    const rows = [2.05, 1.65, 1.25];
    A.props.monitors = [];
    rows.forEach((y, r) => {
      cols.forEach((z, c) => {
        A.box(-5.48, -5.2, y - 0.19, y + 0.19, z - 0.3, z + 0.3, M.darkPlastic, { collide: false });
        const scr = A.plane(0.5, 0.33, M.screenOff, -5.19, y, z, Math.PI / 2);
        A.props.monitors.push({ mesh: scr, cell: r * 4 + c });
      });
    });
    A.props.monitor13Box = A.box(-5.4, -5.0, 0.8, 1.16, 6.9, 7.4, M.darkPlastic, { collide: false });
    A.props.monitor13 = A.plane(0.36, 0.27, M.screenOff, -4.99, 0.99, 7.15, Math.PI / 2);
    A.box(-4.95, -4.8, 0.8, 0.86, 6.35, 6.55, M.red, { collide: false });
    A.anchor('power', -4.87, 0.85, 6.45);
    A.props.logbook = A.plane(0.42, 0.32, M.white, -5.08, 0.81, 3.95, Math.PI / 2, { rotX: -Math.PI / 2 });
    A.anchor('logbook', -5.0, 0.82, 3.95);
    A.box(-5.2, -4.95, 0.8, 0.88, 7.95, 8.3, M.darkPlastic, { collide: false });
    A.props.handset = A.box(-5.22, -4.95, 0.88, 0.94, 7.98, 8.27, M.rubber, { collide: false });
    A.anchor('phone', -5.05, 0.9, 8.1);
    chair(A, -4.0, 5.4, -Math.PI / 2, M.darkPlastic);
    A.anchor('chair', -4.0, 0.7, 5.4);
    A.box(-2.4, -1.7, 0, 1.0, 2.7, 3.3, M.doorGrey);
    A.sign(window.NP3D_TEX.label(['電池', '保全室專用'], { w: 64, h: 48, size: 14 }), 0.3, 0.22, -2.05, 0.7, 3.31, 0);
    A.anchor('battery', -2.05, 0.9, 3.35);
    A.sign(window.NP3D_TEX.label(['保全室'], { w: 128, h: 48, size: 26 }), 0.7, 0.26, -1.39, 2.4, 10.0, Math.PI / 2);
    A.tube(-3.5, 6.8, { len: 1.2 });
    A.light(-3.5, 2.6, 6.8, { intensity: 1.05, color: 0xe8e4d4, guard: true });
    A.zone('guardRoom', -5.5, -1.5, 2.6, 11.2);
    A.zone('guardDoor', -2.6, -0.3, 9.0, 11.0);
    // 大廳
    A.floor(-5, 5, 12, 24, M.tileLobby);
    A.ceil(-5, 5, 12, 24, M.ceil, 3.2);
    A.wallX(12, -5.1, -1.5, [], M.wall, 3.2);
    A.wallX(12, 1.5, 5.1, [], M.wall, 3.2);
    A.wallZ(-5, 12, 24, [], M.wall, 3.2);
    A.wallZ(5, 12, 24, [], M.wall, 3.2);
    A.box(-5, 5, 3.0, 3.2, 23.9, 24.1, M.darkPlastic, { collide: false });
    for (const x of [-5, -2.6, -1.1, 0, 1.1, 2.6, 5]) A.box(x - 0.05, x + 0.05, 0, 3.0, 23.95, 24.05, M.darkPlastic, { collide: false });
    A.plane(10, 3, M.glass, 0, 1.5, 24, Math.PI);
    A.collide(-5, 5, 23.9, 24.1);
    A.box(-0.9, 0.9, 1.0, 1.05, 23.85, 23.9, M.plain, { collide: false });
    A.anchor('exit', 0, 1.1, 23.8);
    A.sign(window.NP3D_TEX.mailboxes(), 1.6, 1.2, 4.89, 1.4, 17, -Math.PI / 2);
    A.sign(window.NP3D_TEX.directory(), 0.8, 0.96, -4.89, 1.6, 15.5, Math.PI / 2);
    A.sign(window.NP3D_TEX.label(['福安大廈', 'FU-AN BUILDING'], { w: 256, h: 64, bg: '#1d2226', fg: '#d8d2bf', size: 24 }), 2.2, 0.55, 0, 2.7, 12.11, 0);
    // 門外的街道
    A.floor(-20, 20, 24, 46, M.asphalt, -0.02);
    A.box(-20, 20, 0, 0.15, 25.5, 26.0, M.concrete, { collide: false });
    A.box(3.9, 4.1, 0, 4.2, 30, 30.2, M.darkPlastic, { collide: false });
    A.props.streetLamp = A.box(3.7, 4.3, 4.2, 4.4, 29.8, 30.4, M.lamp, { collide: false });
    A.props.outsideBuildings = [];
    for (const [x, w] of [[-14, 9], [-3, 8], [8, 10]]) {
      A.box(x - w / 2, x + w / 2, 0, 9, 42, 45, M.concreteDark, { collide: false });
      A.plane(w * 0.8, 6, M.city, x, 4.5, 41.9, Math.PI);
    }
    A.props.breakfast = A.box(-7, -3, 0, 2.8, 41.6, 41.8, M.shutter, { collide: false });
    A.sign(window.NP3D_TEX.label(['早餐'], { w: 64, h: 32, bg: '#b8452f', fg: '#fff2d8', size: 20 }), 1.4, 0.7, -5, 3.3, 41.5, Math.PI);
    A.props.sky = A.plane(80, 30, M.skyNight, 0, 10, 46, Math.PI);
    A.tube(0, 18, { len: 1.4, y: 3.16 });
    A.tube(0, 5, { len: 1.2 });
    A.light(0, 2.8, 18, { intensity: 0.85 });
    A.light(0, 2.6, 5, { intensity: 0.8 });
    A.zone('lobby', -5, 5, 12, 24);
    A.anchor('spawn', -3.4, 0, 6.2);
    A.anchor('stalkerSpawn', 0, 0, 22);
    A.rooms.push({ zone: 'guardRoom', door: A.w(-1.5, 0, 10.0) });
  }

  function build2F(A) {
    const M = A.M;
    shell(A, { L: 24, wallMat: M.wallClinic, floorMat: M.tileClinic, leftGaps: [[6.4, 8.0]], rightGaps: [[10, 11.2]], sign: '2F' });
    A.floor(-8, -1.5, 2, 12, M.tileClinic);
    A.ceil(-8, -1.5, 2, 12, M.ceil);
    A.wallX(2, -8.1, -1.5, [], M.wallClinic);
    A.wallX(12, -8.1, -1.5, [], M.wallClinic);
    A.wallZ(-8, 2, 12, [], M.wallClinic);
    A.box(-3.6, -1.7, 0, 1.05, 2.2, 3.0, M.wood);
    A.box(-3.7, -1.6, 1.05, 1.1, 2.15, 3.05, M.white, { collide: false });
    A.props.waitChairs = [];
    for (const x of [-5.9, -4.4]) {
      for (let z = 4.4; z <= 10.6; z += 1.55) A.props.waitChairs.push(chair(A, x, z, -Math.PI / 2, M.plastic));
    }
    A.collide(-6.2, -4.1, 4.1, 10.9);
    A.box(-7.98, -7.85, 1.55, 2.35, 6.4, 7.8, M.darkPlastic, { collide: false });
    A.props.tv = A.plane(1.3, 0.72, M.tv, -7.84, 1.95, 7.1, Math.PI / 2);
    A.anchor('tv', -7.8, 1.95, 7.1);
    A.box(-7.9, -7.0, 0, 0.8, 10.4, 11.8, M.wood);
    A.box(-7.85, -7.05, 0.8, 1.35, 10.5, 11.7, M.aquarium, { collide: false });
    A.props.shutter = A.box(-1.56, -1.44, 1.05, 2.1, 6.4, 8.0, M.shutter, { collide: false });
    A.props.shutter.visible = false;
    A.sign(window.NP3D_TEX.label(['安心牙醫診所'], { w: 256, h: 48, bg: '#e8f0ef', fg: '#2c5a63', size: 28 }), 1.5, 0.28, -1.39, 2.45, 7.2, Math.PI / 2);
    A.floor(1.5, 7.5, 9, 17, M.tileClinic);
    A.ceil(1.5, 7.5, 9, 17, M.ceil);
    A.wallX(9, 1.5, 7.6, [], M.wallClinic);
    A.wallX(17, 1.5, 7.6, [], M.wallClinic);
    A.wallZ(7.5, 9, 17, [], M.wallClinic);
    A.box(4.0, 5.6, 0, 0.5, 12.4, 13.2, M.plastic);
    A.box(4.0, 4.4, 0.5, 1.2, 12.4, 13.2, M.plastic, { collide: false });
    A.box(4.4, 5.8, 0.5, 0.62, 12.4, 13.2, M.white, { collide: false });
    A.box(5.6, 5.7, 0.62, 2.0, 12.0, 12.1, M.plain, { collide: false });
    A.box(5.2, 5.8, 1.95, 2.05, 11.9, 12.4, M.white, { collide: false });
    A.box(6.8, 7.4, 0, 1.2, 9.5, 11.0, M.white);
    punchClock(A, 1.39, 5, -Math.PI / 2);
    A.tube(0, 5);
    A.tube(0, 17);
    A.tube(-4.5, 7);
    A.tube(4.5, 13, { dead: true });
    A.light(0, 2.6, 5, { intensity: 0.85 });
    A.light(0, 2.6, 17, { intensity: 0.7, flicker: 0.2 });
    A.light(-4.5, 2.6, 7, { intensity: 0.8 });
    A.zone('waiting', -8, -1.5, 2, 12);
    A.zone('treat', 1.5, 7.5, 9, 17);
    A.rooms.push({ zone: 'waiting', door: A.w(-1.5, 0, 7.2) }, { zone: 'treat', door: A.w(1.5, 0, 10.6) });
    A.anchor('stalkerSpawn', 0, 0, 22.5);
    A.anchor('woman', -1.0, 0, 7.6);
  }

  function build3F(A) {
    const M = A.M;
    shell(A, { L: 24, wallMat: M.wallSchool, floorMat: M.tileSchool, rightGaps: [[3.6, 4.8]], leftGaps: [[14, 15.2]], sign: '3F' });
    A.floor(1.5, 9.5, 3, 15, M.tileSchool);
    A.ceil(1.5, 9.5, 3, 15, M.ceil);
    A.wallX(3, 1.5, 9.6, [], M.wallSchool);
    A.wallX(15, 1.5, 9.6, [], M.wallSchool);
    A.wallZ(9.5, 3, 15, [], M.wallSchool);
    A.box(9.32, 9.4, 0.6, 2.4, 7.3, 10.7, M.plain, { collide: false });
    A.props.board = A.plane(3.2, 1.6, new THREE.MeshLambertMaterial({ map: window.NP3D_TEX.whiteboard('formula') }), 9.31, 1.5, 9, -Math.PI / 2);
    A.anchor('board', 9.25, 1.5, 9);
    A.box(8.0, 8.8, 0, 0.78, 8.3, 9.7, M.wood);
    A.props.desks = [];
    for (const x of [3.6, 5.1, 6.6]) {
      for (const z of [5.4, 7.6, 9.8, 12.0]) {
        A.box(x - 0.25, x + 0.25, 0, 0.72, z - 0.45, z + 0.45, M.wood, { collide: false });
        chair(A, x - 0.55, z, Math.PI / 2, M.wood);
        A.props.desks.push(A.w(x - 0.55, 0, z));
      }
      A.collide(x - 0.3, x + 0.3, 4.9, 12.5);
    }
    A.sign(window.NP3D_TEX.label(['明日之星補習班'], { w: 256, h: 48, bg: '#f2e7c4', fg: '#8a2b1d', size: 28 }), 1.5, 0.28, 1.39, 2.45, 4.2, -Math.PI / 2);
    A.sign(window.NP3D_TEX.poster(), 0.6, 0.8, -1.39, 1.6, 2.4, Math.PI / 2);
    for (let z = 4.2; z < 9; z += 0.45) {
      const c = [0x8a3b3b, 0x3b5a8a, 0x4f7a3b][Math.floor(z * 3) % 3];
      const mat = new THREE.MeshLambertMaterial({ color: c });
      A.box(-1.38, -1.25, 0, 0.05, z, z + 0.2, mat, { collide: false });
      A.box(-1.22, -1.09, 0, 0.05, z, z + 0.2, mat, { collide: false });
    }
    A.floor(-6, -1.5, 13, 19, M.tile);
    A.ceil(-6, -1.5, 13, 19, M.ceil);
    A.wallX(13, -6.1, -1.5, [], M.wallSchool);
    A.wallX(19, -6.1, -1.5, [], M.wallSchool);
    A.wallZ(-6, 13, 19, [], M.wallSchool);
    A.box(-5.8, -4.6, 0, 0.76, 15, 17.5, M.wood);
    A.box(-5.95, -5.6, 0, 2.0, 13.3, 15.0, M.woodDark);
    punchClock(A, -1.39, 11, Math.PI / 2);
    A.tube(0, 7);
    A.tube(0, 19);
    A.tube(5.5, 9, { len: 1.4 });
    A.light(0, 2.6, 7, { intensity: 0.8 });
    A.light(0, 2.6, 19, { intensity: 0.65 });
    A.light(5.5, 2.6, 9, { intensity: 0.85, flicker: 0.15 });
    A.zone('classroom', 1.5, 9.5, 3, 15);
    A.zone('office', -6, -1.5, 13, 19);
    A.rooms.push({ zone: 'classroom', door: A.w(1.5, 0, 4.2) }, { zone: 'office', door: A.w(-1.5, 0, 14.6) });
    A.anchor('child', 3.05, 0, 5.4);
    A.anchor('stalkerSpawn', 0, 0, 22.5);
  }

  function build5F(A) {
    const M = A.M;
    A.stepMat = 'carpet';
    shell(A, { L: 3, noEnd: true, wallMat: M.wallOffice, sign: '5F' });
    A.floor(-9, 9, 3, 22, M.carpet);
    A.ceil(-9, 9, 3, 22, M.ceil);
    A.wallX(3, -9.1, -1.5, [], M.wallOffice);
    A.wallX(3, 1.5, 9.1, [], M.wallOffice);
    const win = [[-6, -3, 1.0, 2.3], [3, 6, 1.0, 2.3]];
    A.wallX(22, -9.1, 9.1, win, M.wallOffice);
    A.wallZ(-9, 3, 22, [[8, 11, 1.0, 2.3], [15, 18, 1.0, 2.3]], M.wallOffice);
    A.wallZ(9, 3, 22, [[8, 11, 1.0, 2.3], [15, 18, 1.0, 2.3]], M.wallOffice);
    for (const [x, z, r] of [[-4.5, 22.2, Math.PI], [4.5, 22.2, Math.PI], [-9.2, 9.5, Math.PI / 2], [-9.2, 16.5, Math.PI / 2], [9.2, 9.5, -Math.PI / 2], [9.2, 16.5, -Math.PI / 2]]) {
      A.plane(3, 1.3, M.city, x, 1.65, z, r);
    }
    A.props.partitions = [];
    const part = (x0, x1, z0, z1) => {
      const m = A.box(x0, x1, 0, 1.35, z0, z1, M.fabric);
      A.props.partitions.push(m);
      return m;
    };
    for (const bx of [-7.5, 3]) {
      for (const bz of [6, 12]) {
        part(bx, bx + 4.5, bz, bz + 0.06);
        part(bx, bx + 4.5, bz + 3.5, bz + 3.56);
        part(bx + 2.22, bx + 2.28, bz, bz + 3.5);
      }
    }
    part(-5.5, -3.5, 20.2, 20.26);
    A.props.roster = A.plane(0.5, 0.5, new THREE.MeshLambertMaterial({ map: window.NP3D_TEX.roster('', 1) }), -4.5, 1.0, 20.16, Math.PI);
    A.anchor('roster', -4.5, 1.0, 20.12);
    A.props.redWalls = [];
    const red = new THREE.MeshLambertMaterial({
      map: window.NP3D_TEX.handwriting(
        ['上七樓的時候', '手電筒一直照著自己的影子', '不要把光移開', '不管誰叫你都不要照過去', '它可以假裝成任何人', '但它沒有影子', '——陳'],
        { w: 256, h: 256, size: 20, dense: true, seed: 41 },
      ),
      transparent: true,
      alphaTest: 0.4,
    });
    for (const [x, z, r] of [[-4.5, 20.13, Math.PI], [-5.25, 6.07, 0], [3.75, 12.07, 0], [-5.25, 15.57, Math.PI], [5.25, 9.57, Math.PI], [-2.0, 3.12, 0], [2.0, 21.88, Math.PI]]) {
      const m = A.plane(1.9, 1.25, red, x, 0.68, z, r);
      m.visible = false;
      A.props.redWalls.push(m);
    }
    A.box(8.1, 8.6, 0, 1.2, 20.4, 20.9, M.white);
    punchClock(A, 3.5, 3.11, 0);
    A.tube(-4.5, 9, { len: 1.4 });
    A.tube(4.5, 15, { len: 1.4 });
    A.tube(-4.5, 16, { len: 1.4, dead: true });
    A.tube(0, 1.5);
    A.light(-4.5, 2.6, 9, { intensity: 0.75, flicker: 0.35 });
    A.light(4.5, 2.6, 15, { intensity: 0.75 });
    A.light(0, 2.6, 1.5, { intensity: 0.6 });
    A.zone('office', -9, 9, 3, 22);
    A.anchor('stalkerSpawn', 6, 0, 20);
  }

  function build6F(A) {
    const M = A.M;
    shell(A, { L: 24, wallMat: M.wallStair, floorMat: M.concrete, rightGaps: [[6, 7.2]], leftGaps: [[13, 14.2]], endDoor: true, sign: '6F' });
    A.stepMat = 'concrete';
    A.floor(1.5, 9, 5, 17, M.concrete);
    A.ceil(1.5, 9, 5, 17, M.concrete);
    A.wallX(5, 1.5, 9.1, [], M.concrete);
    A.wallX(17, 1.5, 9.1, [], M.concrete);
    A.wallZ(9, 5, 17, [], M.concrete);
    A.box(3.8, 6.2, 0, 2.0, 8.0, 10.0, M.doorGrey);
    A.box(3.8, 6.2, 0, 2.0, 11.6, 13.6, M.doorGrey);
    A.box(7.0, 8.6, 0, 1.6, 14.4, 16.4, M.doorGrey);
    for (const z of [8.5, 12.1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.2, 8), M.iron);
      p.rotation.z = Math.PI / 2;
      p.position.set(5.4, 2.5, z);
      A.group.add(p);
    }
    A.sign(window.NP3D_TEX.label(['機房', '閒人勿進'], { w: 128, h: 64, bg: '#d8c63a', fg: '#1a1a1a', size: 22 }), 0.6, 0.3, 1.39, 2.4, 6.6, -Math.PI / 2);
    A.floor(-6, -1.5, 12, 20, M.concrete);
    A.ceil(-6, -1.5, 12, 20, M.concrete);
    A.wallX(12, -6.1, -1.5, [], M.wallStair);
    A.wallX(20, -6.1, -1.5, [], M.wallStair);
    A.wallZ(-6, 12, 20, [], M.wallStair);
    for (const [x, z, h] of [[-5.2, 15, 1.2], [-5.2, 16.2, 0.8], [-4.0, 18.8, 1.0], [-5.2, 18.8, 1.6]]) A.box(x - 0.45, x + 0.45, 0, h, z - 0.45, z + 0.45, M.cloth);
    // 頂樓鐵門
    A.door('roof', 0.6, 24, 'x', 1.2, -1, M.iron, 1.7);
    A.props.chains = new THREE.Group();
    for (const [y, r] of [[0.9, 0.5], [1.3, -0.45], [1.7, 0.4]]) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.04), M.plain);
      ch.position.set(0, y, 23.92);
      ch.rotation.z = r * 0.3;
      A.props.chains.add(ch);
    }
    A.props.redThread = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.015, 0.015), M.redString);
    A.props.redThread.position.set(0, 1.1, 23.9);
    A.props.redThread.rotation.z = 0.12;
    A.props.chains.add(A.props.redThread);
    A.group.add(A.props.chains);
    A.anchor('roofDoor', 0, 1.2, 23.8);
    // 頂樓
    A.props.rooftop = new THREE.Group();
    A.group.add(A.props.rooftop);
    const rt = { parent: A.props.rooftop };
    A.box(-7, 7, -0.1, 0, 24.1, 37, M.concreteDark, { ...rt, collide: false });
    A.box(-7, 7, 0, 1.0, 37, 37.3, M.concrete, rt);
    A.box(-7.3, -7, 0, 1.0, 24, 37, M.concrete, rt);
    A.box(7, 7.3, 0, 1.0, 24, 37, M.concrete, rt);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 12), M.plain);
    tank.position.set(3.8, 1.6, 32);
    A.props.rooftop.add(tank);
    A.props.uniforms = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const u = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), M.uniform);
      u.material = M.uniform.clone();
      u.material.side = THREE.DoubleSide;
      u.position.set(-4 + i * 1.1, 1.6, 29);
      A.props.uniforms.add(u);
    }
    A.props.uniforms.visible = false;
    A.props.rooftop.add(A.props.uniforms);
    A.plane(60, 30, M.skyNight, 0, 8, 48, Math.PI, { parent: A.props.rooftop });
    A.props.rooftop.visible = false;
    // 第五條的走廊（E_ROOF）
    A.props.endless = new THREE.Group();
    A.group.add(A.props.endless);
    const ec = { parent: A.props.endless };
    A.box(-1.6, 1.6, -0.1, 0, 24, 70, M.tile, { ...ec, collide: false });
    A.box(-1.8, -1.6, 0, 3, 24, 70, M.wall7, { ...ec, collide: false });
    A.box(1.6, 1.8, 0, 3, 24, 70, M.wall7, { ...ec, collide: false });
    A.box(-1.6, 1.6, 3, 3.1, 24, 70, M.ceil, { ...ec, collide: false });
    A.props.endless.visible = false;
    punchClock(A, -1.39, 8, Math.PI / 2);
    A.props.machine = A.w(5, 1, 11);
    A.tube(0, 8);
    A.tube(0, 19, { dead: true });
    A.tube(5, 11, { len: 1.4 });
    A.light(0, 2.6, 8, { intensity: 0.8 });
    A.light(0, 2.6, 20, { intensity: 0.45, flicker: 0.5 });
    A.light(5, 2.6, 11, { intensity: 0.7 });
    A.zone('machine', 1.5, 9, 5, 17);
    A.zone('storage', -6, -1.5, 12, 20);
    A.zone('roofDoorZone', -1.5, 1.5, 20, 24);
    A.zone('rooftop', -7, 7, 24.1, 37);
    A.rooms.push({ zone: 'machine', door: A.w(1.5, 0, 6.6) }, { zone: 'storage', door: A.w(-1.5, 0, 13.6) });
    A.anchor('stalkerSpawn', 0, 0, 22);
  }

  function build4F(A) {
    const M = A.M;
    A.ambient = { fog: 0x030303, density: 0.14, sky: 0x1a1a1a, ground: 0x050505, hemi: 0.28 };
    A.sound = 'void';
    shell(A, { L: 18, stairs: false, endWindow: false, wallMat: M.wall7, sign: '4' });
    A.lightSpots.length = 0;
    for (let z = 3; z < 17; z += 3.2) {
      for (const [x, r] of [[-1.39, Math.PI / 2], [1.39, -Math.PI / 2]]) {
        A.box(x > 0 ? 1.4 : -1.45, x > 0 ? 1.45 : -1.4, 0, 2.1, z - 0.5, z + 0.5, M.woodDark, { collide: false });
        A.sign(window.NP3D_TEX.label('4', { w: 32, h: 32, bg: '#cfc8b4', size: 22 }), 0.14, 0.14, x + (x > 0 ? -0.07 : 0.07), 1.7, z, r);
      }
    }
    A.props.crowd = new THREE.Group();
    A.props.backs = new THREE.Group();
    A.group.add(A.props.crowd, A.props.backs);
    const spots = [[-0.6, 0.8], [0.5, 1.3], [-0.2, 2.4], [0.8, 3.1], [-0.9, 3.8], [0.2, 4.9], [-0.5, 6.2], [0.7, 7.0], [0, 8.6]];
    spots.forEach(([x, z], i) => {
      const f = makeFigure(M, i % 3 === 1 ? 'woman' : 'adult', { variant: i });
      f.userData.setAnim('idle', { track: true });
      f.position.set(x, 0, z);
      f.rotation.y = Math.PI;
      A.props.crowd.add(f);
    });
    for (let i = 0; i < 14; i++) {
      const f = makeFigure(M, i % 4 === 0 ? 'woman' : 'adult', { variant: i });
      f.position.set(((i % 3) - 1) * 0.8 + (i % 2) * 0.2, 0, 0.6 + Math.floor(i / 3) * 1.1);
      A.props.backs.add(f);
    }
    A.props.guard = makeFigure(M, 'guard');
    A.props.guard.userData.setAnim('beckon');
    A.props.guard.position.set(0, 0, 16.8);
    A.props.guard.rotation.y = Math.PI;
    A.group.add(A.props.guard);
    A.props.crowd.visible = false;
    A.props.backs.visible = false;
    A.props.guard.visible = false;
    const pts = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      pts[i * 3] = (Math.random() - 0.5) * 2.8;
      pts[i * 3 + 1] = Math.random() * 3;
      pts[i * 3 + 2] = Math.random() * 14;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    A.props.smoke = new THREE.Points(geo, M.smoke);
    A.props.smoke.visible = false;
    A.group.add(A.props.smoke);
    A.tube(0, 6);
    A.tube(0, 12);
    A.props.litSpots = [
      { x: A.ox, y: 2.6, z: 5, color: 0xcfd6c4, intensity: 0.55, distance: 10, flicker: 0.1 },
      { x: A.ox, y: 2.6, z: 13, color: 0xcfd6c4, intensity: 0.5, distance: 10, flicker: 0 },
    ];
  }

  function build7F(A) {
    const M = A.M;
    A.ambient = { fog: 0x050303, density: 0.07, sky: 0x2a1c1a, ground: 0x050303, hemi: 0.3 };
    A.sound = 'void';
    shell(A, { L: 32, elevator: false, wallMat: M.wall7, floorMat: M.tile, sign: '7F', endWindow: false });
    A.lightSpots = A.lightSpots.filter((l) => l.z < -1.6 || l.x > A.ox + 1.6);
    A.door('stair7', 1.5, -0.9, 'z', 1.2, -1, M.doorGreen, -Math.PI / 2);
    A.stairs.sign.material = new THREE.MeshBasicMaterial({ map: A.stairs.sign.material.map, color: 0xb9ab98 });
    A.group.traverse((m) => {
      if (m.isMesh) m.receiveShadow = true;
    });
    const red = (seed) =>
      new THREE.MeshLambertMaterial({
        map: window.NP3D_TEX.handwriting(
          ['我不寫在守則上', '紙條在打卡鐘裡', '不要開門', '不要接電話', '照著影子走', '不要回頭', '耳東陳', '它沒有影子', '五點'],
          { w: 256, h: 256, size: 18, dense: true, seed },
        ),
        transparent: true,
        alphaTest: 0.4,
      });
    A.props.redWalls = [];
    for (let z = 1.5; z < 31; z += 2.9) {
      A.props.redWalls.push(A.plane(2.8, 2.4, red(50 + z), -1.39, 1.45, z, Math.PI / 2, { receive: true }));
      A.props.redWalls.push(A.plane(2.8, 2.4, red(80 + z), 1.39, 1.45, z, -Math.PI / 2, { receive: true }));
    }
    A.props.endWall = A.plane(2.9, 2.4, red(99), 0, 1.45, 31.89, Math.PI, { receive: true });
    // 第三夜：走廊盡頭坐著兩個老陳，各自在面前的半面牆上寫字。它描出來的字是反的
    // 字寫得大，反過來才看得出來
    const endLines = ['帶我回去', '耳東陳', '五點', '影子'];
    const texN = window.NP3D_TEX.handwriting(endLines, { w: 256, h: 256, size: 44, seed: 131 });
    const texM = texN.clone();
    texM.wrapS = THREE.RepeatWrapping;
    texM.repeat.x = -1;
    texM.offset.x = 1;
    texM.needsUpdate = true;
    const half = (x) => A.plane(1.42, 2.4, new THREE.MeshLambertMaterial({ map: texN, transparent: true, alphaTest: 0.4 }), x, 1.45, 31.86, Math.PI, { receive: true });
    A.props.endHalves = { '-1': half(-0.72), '1': half(0.72) };
    A.props.endTex = { normal: texN, mirror: texM };
    Object.values(A.props.endHalves).forEach((m) => (m.visible = false));
    A.props.fakeChen = makeFigure(M, 'chen', { floor: true, tag: '陳', mirrorTag: true });
    A.props.fakeChen.userData.setAnim('write');
    A.props.fakeChen.position.set(-0.75, 0, 30.9);
    A.props.fakeChen.visible = false;
    A.group.add(A.props.fakeChen);
    // 它學會了影子，但影子是它「描」出來的：左右相反（看不見的鏡像替身負責投影）
    A.props.fakeCaster = makeFigure(M, 'chen', { floor: true });
    A.props.fakeCaster.userData.setAnim('write');
    A.props.fakeCaster.scale.x = -1;
    A.props.fakeCaster.traverse((o) => {
      if (o.isMesh) o.material = M.invisible;
    });
    A.props.fakeCaster.visible = false;
    A.group.add(A.props.fakeCaster);
    A.props.stairText = A.sign(
      window.NP3D_TEX.handwriting(['繼續往上，出口在上面。'], { w: 256, h: 64, size: 22, seed: 7 }),
      1.4, 0.35, 1.62, 2.05, -1.5, Math.PI / 2, { alpha: true },
    );
    A.props.stairText.visible = false;
    A.props.chen = makeFigure(M, 'chen', { floor: true, tag: '陳' });
    A.props.chen.userData.setAnim('write');
    A.props.chen.position.set(0.15, 0, 30.9);
    A.group.add(A.props.chen);
    A.box(-1.0, -0.7, 0, 0.3, 30.6, 30.9, M.darkPlastic, { collide: false });
    A.props.lamp = A.box(-0.95, -0.75, 0.3, 0.45, 30.65, 30.85, M.lamp, { collide: false });
    A.zone('corr7', -1.5, 1.5, -3, 32);
    A.zone('door7', -1.5, 1.6, -2.2, 0.2);
    A.anchor('chen', 0.15, 0.9, 30.6);
    A.anchor('door7', 1.5, 1.0, -1.5);
  }

  /* ================================================================ 環境敘事 */

  /** 小道具工具組（本地座標） */
  function kit(A) {
    const M = A.M;
    const TEX = window.NP3D_TEX;
    const decalMat = (tex) => new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    return {
      fire(x, z, rotY) {
        const g = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.16), M.red);
        box.position.y = 1.1;
        const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshLambertMaterial({ map: TEX.label(['消防栓'], { w: 96, h: 32, bg: '#a8241b', fg: '#fff3e0', size: 22 }) }));
        lbl.position.set(0, 1.38, 0.081);
        const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), M.red);
        ext.position.set(0.48, 0.25, 0.02);
        const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06), M.darkPlastic);
        nozzle.position.set(0.48, 0.53, 0.02);
        g.add(box, lbl, ext, nozzle);
        g.position.set(x, 0, z);
        g.rotation.y = rotY;
        A.group.add(g);
      },
      camera(pos, look) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.24), M.white);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8), M.darkPlastic);
        lens.rotation.x = Math.PI / 2;
        lens.position.z = -0.13;
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), M.led);
        led.position.set(0.035, 0.035, -0.12);
        g.add(body, lens, led);
        g.position.copy(pos).sub(new THREE.Vector3(A.ox, 0, 0));
        A.group.add(g);
        g.lookAt(look);
        g.rotateY(Math.PI);
      },
      board(tex, w, h, x, y, z, rotY) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.03), M.woodDark);
        frame.position.set(x, y, z);
        frame.rotation.y = rotY;
        A.group.add(frame);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
        p.position.set(x + Math.sin(rotY) * 0.02, y, z + Math.cos(rotY) * 0.02);
        p.rotation.y = rotY;
        A.group.add(p);
        return p;
      },
      plant(x, z, h = 1.1) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.36, 9), M.plain);
        pot.position.set(x, 0.18, z);
        A.group.add(pot);
        const leaf = new THREE.MeshLambertMaterial({ color: 0x2c3a26 });
        for (let i = 0; i < 6; i++) {
          const l = new THREE.Mesh(new THREE.ConeGeometry(0.09, h * 0.7, 4), leaf);
          l.position.set(x + Math.cos(i) * 0.08, 0.36 + h * 0.35, z + Math.sin(i * 1.7) * 0.08);
          l.rotation.set(Math.cos(i * 2) * 0.4, i, Math.sin(i * 3) * 0.4);
          A.group.add(l);
        }
        A.collide(x - 0.22, x + 0.22, z - 0.22, z + 0.22);
      },
      boxes(x, z, n, seed = 1) {
        let r = seed;
        const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
        const mat = new THREE.MeshLambertMaterial({ map: TEX.label(['易碎', '福安搬家'], { w: 64, h: 64, bg: '#a0815a', fg: '#4a3420', size: 14 }) });
        let y = 0;
        for (let i = 0; i < n; i++) {
          const w = 0.5 + rand() * 0.2;
          const h = 0.38 + rand() * 0.12;
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.45), mat);
          b.position.set(x + (rand() - 0.5) * 0.1, y + h / 2, z + (rand() - 0.5) * 0.1);
          b.rotation.y = (rand() - 0.5) * 0.4;
          A.group.add(b);
          y += h;
        }
        A.collide(x - 0.35, x + 0.35, z - 0.3, z + 0.3);
      },
      papers(x0, x1, z0, z1, n, seed = 3) {
        let r = seed;
        const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
        const mat = new THREE.MeshLambertMaterial({ color: 0xd8d2c0, side: THREE.DoubleSide });
        for (let i = 0; i < n; i++) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), mat);
          p.rotation.set(-Math.PI / 2, 0, rand() * Math.PI);
          p.position.set(x0 + rand() * (x1 - x0), 0.004 + i * 0.0004, z0 + rand() * (z1 - z0));
          A.group.add(p);
        }
      },
      puddle(x, z, rad = 0.6) {
        const p = new THREE.Mesh(new THREE.CircleGeometry(rad, 14), M.puddle);
        p.rotation.x = -Math.PI / 2;
        p.scale.set(1, 0.6 + Math.random() * 0.4, 1);
        p.position.set(x, 0.006, z);
        A.group.add(p);
      },
      decal(tex, w, h, x, y, z, rotY = 0, rotX = 0) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), decalMat(tex));
        p.position.set(x, y, z);
        p.rotation.set(rotX, rotY, 0, 'YXZ');
        A.group.add(p);
        return p;
      },
      clock(x, y, z, rotY, h, m) {
        const c = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), new THREE.MeshLambertMaterial({ map: TEX.clockFace(h, m) }));
        c.position.set(x, y, z);
        c.rotation.y = rotY;
        A.group.add(c);
      },
      plaque(floor, name, bg, fg) {
        A.sign(TEX.plaque(floor, name, bg, fg), 1.5, 1.12, 0, 1.75, -2.885, 0);
      },
      wreath(x, z, rotY, words) {
        const g = new THREE.Group();
        for (const [lx, lz] of [[-0.3, -0.15], [0.3, -0.15], [0, 0.3]]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 5), M.woodDark);
          leg.position.set(lx, 0.65, lz);
          leg.rotation.x = lz > 0 ? -0.2 : 0.1;
          g.add(leg);
        }
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 6, 14), M.flowers);
        ring.position.y = 1.55;
        const inner = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 5, 12), M.flowersY);
        inner.position.set(0, 1.55, 0.03);
        const center = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshLambertMaterial({ map: TEX.label(['奠'], { w: 64, h: 64, bg: '#efeadb', fg: '#111', size: 40 }) }));
        center.position.set(0, 1.55, 0.04);
        g.add(ring, inner, center);
        for (const [i, side] of [[0, -1], [1, 1]]) {
          const b = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.7), new THREE.MeshLambertMaterial({ map: TEX.wreathBanner(words[i]), side: THREE.DoubleSide }));
          b.position.set(side * 0.5, 1.05, 0.06);
          g.add(b);
        }
        g.position.set(x, 0, z);
        g.rotation.y = rotY;
        A.group.add(g);
        return g;
      },
    };
  }

  const LIGHT_COLORS = { B1: 0xffb46e, '1F': 0xe8e2cf, '2F': 0xd0eef2, '3F': 0xf2dca4, '5F': 0xaec0e6, '6F': 0xc6dbb4, '4F': 0xd8cf9a };
  const AMBIENTS = {
    B1: { fog: 0x0b0806, density: 0.095, sky: 0x3a2c1e, ground: 0x080605, hemi: 0.4 },
    '2F': { fog: 0x05090a, density: 0.1, sky: 0x2a4046, ground: 0x07090a, hemi: 0.42 },
    '3F': { fog: 0x0a0805, density: 0.1, sky: 0x40382a, ground: 0x0a0806, hemi: 0.42 },
    '5F': { fog: 0x05070c, density: 0.1, sky: 0x28344a, ground: 0x06070a, hemi: 0.4 },
    '6F': { fog: 0x060806, density: 0.1, sky: 0x2c3a2a, ground: 0x070807, hemi: 0.4 },
  };

  function dress(A) {
    const K = kit(A);
    const TEX = window.NP3D_TEX;
    const M = A.M;
    const id = A.id;
    for (const s of A.lightSpots) if (!s.guard && LIGHT_COLORS[id] && s.x <= A.ox + 1.6) s.color = LIGHT_COLORS[id];
    if (AMBIENTS[id]) A.ambient = AMBIENTS[id];
    const stains = [TEX.stain(1), TEX.stain(2), TEX.stain(3)];
    const stainRun = (n, seed) => {
      for (let i = 0; i < n; i++) {
        const z = ((seed * 7 + i * 5.3) % 22) + 1;
        const side = i % 3;
        if (side === 0) K.decal(stains[i % 3], 1.2, 1.0, (i % 2 ? 0.5 : -0.4), 2.985, z, 0, Math.PI / 2);
        else K.decal(stains[i % 3], 1.0, 1.4, side === 1 ? 1.385 : -1.385, 2.2, z, side === 1 ? -Math.PI / 2 : Math.PI / 2);
      }
    };

    if (id === 'B1') {
      K.plaque('B1', '停車場', '#1f1a14', '#e0a83c');
      [[-2, 8, 0.9], [3.5, 18, 0.7], [-6, 15, 1.1], [1.2, 23, 0.6]].forEach(([x, z, r]) => K.puddle(x, z, r));
      for (const c of A.props.cars) K.decal(stains[1], 1.6, 1.2, c.group.position.x - 0.5, 0.008, c.group.position.z, 0, -Math.PI / 2);
      let n = 1;
      for (const px of [-4.5, 4.5]) {
        for (const pz of [7, 14, 21]) {
          const face = px < 0 ? px + 0.31 : px - 0.31;
          A.sign(TEX.label([`B1-${String.fromCharCode(64 + n)}`], { w: 64, h: 32, bg: '#d9b42c', fg: '#151515', size: 18 }), 0.4, 0.2, face, 2.0, pz, px < 0 ? Math.PI / 2 : -Math.PI / 2);
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.35, 0.63), new THREE.MeshLambertMaterial({ map: TEX.hazard() }));
          band.position.set(px, 0.175, pz);
          A.group.add(band);
          n++;
        }
      }
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.8, 10), M.darkPlastic);
      bin.position.set(-8.9, 0.4, 1.5);
      A.group.add(bin);
      K.fire(-9.9 + 0.09, 6, Math.PI / 2);
    }

    if (id === '1F') {
      K.plaque('1F', '管理室・大廳', '#20262b', '#d8d2bf');
      K.board(TEX.notices(), 1.5, 1.0, 4.88, 1.6, 21, -Math.PI / 2);
      K.plant(4.35, 12.65);
      K.plant(-4.35, 23.35);
      A.box(-4.95, -4.5, 0, 0.45, 18.6, 20.8, M.wood);
      A.box(-4.95, -4.85, 0.45, 0.95, 18.6, 20.8, M.wood, { collide: false });
      A.box(-1.0, 1.0, 0.002, 0.008, 22.7, 23.7, M.rubber, { collide: false });
      const ub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 10), M.darkPlastic);
      ub.position.set(4.3, 0.28, 23.3);
      A.group.add(ub);
      A.sign(TEX.photo('陳志明'), 0.42, 0.63, -3.6, 1.75, 11.085, Math.PI);
      A.box(-4.6, -3.8, 1.3, 1.9, 2.7, 2.8, M.woodDark, { collide: false });
      A.sign(TEX.label(['鑰匙'], { w: 64, h: 32, bg: '#3e2c1e', fg: '#e8e2d1', size: 18 }), 0.3, 0.15, -4.2, 2.0, 2.81, 0);
      A.box(-5.25, -5.0, 0.8, 0.95, 4.65, 5.0, M.darkPlastic, { collide: false });
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8), M.white);
      mug.position.set(-4.9, 0.85, 5.55);
      A.group.add(mug);
      K.clock(-1.62, 2.4, 6.2, -Math.PI / 2, 3, 0);
      K.fire(1.39, 6.5, -Math.PI / 2);
    }

    if (id === '2F') {
      K.plaque('2F', '安心牙醫診所', '#dfeef0', '#2c5a63');
      const t = A.plane(0.7, 0.3, new THREE.MeshBasicMaterial({ map: TEX.ticket() }), -2.6, 2.3, 2.12, 0);
      A.props.ticket = t;
      K.board(TEX.label(['每天刷牙三次', '定期檢查', '牙齒健康'], { w: 128, h: 160, bg: '#e8f0ef', fg: '#2c5a63', size: 18 }), 0.7, 0.9, -7.89, 1.6, 4.0, Math.PI / 2);
      K.plant(-7.5, 2.6, 1.2);
      A.box(-7.95, -7.6, 0, 1.0, 8.6, 9.6, M.woodDark);
      K.fire(1.39, 15, -Math.PI / 2);
      stainRun(6, 2);
    }

    if (id === '3F') {
      K.plaque('3F', '明日之星補習班', '#f2e7c4', '#8a2b1d');
      K.clock(9.38, 2.7, 9, -Math.PI / 2, 3, 0);
      K.board(TEX.drawings(), 1.9, 0.95, 5.5, 1.6, 14.88, Math.PI);
      K.fire(-1.39, 20, Math.PI / 2);
      for (let i = 0; i < 5; i++) {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.3), new THREE.MeshLambertMaterial({ color: [0x7a2a2a, 0x2a4a7a, 0x3a6a3a][i % 3] }));
        bag.position.set(3.6 + (i % 3) * 1.5, 0.78, 5.4 + Math.floor(i / 2) * 2.2);
        A.group.add(bag);
      }
      stainRun(5, 3);
    }

    if (id === '5F') {
      K.plaque('5F', '招租中', '#2a3038', '#9aa6b6');
      K.boxes(-7.6, 4.3, 3, 2);
      K.boxes(-6.9, 4.4, 2, 5);
      K.boxes(6.8, 5.0, 3, 9);
      K.boxes(7.9, 21.0, 2, 4);
      for (const [x, z] of [[-1, 18], [1.3, 16.8], [0.2, 9.5]]) {
        const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.0, 0.62), M.cloth);
        sheet.position.set(x, 0.5, z);
        A.group.add(sheet);
        A.collide(x - 0.32, x + 0.32, z - 0.32, z + 0.32);
      }
      K.papers(-6, 6, 5, 20, 22, 7);
      K.puddle(7.4, 19.6, 0.5);
      const ph = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.16), M.darkPlastic);
      ph.position.set(0.5, 0.035, 12);
      ph.rotation.y = 0.6;
      A.group.add(ph);
      K.decal(TEX.banner('招租', '0912-XXX-XXX'), 1.4, 0.7, 8.87, 1.65, 9.5, -Math.PI / 2);
      K.decal(TEX.banner('招租', '0912-XXX-XXX'), 1.4, 0.7, -8.87, 1.65, 16.5, Math.PI / 2);
      K.fire(-1.39, 1.2, Math.PI / 2);
    }

    if (id === '6F') {
      K.plaque('6F', '機房', '#d8c63a', '#1a1a1a');
      const leaf = A.doors.roof.leaf;
      [-0.25, 0, 0.25].forEach((dx, i) => {
        const t = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.4), new THREE.MeshLambertMaterial({ map: TEX.talisman(i + 1), side: THREE.DoubleSide }));
        t.position.set(dx, 0.35 + (i % 2) * 0.06, -0.045);
        t.rotation.set(0, Math.PI, (i - 1) * 0.08);
        leaf.add(t);
      });
      const floorHaz = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.2), new THREE.MeshLambertMaterial({ map: TEX.hazard() }));
      floorHaz.rotation.x = -Math.PI / 2;
      floorHaz.position.set(1.15, 0.006, 6.6);
      A.group.add(floorHaz);
      A.box(-1.5, -1.3, 1.0, 2.0, 3.6, 4.6, M.doorGrey, { collide: false });
      A.sign(TEX.label(['高壓危險', '非相關人員', '請勿開啟'], { w: 96, h: 96, bg: '#d9b42c', fg: '#151515', size: 16 }), 0.4, 0.4, -1.29, 1.5, 4.1, Math.PI / 2);
      K.puddle(0.4, 12, 0.7);
      K.puddle(-0.6, 18.5, 0.5);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 24, 8), M.iron);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(1.15, 2.78, 12);
      A.group.add(pipe);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.led);
      lamp.position.set(0, 2.65, 23.85);
      A.group.add(lamp);
      const red = A.lightSpots.find((s) => Math.abs(s.z - 20) < 0.1);
      if (red) Object.assign(red, { color: 0xff3a24, intensity: 0.75, flicker: 0.05, y: 2.4, z: 23.2, distance: 8 });
      K.fire(1.39, 15, -Math.PI / 2);
      // 第五條的走廊：一排會一盞一盞熄滅的燈
      A.props.endlessTubes = [];
      for (let i = 0; i < 9; i++) {
        const m = new THREE.MeshBasicMaterial({ color: 0xeef3e6 });
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.2), m);
        t.position.set(0, 2.96, 27 + i * 4.5);
        A.props.endless.add(t);
        A.props.endlessTubes.push(m);
      }
      stainRun(6, 6);
    }

    if (id === '4F') {
      K.plaque('4', '', '#151515', '#6a6a60');
      A.props.wreaths = new THREE.Group();
      A.group.add(A.props.wreaths);
      const w1 = K.wreath(-0.9, 15.5, 0.25, ['音容宛在', '駕鶴西歸']);
      const w2 = K.wreath(0.9, 15.5, -0.25, ['福安大廈', '全體敬輓']);
      A.props.wreaths.add(w1, w2);
      const burner = new THREE.Group();
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.14, 10), M.iron);
      bowl.position.y = 0.07;
      burner.add(bowl);
      for (let i = 0; i < 3; i++) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.35, 4), M.red);
        st.position.set((i - 1) * 0.04, 0.3, 0);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 3), M.led);
        tip.position.set((i - 1) * 0.04, 0.48, 0);
        burner.add(st, tip);
      }
      burner.position.set(-0.9, 0, 0.6);
      A.group.add(burner);
      A.props.burner = burner;
    }

    if (id === '7F') {
      K.plaque('7F', '', '#2a1210', '#c0544a');
      K.papers(-1.2, 1.2, 28.5, 31.6, 26, 11);
      for (let i = 0; i < 5; i++) {
        const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 5), M.red);
        pen.rotation.set(Math.PI / 2, 0, i * 1.3);
        pen.position.set(-0.8 + i * 0.35, 0.01, 29.4 + (i % 2) * 0.6);
        A.group.add(pen);
      }
      A.props.redPen = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6), M.red);
      A.props.redPen.rotation.set(Math.PI / 2, 0, 0.4);
      A.props.redPen.visible = false;
      A.group.add(A.props.redPen);
    }
  }

  /* ================================================================ 監視器 */

  const FEEDS = [
    { area: 'B1', pos: [-8, 2.5, 1], look: [6, 0.5, 14] },
    { area: '1F', pos: [4.5, 2.9, 12.6], look: [-2, 0.5, 23] },
    { area: '1F', pos: [1.2, 2.7, 11.6], look: [0, 0.6, -2] },
    { area: '2F', pos: [1.2, 2.7, 23.5], look: [0, 0.5, 0] },
    { area: '2F', pos: [-7.6, 2.7, 2.4], look: [-3, 0.4, 11] },
    { area: '3F', pos: [-1.2, 2.7, 23.5], look: [0, 0.5, 0] },
    { area: '3F', pos: [9.2, 2.7, 14.6], look: [3, 0.4, 4] },
    { area: '5F', pos: [8.6, 2.7, 21.6], look: [-4, 0.4, 6] },
    { area: '6F', pos: [1.2, 2.7, 1], look: [0, 0.8, 24] },
    { area: '6F', pos: [8.6, 2.7, 16.6], look: [3, 0.4, 6] },
    { area: '3F', pos: [3.8, 2.8, 0.0], look: [2.2, 0.2, -3.5] },
    { area: '1F', pos: [-1.8, 2.45, -0.55], look: [-3.6, 0.4, -2.4] },
  ];
  const FEED13 = { area: '7F', pos: [0.9, 2.6, 1.2], look: [0, 0.7, 31] };

  /* ================================================================ 建造 */

  const BUILDERS = { B1: buildB1, '1F': build1F, '2F': build2F, '3F': build3F, '5F': build5F, '6F': build6F, '4F': build4F, '7F': build7F };

  function build(labels) {
    const TEX = window.NP3D_TEX;
    const scene = new THREE.Scene();
    const M = makeMaterials(TEX);
    const areas = {};
    AREA_IDS.forEach((id, i) => {
      const A = newArea(id, i, M, labels);
      BUILDERS[id](A);
      dress(A);
      areas[id] = A;
      scene.add(A.group);
    });
    const figures = [];
    for (const id of AREA_IDS) {
      areas[id].group.traverse((o) => {
        if (o.userData && o.userData.update && o.userData.rig) {
          o.userData.area = id;
          figures.push(o);
        }
      });
    }
    for (const f of [...FEEDS, FEED13]) {
      const A = areas[f.area];
      kit(A).camera(A.w(...f.pos), A.w(...f.look));
    }
    const toWorld = (f) => ({
      area: f.area,
      pos: areas[f.area].w(...f.pos),
      look: areas[f.area].w(...f.look),
    });
    return {
      scene, areas, M,
      feeds: FEEDS.map(toWorld),
      feed13: toWorld(FEED13),
      figures,
      makeFigure: (kind, o = {}) => {
        const f = makeFigure(M, kind, o);
        figures.push(f);
        return f;
      },
      SPACING,
    };
  }

  return { build, AREA_IDS };
})();
