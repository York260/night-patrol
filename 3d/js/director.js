/*
 * 夜巡守則・七樓（3D）— 導演（每一夜的事件腳本）
 *
 * 文字版的每個「選項」，在這裡都變成身體的動作：
 *   不要回頭  → 監看視角方向
 *   不要動、不要按按鈕 → 監看移動與互動
 *   不要開門、不要接電話、不要回答 → 互動提示就在眼前，但守則叫你別按
 *   照著自己的影子 → 手電筒必須一直往下照
 *
 * 表現原則：能用畫面、聲音、鏡頭說的事，就不用字幕。
 *   內心獨白只留最短的幾個字；需要玩家注意的東西，用鏡頭帶過去（G.lookAt）。
 *   每一種死法都有自己的 3D 場面：die() → 電影模式（上下黑邊）→ 場面 → 結局卡。
 */
window.NP3D_DIRECTOR = (() => {
  'use strict';

  const T = { START: 30, LOCK: 300, UNLOCK: 360, DOOR7: 420, END: 480 };
  const PI = Math.PI;
  let R = {}; // 這一夜的執行期資料
  let fired = new Set();
  let spawned = []; // 腳本生出來的人物，換夜時清掉
  let extras = []; // 腳本加進場景的小道具，換夜時清掉
  let lobbyAmbient = null;
  let paper6 = null;

  const once = (key) => {
    if (fired.has(key)) return false;
    fired.add(key);
    return true;
  };
  const A = (G, id) => G.world.areas[id];
  const W = (G, id, x, y, z) => A(G, id).w(x, y, z);
  const fig = (G, ...args) => {
    const h = G.figure(...args);
    spawned.push(h);
    return h;
  };
  const addExtra = (G, areaId, mesh) => {
    A(G, areaId).group.add(mesh);
    extras.push(mesh);
    return mesh;
  };

  /* ================================================================ 佈置 */

  function setupNight(G) {
    R = { offAt: null, gaze: 0, cctv: 'idle', companion: null, compArea: null };
    fired = new Set();
    spawned.forEach((h) => h.remove());
    spawned = [];
    extras.forEach((m) => m.parent && m.parent.remove(m));
    extras = [];
    const Wd = G.world;
    const Ar = Wd.areas;
    const n = G.night;
    const TEX = G.TEX;

    // 2F
    Ar['2F'].props.shutter.visible = n === 2;
    Ar['2F'].props.tv.material = Ar['2F'].props.tv.material.clone();
    Ar['2F'].props.tv.material.color.setHex(n === 1 ? 0xffffff : 0x000000);
    // B1
    Ar.B1.props.cars.forEach((c, i) => {
      c.cover.visible = !(n === 3 || (n === 2 && i === 1));
      c.lights.forEach((l) => (l.material = n === 2 && i === 1 ? Wd.M.lamp : Wd.M.plain));
    });
    Ar.B1.props.batteryBox.visible = n === 1;
    // 3F
    setBoard(G, n === 2 ? 'building' : n === 3 ? 'exam' : 'formula');
    // 5F
    Ar['5F'].props.redWalls.forEach((m) => (m.visible = n === 3));
    Ar['5F'].props.roster.visible = n !== 3;
    // 6F
    const P6 = Ar['6F'].props;
    P6.chains.visible = n !== 3;
    P6.redThread.visible = n === 1;
    P6.rooftop.visible = n === 3;
    P6.uniforms.visible = n === 3;
    P6.endless.visible = false;
    P6.endlessTubes.forEach((m) => m.color.setHex(0xeef3e6));
    G.door('6F', 'roof', n === 3 ? 0.35 : false);
    // 4F：第一夜是靈堂，第二夜有人招手，第三夜站滿了背對你的人
    const P4 = Ar['4F'].props;
    P4.crowd.visible = n === 1;
    P4.smoke.visible = n === 1;
    P4.wreaths.visible = n !== 2;
    P4.burner.visible = n === 1;
    P4.guard.visible = n === 2;
    P4.guard.position.z = 16.8;
    P4.guard.userData.setAnim('beckon', { track: false });
    P4.backs.visible = n === 3;
    P4.backs.children.forEach((f) => {
      f.userData.home = f.userData.home || { z: f.position.z, r: f.rotation.y };
      f.position.z = f.userData.home.z;
      f.rotation.y = f.userData.home.r;
      f.userData.setAnim('idle', { track: false });
      f.userData.head.rotation.set(0, 0, 0);
    });
    G.areaMode('4F', n === 1 ? null : 'lit');
    // 7F
    const P7 = Ar['7F'].props;
    P7.stairText.visible = n >= 2;
    P7.redPen.visible = false;
    G.door('7F', 'stair7', false);
    const chen = P7.chen;
    chen.visible = n !== 2;
    chen.userData.setAnim('write', { track: false });
    chen.userData.head.rotation.set(0, n === 3 ? PI : 0, 0);
    if (n === 2) {
      // 第二夜：老陳站在走廊中間，舉著一張紙
      const f = fig(G, 'chen', '7F', 0, 22, PI, { anim: 'hold', tag: '陳' });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: TEX.chenSign() }));
      sign.position.set(0, 1.3, 0.42);
      f.obj.add(sign);
    }
    // 電梯面板
    for (const id of G.D.FLOORS) {
      const p = Ar[id].elevator && Ar[id].elevator.panelMesh;
      if (p) p.material.map = TEX.elevatorPanel(n === 3);
    }
    // 日誌
    setLogbook(G, 'start');
    // 大廳與天空
    const L = Ar['1F'];
    lobbyAmbient = lobbyAmbient || L.ambient;
    L.ambient = lobbyAmbient;
    L.props.sky.material = Wd.M.skyNight;
    L.props.breakfast.position.y = 0;

    registerNight(G);
  }

  function setBoard(G, kind) {
    const b = A(G, '3F').props.board;
    b.material.map = G.TEX.whiteboard(kind);
    b.material.needsUpdate = true;
  }

  function logRows(G, phase) {
    const S = G.S;
    const n = G.night;
    const name = S.name;
    const rows = [{ date: '10/09', in: '陳', out: '陳' }, { date: '10/10', in: '陳', out: '' }];
    const dates = ['10/14', '10/15', '10/16'];
    for (let i = 1; i <= 3; i++) {
      if (i < n) rows.push({ date: dates[i - 1], in: name, out: name, ghost: i === 2 ? name : '' });
      if (i === n) {
        const signed = phase !== 'start';
        const preOut = n === 3 && phase === 'end' ? name : '';
        rows.push({ date: dates[i - 1], in: signed ? name : '', out: phase === 'out' ? name : preOut, wet: !!preOut });
      }
    }
    return rows;
  }

  function setLogbook(G, phase) {
    A(G, '1F').props.logbook.material = new THREE.MeshLambertMaterial({ map: G.TEX.logbook(logRows(G, phase)) });
  }

  /** 開場簽到：值班日誌直接攤開在眼前，簽完才開始計時 */
  async function signIn(G) {
    const S = G.S;
    const n = G.night;
    const rows = logRows(G, 'start');
    const today = rows.pop();
    const name = await G.signSheet({ rows, date: today.date, editable: n === 1 });
    if (n === 1) S.name = name;
    G.sfx('page');
    S.signedIn = true;
    S.time = T.START;
    setLogbook(G, 'in');
    setRoster(G);
  }

  function setRoster(G) {
    const m = A(G, '5F').props.roster;
    m.material.map = G.TEX.roster(G.S.name, G.night);
    m.material.needsUpdate = true;
  }

  /* ================================================================ 演出工具 */

  /** 死亡：進入電影模式 → 演出場面 → 淡出 → 結局卡 */
  async function die(G, id, scene, cause) {
    G.cine(true);
    G.lock();
    if (scene) await scene();
    await G.fade(1, 0.9);
    G.ending(id, cause);
  }

  /** 讓目前樓層的燈閃幾下 */
  async function flicker(G, times = 3, dark = 0.12) {
    for (let i = 0; i < times; i++) {
      G.blackout(true);
      await G.wait(dark + Math.random() * 0.1);
      G.blackout(false);
      await G.wait(0.08 + Math.random() * 0.15);
    }
  }

  /** 撲臉：把人物瞬間放到鏡頭正前方 */
  async function lunge(G, f, dist = 0.7) {
    const Ar = A(G, f.obj.userData.area);
    const fw = G.forward().setY(0).normalize();
    const p = G.pos;
    f.setPos(p.x + fw.x * dist - Ar.ox, p.z + fw.z * dist);
    f.face(p.x, p.z);
    G.fov(46, 0.12);
    G.flash(1);
    G.hurt(1);
    G.sfx('scare');
    G.shake(0.06, 0.8);
    await G.lookAt(f.headPos, 0.12);
    await G.wait(0.6);
  }

  /** 樓梯上的高度（landing 模板：x 4.1 → 6.8，升高 1.65） */
  const stairY = (x) => Math.max(0, Math.min(1.65, ((x - 4.1) / 2.7) * 1.65));

  /** 7F 樓梯平台上方那一段樓梯，站滿往下看的人 */
  function stairCrowd(G, count, kinds) {
    const P = G.pos;
    const A7 = A(G, '7F');
    const out = [];
    for (let i = 0; i < count; i++) {
      const x = 4.5 + i * (2.2 / Math.max(1, count - 1));
      const z = -3.0 + (i % 2 ? 0.32 : -0.32);
      const f = fig(G, kinds[i % kinds.length], '7F', x, z, -PI / 2, { y: stairY(x), variant: i, track: true });
      f.face(P.x, P.z);
      f.obj.visible = false;
      out.push(f);
    }
    out.A7 = A7;
    return out;
  }

  /* ================================================================ 互動 */

  function registerNight(G) {
    const n = G.night;
    const nf = G.nf;

    // 7F 樓梯平台的上下樓
    const A7 = A(G, '7F');
    G.addInteract({ id: 'up7', area: '7F', pos: A7.anchors.stairsUp, reach: 1.9, angle: 0.65, label: () => (n === 2 ? '照第十條，繼續往上' : '繼續往上'), when: () => !!nf.on7 && !G.busy, use: () => up7(G) });
    G.addInteract({ id: 'down7', area: '7F', pos: A7.anchors.stairsDown, reach: 1.9, angle: 0.65, label: '轉身往下走', when: () => !!nf.on7 && !G.busy, use: () => down7(G) });
    G.addInteract({ id: 'answer7', area: '7F', pos: A7.w(5.5, 2.4, -3.0), reach: 4, angle: 0.5, label: '回答：「我在這裡。」', when: () => n === 3 && nf.on7 === 'anomaly', use: () => answerName(G) });

    // 第一夜
    if (n === 1) {
      G.addInteract({ id: 'freeBattery', area: 'B1', pos: A(G, 'B1').anchors.freeBattery, reach: 1.6, label: '一盒全新的電池', when: () => !nf.battery, use: () => freeBattery(G) });
      G.addInteract({ id: 'tv', area: '2F', pos: A(G, '2F').anchors.tv, reach: 3.2, angle: 0.4, label: '電視', when: () => !nf.tv, use: () => tv(G) });
      G.addInteract({ id: 'roster', area: '5F', pos: A(G, '5F').anchors.roster, reach: 1.8, label: '值班表', when: () => !nf.roster, use: () => roster(G) });
      // 打卡鐘縫隙裡露出來的紙條（打卡之後才看得到）
      const P6 = A(G, '6F');
      if (!paper6) {
        paper6 = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.1), new THREE.MeshBasicMaterial({ color: 0xe9e2cc, side: THREE.DoubleSide }));
        const pa = P6.anchors.punch;
        paper6.position.set(pa.x - P6.ox, pa.y + 0.12, pa.z);
        paper6.rotation.set(0, 0, 0.35);
        P6.group.add(paper6);
      }
      paper6.visible = false;
      G.addInteract({ id: 'note6', area: '6F', pos: P6.anchors.punch, reach: 1.6, label: '打卡鐘縫隙裡的紙條', when: () => G.S.cps.includes('6F') && !G.S.clues.includes('c1'), use: async () => {
        paper6.visible = false;
        await G.note('c1');
        G.san(-2, { silent: true });
      } });
      G.addInteract({ id: 'roof', area: '6F', pos: A(G, '6F').anchors.roofDoor, reach: 1.8, label: '頂樓鐵門', when: () => !nf.roofLook, use: async () => {
        nf.roofLook = true;
        // 三道鎖、紅線；門的另一邊，有人輕輕敲了兩下
        await G.lookAt(W(G, '6F', 0, 1.15, 23.8), 0.7);
        await G.wait(0.9);
        G.sfx('knock', A(G, '6F').anchors.roofDoor);
        G.shake(0.006, 0.4);
      } });
      const C = A(G, '3F');
      R.child = fig(G, 'child', '3F', C.anchors.child.x - C.ox, C.anchors.child.z, PI / 2, { seated: true, anim: 'swing' });
    }

    // 第二夜
    if (n === 2) {
      G.addInteract({ id: 'board', area: '3F', pos: A(G, '3F').anchors.board, reach: 3.2, angle: 0.5, label: '白板', when: () => !nf.board, use: () => board2(G) });
      G.addInteract({ id: 'roster', area: '5F', pos: A(G, '5F').anchors.roster, reach: 1.8, label: '值班表', when: () => !nf.roster, use: () => roster(G) });
      const car = A(G, 'B1').props.cars[1];
      G.addInteract({ id: 'notebook', area: 'B1', pos: car.seat.clone().setY(1.0).setX(car.seat.x - 1.6), reach: 2.2, angle: 0.6, label: '車上的筆記本', when: () => !nf.car, use: () => carNote(G) });
      G.addInteract({ id: 'roof', area: '6F', pos: A(G, '6F').anchors.roofDoor, reach: 1.8, label: '頂樓鐵門', when: () => !nf.roofTalk, use: () => roof2(G) });
      R.woman = fig(G, 'woman', '2F', -0.85, 7.6, PI / 2, { crouch: true, anim: 'rock' });
    }

    // 第三夜
    if (n === 3) {
      G.addInteract({ id: 'board', area: '3F', pos: A(G, '3F').anchors.board, reach: 3.2, angle: 0.5, label: '黑板上的題目', when: () => !nf.board, use: () => board3(G) });
      G.addInteract({ id: 'redwall', area: '5F', pos: A(G, '5F').anchors.roster, reach: 2.0, label: '隔板上的紅字', when: () => !G.S.clues.includes('c4'), use: async () => {
        await G.note('c4');
        G.san(-4);
      } });
      G.addInteract({ id: 'roof', area: '6F', pos: A(G, '6F').anchors.roofDoor, reach: 1.8, label: '虛掩的頂樓鐵門', when: () => !nf.roofLock && G.time < T.LOCK, use: () => roof3(G) });
      const B = A(G, 'B1');
      R.bosses = B.props.cars.map((c) => fig(G, 'boss', 'B1', c.seat.x - B.ox, c.seat.z, -PI / 2, { seated: true, y: 0.15 }));
      const C = A(G, '3F');
      R.students = C.props.desks.map((d, i) => fig(G, i % 3 === 0 ? 'child' : 'adult', '3F', d.x - C.ox, d.z, PI / 2, { seated: true, variant: i, anim: 'write' }));
      R.double = fig(G, 'self', '2F', -4.4, 7.5, -PI / 2, { seated: true, tag: G.S.name || '　' });
    }

    // 電話（第二夜）
    G.addInteract({ id: 'phone', area: '1F', pos: A(G, '1F').anchors.phone, reach: 1.6, label: '接電話', when: () => !!R.ring, use: () => answerPhone(G) });
    // 保全室的門（03:00 之後）
    G.addInteract({ id: 'guardDoor', area: '1F', pos: W(G, '1F', -1.5, 1.1, 10.0), reach: 1.8, angle: 0.6, label: '門外的聲音', when: () => !!nf.lockedIn && G.time < T.UNLOCK, use: () => doorChoice(G) });
  }

  /* ================================================================ 每夜開頭、日誌、大門 */

  async function startNight(G) {
    const touch = document.body.classList.contains('touch-mode');
    if (!G.S.signedIn) await signIn(G);
    if (G.night === 1) {
      // 開場只教最基本的；手電筒、跑步、換電池等到需要的時候才提示（main.js 的操作提示）
      G.toast(touch ? '左下拖曳移動，右半邊拖曳看，按「互動」使用物品' : 'WASD 移動・滑鼠看・E 互動');
      await G.wait(2.5);
      G.toast(touch ? '按「守則」翻開守則。打卡點列在右上角' : '按 H 翻開守則。打卡點列在右上角');
    } else {
      G.toast(G.night === 2 ? '守則的最後一頁，多了紅筆字。' : '守則第二頁，跟手機裡的照片不一樣。');
    }
  }

  function logbookLabel(G) {
    const S = G.S;
    if (!S.signedIn) return '簽到';
    if (G.time >= T.END) return G.nf.signedOut ? '日誌' : '簽退';
    return '值班日誌';
  }

  async function onLogbook(G) {
    const S = G.S;
    const n = G.night;
    if (!S.signedIn) return signIn(G);
    if (G.time < T.END) {
      G.toast('06:00 才能簽退。');
      return;
    }
    if (G.nf.signedOut) return;
    if (n < 3) {
      G.nf.signedOut = true;
      setLogbook(G, 'out');
      G.sfx('page');
      G.endNight();
      return;
    }
    // 第三夜：下班欄已經有你的簽名
    G.cine(true);
    await G.lookAt(A(G, '1F').anchors.logbook, 0.5);
    await G.fov(34, 0.9);
    G.sfx('sting');
    await G.wait(0.8);
    await G.fov(null, 0.4);
    G.cine(false);
    const i = await G.choice('下班欄已經有你的簽名。你的字跡，墨水還沒乾。', ['簽名。', '不簽。']);
    if (i === 0) {
      G.sfx('page');
      return die(G, 'E_SIGN', () => signScene(G));
    }
    G.nf.signedOut = true;
    G.objective('推開大門離開，不要回頭');
  }

  /** 重複的簽名：門推不開；早餐店老闆走過，沒有看你一眼 */
  async function signScene(G) {
    await G.fade(1, 0.6);
    dawnLight(G, 1);
    G.teleport('1F', 0.55, 21.6, PI);
    G.setPitch(0);
    await G.fade(0, 0.9);
    await G.rail([[0.55, 0, 21.6], [0.55, 0, 23.55]], 1.4, '1F');
    for (let i = 0; i < 3; i++) {
      G.sfx('slam', W(G, '1F', 0, 1.2, 24));
      G.shake(0.02, 0.25);
      await G.wait(0.45);
    }
    const owner = fig(G, 'adult', '1F', -9, 27.4, PI / 2, { variant: 4 });
    await owner.walkTo(A(G, '1F').ox + 9, 27.4, 1.5);
    G.sfx('door', W(G, '1F', -1.5, 1.2, 10.6));
    await G.lookAt(W(G, '1F', 0, 1.5, 12), 1.6);
    const newbie = fig(G, 'guard', '1F', -0.6, 13.5, PI, { variant: 2 });
    newbie.face(G.pos.x, G.pos.z);
    await G.wait(0.4);
    await G.say('「照著做就好。」', { who: 'self' });
  }

  async function onExit(G) {
    if (G.time < T.END) {
      G.toast('大門鎖著。06:00 才會打開。');
      return;
    }
    if (G.night < 3 && !G.nf.signedOut) {
      G.toast('先回保全室，在日誌上簽退。');
      return;
    }
    if (G.night < 3) return;
    const rescued = !!G.nf.rescued;
    return die(G, rescued ? 'E_TRUE' : 'E_DAWN', async () => {
      const L = A(G, '1F');
      G.sfx('door');
      dawnLight(G, 1);
      if (rescued && R.companion) {
        R.compFree = true;
        R.companion.walkTo(L.ox + 0.9, 29.5, 1.15);
      }
      await G.rail([[G.pos.x - L.ox, 0, G.pos.z], [0, 0, 23.4], [0, 0, 28.6]], 3.6, '1F');
      if (rescued) {
        const owner = fig(G, 'adult', '1F', -4.8, 31.5, 0, { variant: 4, track: true });
        owner.face(G.pos.x, G.pos.z);
        await G.lookAt(owner.headPos, 0.9);
        await G.say('「老陳，好久不見。照舊？」', { who: 'man', pos: owner.headPos });
        await G.lookAt(R.companion ? R.companion.headPos : W(G, '1F', 0.9, 1.6, 29.5), 0.8);
        await G.wait(0.6);
        await G.lookAt(W(G, '1F', 0, 9, 46), 2.2);
      } else {
        // 不要回頭——但結局已經寫完了：你終究回頭看了一眼
        await G.wait(0.6);
        await G.lookAt(W(G, '1F', 0, 1.6, 18), 1.8);
        const ghost = fig(G, 'chen', '1F', 0.4, 19.5, 0, { tag: '陳', track: true });
        ghost.face(G.pos.x, G.pos.z);
        await G.wait(1.4);
        await flicker(G, 2, 0.2);
        ghost.remove();
        await G.wait(0.8);
      }
    });
  }

  function dawnLight(G, k) {
    const L = A(G, '1F');
    L.props.sky.material = G.world.M.skyDawn;
    L.props.breakfast.position.y = 2.4;
    L.ambient = { fog: 0x6d7276, density: 0.05 - k * 0.02, sky: 0xb8c0cc, ground: 0x2e2a27, hemi: 0.45 + k * 0.15 };
    G.areaMode('1F', 'dawn');
    G.dawn(0.5 + k * 0.5);
  }

  function onPunch(G, id) {
    if (G.S.cps.length === 5 && G.time < T.LOCK) G.toast('五個打卡點都完成了。回保全室坐著，時間會過得比較快。');
    if (G.night === 1 && id === '6F' && paper6) {
      paper6.visible = true;
      G.run(async () => {
        await G.wait(0.3);
        await G.lookAt(paper6.getWorldPosition(new THREE.Vector3()), 0.6);
      });
    }
  }

  /* ================================================================ 每一幀 */

  function update(G, dt) {
    const S = G.S;
    const n = G.night;
    const t = G.time;
    if (!S.signedIn) {
      G.objective('在保全室的日誌上簽到');
      return;
    }
    // 目標
    let obj;
    if (t >= T.END) obj = n < 3 ? (G.nf.signedOut ? '' : '回到 1F 保全室，在日誌上簽退') : '06:00。下班。';
    else if (t >= T.UNLOCK) obj = S.cps.length < 5 ? `完成五個打卡點（${S.cps.length} / 5）` : '撐到 06:00';
    else if (t >= T.LOCK) obj = '撐到 04:00';
    else if (t >= 270) obj = '03:00：守則第五條';
    else obj = `完成五個打卡點（${S.cps.length} / 5）`;
    G.objective(obj);

    // 時間事件
    if (n === 1 && t >= 282 && once('warn3') && !(G.area === '1F' && G.inZone('guardRoom'))) {
      G.sfx('chime');
      G.toast('快三點了。守則第五條。');
    }
    // 時間直接跳過 04:00（除錯或讀檔）時，不補演 03:00
    if (t >= T.LOCK && once('lock') && t < T.UNLOCK - 2) G.run(() => lockdown(G));
    if (t >= T.UNLOCK && once('unlock')) G.run(() => unlock(G));
    if (n === 2 && t >= 130 && t < 180 && !G.nf.phoneDone && once('ring')) startRing(G);
    if (n === 2 && t >= 180 && R.ring && once('ringEnd')) stopRing(G, true);
    if (n === 3 && t >= T.DOOR7 && once('door7')) G.sfx('door', W(G, G.area, 4.5, 2.5, -3.0));
    if (t >= T.END && once('dawn')) dawn(G);

    // 監視器
    if (R.cctv === 'idle' && t >= 55 && (t < T.LOCK || t >= T.UNLOCK) && G.area === '1F' && G.inZone('guardRoom')) {
      R.cctv = 'active';
      G.run(() => cctv(G));
    }

    // 人物觸發
    if (n === 1 && R.child && G.area === '3F' && G.inZone('classroom') && G.dist(R.child.world) < 3.4 && once('child')) G.run(() => child(G));
    if (n === 2 && R.woman && G.area === '2F' && G.dist(R.woman.world) < 3.6 && once('woman')) G.run(() => woman(G));
    if (n === 2 && G.area === '6F' && G.dist(A(G, '6F').anchors.roofDoor) < 5 && once('scratch')) G.run(() => scratch(G));
    if (n === 3 && R.double && G.area === '2F' && G.inZone('waiting') && G.dist(R.double.world) < 3.6 && once('double')) G.run(() => double(G));
    if (n === 3 && R.bosses && G.area === 'B1' && R.bosses.some((b) => G.dist(b.world) < 7) && once('bosses')) G.run(() => bosses(G));
    if (n === 2 && G.area === 'B1' && once('engine')) R.engine = G.loop('engine', A(G, 'B1').props.cars[1].seat);
    if (G.area === '6F' && G.dist(A(G, '6F').props.machine) < 9 && !R.machine) R.machine = G.loop('machine', A(G, '6F').props.machine);
    if (G.area === 'B1' && Math.random() < dt * 0.25) G.sfx('drip', W(G, 'B1', Math.random() * 16 - 8, 2.6, Math.random() * 24));

    // 4F 的香煙
    const F4 = A(G, '4F');
    if (F4.props.smoke.visible) {
      const p = F4.props.smoke.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * 0.25;
        if (y > 3) y = 0;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }

    // 老陳跟著你
    if (G.nf.rescued && !R.compFree) companion(G);
  }

  function onEnterArea(G, id) {
    if (R.machine && id !== '6F') {
      R.machine.stop();
      R.machine = null;
    }
  }

  /* ================================================================ 03:00 */

  async function lockdown(G) {
    G.blackout(true);
    G.sfx('static');
    G.standUp();
    if (G.area === '1F' && G.inZone('guardRoom')) return lockIn(G, true);
    if (G.night === 3 && G.area === '6F') return roofAt3(G);
    if (G.night === 1) G.toast('燈全熄了。守則第五條——');
    return hunted(G);
  }

  async function lockIn(G, onTime) {
    const nf = G.nf;
    if (nf.lockedIn) return;
    nf.lockedIn = true;
    const door = W(G, '1F', -1.2, 1.4, 10);
    G.door('1F', 'guard', false);
    G.sfx('slam', door);
    await G.wait(0.4);
    G.sfx('lock', door);
    if (!onTime) await G.lookAt(door, 0.6);
    const lines = {
      1: ['{name}，開門。', '我忘了拿鑰匙，外面好冷。', '{name}？我知道你在裡面。'],
      2: ['開門，是我，老陳。', '我回來上班了。你讓我進去，我跟你交班。', '年輕人……開門啊。'],
      3: ['開門。', '是我。', '你開門啊。你在裡面幹嘛？那是我的位子。'],
    }[G.night];
    const who = { 1: 'boss', 2: 'chen', 3: 'self' }[G.night];
    await G.waitUntil(() => G.time >= 317, 120);
    // 第一聲敲門：鏡頭帶過去
    G.run(() => G.lookAt(door, 0.9));
    let i = 0;
    while (G.time < T.UNLOCK - 4 && !nf.doorOpen) {
      G.sfx('knock', door);
      G.shake(0.006, 0.5);
      await G.wait(1.2);
      if (G.time >= T.UNLOCK - 4 || nf.doorOpen) break;
      await G.say(lines[i % lines.length], { who, pos: door });
      i++;
      if (G.night === 3 && i === 2) await G.think('（是你自己的聲音。）');
      await G.wait(9 + Math.random() * 4);
    }
  }

  async function doorChoice(G) {
    const n = G.night;
    const opts = n === 1
      ? ['開門。', '隔著門問：「主任，你的車停在哪裡？」', '不理它，離開門邊。']
      : n === 2
        ? ['開門。', '隔著門問：「你的陳，怎麼寫？」', '不理它，離開門邊。']
        : ['開門。', '不理它，離開門邊。'];
    const i = await G.choice('門外的聲音還在。', opts);
    const door = W(G, '1F', -1.2, 1.4, 10);
    if (i === 0) {
      return die(G, 'E_DOOR', async () => {
        G.nf.doorOpen = true;
        G.door('1F', 'guard', true);
        G.sfx('door', door);
        // 門外的東西，和那個聲音一點都不像
        const f = fig(G, 'tall', '1F', -1.05, 10.6, -PI / 2, { anim: 'twitch', track: true });
        f.face(G.pos.x, G.pos.z);
        await G.lookAt(f.headPos, 0.8);
        await G.wait(1.0);
        await flicker(G, 2, 0.18);
        const p = G.pos;
        const L = A(G, '1F');
        const fw = G.forward().setY(0).normalize();
        f.setPos(p.x - L.ox + fw.x * 1.6, p.z + fw.z * 1.6);
        f.face(p.x, p.z);
        await flicker(G, 1, 0.3);
        await lunge(G, f);
      });
    }
    if (i === 1 && opts.length === 3) {
      G.nf.asked = true;
      if (n === 1) {
        await G.say('車……', { who: 'boss', pos: door });
        await G.say('車在七樓。', { who: 'boss', pos: door });
        G.san(-10);
      } else {
        await G.say('耳……', { who: 'chen', pos: door });
        await G.say('耳車，陣。', { who: 'chen', pos: door });
        G.san(-8);
      }
    }
  }

  /**
   * 不在保全室：它會在黑暗裡找你。
   * 開著手電筒或在跑，它就聽得見、看得見你，大步追上來（約每秒 2.6 公尺，比走路快、比跑步慢）；
   * 關燈慢慢走，它只能慢慢摸過來（約每秒 1.3 公尺）。躲進房間、關燈、不要跑，它只會停在門口。
   */
  async function hunted(G) {
    const caught = { 1: -30, 2: -40, 3: -50 }[G.night];
    let areaId = null;
    let f = null;
    let stepT = 2.5;
    let respawn = 0;
    let breath = null;
    const spawn = () => {
      areaId = G.area;
      const Ar = A(G, areaId);
      const sp = Ar.anchors.stalkerSpawn || Ar.w(0, 0, 20);
      f = fig(G, 'tall', areaId, sp.x - Ar.ox, sp.z, PI, { anim: 'twitch' });
      breath = G.loop('breath', f.world);
    };
    const despawn = () => {
      if (f) f.remove();
      if (breath) breath.stop();
      f = null;
      breath = null;
    };
    if (G.area !== '1F' || !G.inZone('guardRoom')) spawn();
    R.stalker = { despawn };
    await new Promise((resolve, reject) => {
      const off = G.onFrame((dt) => {
        try {
          if (G.time >= T.UNLOCK || G.S.blackout === false) {
            off();
            despawn();
            resolve();
            return;
          }
          if (G.area === '1F' && G.inZone('guardRoom')) {
            despawn();
            off();
            G.run(() => lockIn(G, false));
            resolve();
            return;
          }
          if (G.busy) return;
          if (!f || areaId !== G.area) {
            despawn();
            respawn += dt;
            if (respawn > 6) {
              respawn = 0;
              spawn();
            }
            return;
          }
          const fp = f.world;
          const d = G.dist(fp);
          if (d < 5) G.san(-1.1 * dt, { silent: true });
          stepT -= dt;
          if (stepT <= 0) {
            stepT = 0.7;
            const Ar = A(G, areaId);
            let tx = G.pos.x;
            let tz = G.pos.z;
            const exposed = G.flashOn || G.running;
            const room = Ar.rooms.find((r) => G.inZone(r.zone));
            const hiding = room && !exposed;
            if (hiding) {
              tx = room.door.x;
              tz = room.door.z;
            }
            const dx = tx - fp.x;
            const dz = tz - fp.z;
            const len = Math.hypot(dx, dz);
            const step = Math.min(len, exposed ? 1.8 : 0.9);
            if (len > 0.05) {
              f.setPos(fp.x - Ar.ox + (dx / len) * step, fp.z + (dz / len) * step);
              f.face(G.pos.x, G.pos.z);
            }
            G.sfx('heavyStep', f.world);
            if (breath) breath.setPos(f.world);
          }
          if (d < 1.35) {
            off();
            const caughtBy = f;
            G.run(async () => {
              G.cine(true);
              G.lock();
              await lunge(G, caughtBy);
              despawn();
              await G.fade(1, 0.4);
              G.fov(null, 0.05);
              G.san(caught);
              const g1 = A(G, '1F');
              G.teleport('1F', g1.anchors.spawn.x - g1.ox, g1.anchors.spawn.z, PI / 2);
              G.setPitch(-0.75);
              G.S.time = T.UNLOCK;
              G.cine(false);
              G.unlock();
              await G.fade(0, 1.6);
              await G.think('（04:00。你在保全室的地上醒來。）');
            });
            resolve();
          }
        } catch (e) {
          off();
          reject(e);
        }
      });
    });
  }

  async function roofAt3(G) {
    const D6 = A(G, '6F');
    G.door('6F', 'roof', 1.6);
    D6.props.rooftop.visible = false;
    D6.props.endless.visible = true;
    G.sfx('door', D6.anchors.roofDoor);
    const wind = G.loop('breath', D6.anchors.roofDoor);
    G.run(() => G.lookAt(W(G, '6F', 0, 1.6, 30), 1.2));
    const res = await new Promise((resolve) => {
      const off = G.onFrame(() => {
        if (G.area !== '6F') {
          off();
          resolve('left');
        } else if (G.pos.z > 24.3) {
          off();
          resolve('through');
        } else if (G.time >= T.UNLOCK - 1) {
          off();
          resolve('waited');
        }
      });
    });
    wind.stop();
    if (res === 'left') {
      G.door('6F', 'roof', false);
      G.sfx('slam');
      G.san(-40);
      return;
    }
    // 第五條：門後面不是頂樓，是一條很長很長的走廊。燈一盞一盞朝你熄過來。
    return die(G, 'E_ROOF', async () => {
      if (res === 'waited') await G.rail([[G.pos.x - D6.ox, 0, G.pos.z], [0, 0, 25.6]], 1.6, '6F');
      await G.lookAt(W(G, '6F', 0, 1.6, 60), 0.6);
      await G.wait(0.6);
      G.door('6F', 'roof', false);
      G.sfx('slam', W(G, '6F', 0, 1.2, 23.8));
      G.shake(0.03, 0.4);
      await G.wait(1.2);
      const tubes = D6.props.endlessTubes;
      for (let i = tubes.length - 1; i >= 0; i--) {
        tubes[i].color.setHex(0x0b0b0b);
        G.sfx('click', W(G, '6F', 0, 2.8, 27 + i * 4.5));
        await G.wait(0.3);
      }
      G.blackout(true);
      G.loop('breath', G.pos.clone().add(G.V3(0, 1.6, 0.6)));
      await G.wait(1.6);
      G.flash(0.9);
      G.sfx('scare');
      G.shake(0.05, 0.6);
      await G.wait(0.3);
    });
  }

  async function unlock(G) {
    if (R.stalker) R.stalker.despawn();
    G.blackout(false);
    G.door('1F', 'guard', true);
    G.nf.lockedIn = false;
    if (G.area === '1F' && G.inZone('guardRoom') && G.night === 3) {
      // 門縫底下塞進來一張日誌的紙，下班欄簽著你的名字
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), new THREE.MeshLambertMaterial({ map: G.TEX.logbook([{ date: '10/16', in: G.S.name, out: G.S.name, wet: true }]) }));
      paper.rotation.set(-PI / 2, 0, 0.5);
      paper.position.set(-1.9, 0.012, 10.5);
      addExtra(G, '1F', paper);
      await G.lookAt(W(G, '1F', -1.9, 0, 10.5), 1.0);
    }
  }

  /* ================================================================ 監視器 */

  function onPower(G, on) {
    if (!on) R.offAt = G.time;
    else if (R.offAt != null) {
      const waited = G.time - R.offAt;
      R.offAt = null;
      R.powerResult = waited >= 10 ? 'ok' : 'early';
    }
  }

  async function cctv(G) {
    const n = G.night;
    const mon = G.mon;
    const F1 = A(G, '1F');
    const bank = F1.w(-5.2, 1.65, 5.1);
    const target = n === 3 ? bank : F1.props.monitor13.getWorldPosition(new THREE.Vector3());
    const inRoom = () => G.area === '1F' && G.inZone('guardRoom');
    mon.glitch = 1;
    G.sfx('static');
    await G.wait(0.25);
    mon.glitch = 0;
    if (n === 3) mon.all13 = true;
    else mon.show13 = true;
    // 鏡頭帶到第十三個畫面
    if (inRoom()) await G.lookAt(target, 1.0);
    R.gaze = 0;
    R.powerResult = null;
    R.stage13 = 0;
    // 離開保全室這件事，即使發生在演出途中也要記得
    R.left13 = false;
    R.offWatch13 = G.onFrame(() => {
      if (!inRoom()) R.left13 = true;
    });
    let ignored = 0;
    let ev = null;
    while (true) {
      ev = null;
      await G.waitUntil(() => {
        if (R.powerResult) return (ev = 'power');
        const here = inRoom();
        const lockTime = G.time >= T.LOCK && G.time < T.UNLOCK;
        if (!here) {
          R.gaze = Math.max(0, R.gaze - 1 / 120);
          return false;
        }
        // 不理它：離開再回來，或一直待在房間裡不處理，它就更近一步
        if (R.left13) {
          R.left13 = false;
          ignored = 0;
          if (mon.power && !lockTime) return (ev = 'ignored');
        }
        if (mon.power && !lockTime) ignored += 1 / 60;
        if (ignored > 45) {
          ignored = 0;
          return (ev = 'ignored');
        }
        if (mon.power && G.dist(target) < 3.2 && G.looking(target, n === 3 ? 16 : 9)) R.gaze += 1 / 60;
        else R.gaze = Math.max(0, R.gaze - 1 / 120);
        if (R.gaze > 2.6) return (ev = 'stare');
        return false;
      });
      if (ev === 'power') {
        if (R.powerResult === 'ok') return clear13(G);
        R.powerResult = null;
        G.san(-5);
        mon.glitch = 0.35;
        G.sfx('static');
        await G.wait(0.4);
        mon.glitch = 0;
        continue;
      }
      if (ev === 'ignored') {
        R.stage13 += 1;
        if (R.stage13 >= 3) return behindYou(G, target);
        await closer13(G, target);
        continue;
      }
      // 盯著看太久：畫面拉近
      mon.glitch = 0.15;
      G.sfx('sting');
      G.cine(true);
      await G.fov(30, 0.9);
      const chen = A(G, '7F').props.chen;
      if (n === 1) {
        // 走廊盡頭的人慢慢轉過頭來
        await G.tween(1.6, (k) => (chen.userData.head.rotation.y = k * PI * 0.9));
        await G.wait(0.5);
        G.san(-15);
        G.addFlag('saw_chen');
      } else {
        await G.wait(1.2);
      }
      G.sfx('static');
      mon.glitch = 1;
      await G.wait(0.5);
      await G.fov(null, 0.3);
      G.cine(false);
      if (n === 2) {
        G.san(-15);
        await G.note('c3');
      } else if (n === 3) {
        G.san(-12);
        await G.note('c4');
      }
      chen.userData.head.rotation.y = n === 3 ? PI : 0;
      return clear13(G);
    }
  }

  /** 第十三個畫面消失（關機十分鐘、看過了、或被它找到之後） */
  function clear13(G) {
    const mon = G.mon;
    mon.glitch = 0;
    mon.show13 = false;
    mon.all13 = false;
    mon.cam13 = null;
    if (R.watcher13) R.watcher13.remove();
    R.watcher13 = null;
    if (R.offWatch13) R.offWatch13();
    R.offWatch13 = null;
    R.cctv = 'done';
  }

  /** 不理第十三個畫面：畫面裡的東西，每次都離鏡頭更近一點 */
  async function closer13(G, target) {
    const mon = G.mon;
    if (!R.watcher13) R.watcher13 = fig(G, 'tall', '7F', 0.2, 17, PI, { anim: 'twitch' });
    const w = R.watcher13;
    if (R.stage13 === 1) {
      w.setPos(0.2, 17);
      G.san(-5);
    } else {
      // 就站在鏡頭底下，抬頭看著你
      w.setPos(0.5, 2.6);
      w.anim('idle');
      w.obj.userData.head.rotation.x = -0.75;
      G.san(-8);
    }
    mon.glitch = 0.8;
    G.sfx('static');
    await G.wait(0.3);
    mon.glitch = 0;
    await G.lookAt(target, 0.8);
    // 推近一下，讓玩家看清楚畫面裡的東西又近了
    await G.fov(G.night === 3 ? 44 : 30, 0.6);
    await G.wait(1.0);
    await G.fov(null, 0.4);
  }

  /** 第三次不理它：第十三個畫面變成保全室，它就站在你背後 */
  async function behindYou(G, target) {
    const mon = G.mon;
    const L = A(G, '1F');
    if (R.watcher13) R.watcher13.remove();
    R.watcher13 = null;
    const fw = G.forward().setY(0).normalize();
    const lx = Math.max(-5.0, Math.min(-1.9, G.pos.x - L.ox - fw.x * 0.85));
    const lz = Math.max(3.0, Math.min(10.8, G.pos.z - fw.z * 0.85));
    const it = fig(G, 'tall', '1F', lx, lz, 0, { anim: 'twitch' });
    it.face(G.pos.x, G.pos.z);
    // 攝影機掛在房間另一頭的天花板角落，近距離拍你背後
    const cx = Math.max(-5.2, Math.min(-1.8, lx + (lx < -3.5 ? 1.5 : -1.5)));
    const cz = Math.max(2.9, Math.min(10.9, lz + (lz < 7 ? 2.0 : -2.0)));
    mon.cam13 = { pos: L.w(cx, 2.45, cz), look: L.w(lx, 1.45, lz) };
    G.cine(true);
    G.lock();
    mon.glitch = 1;
    G.sfx('static');
    await G.wait(0.3);
    mon.glitch = 0;
    await G.lookAt(target, 0.6);
    await G.fov(G.night === 3 ? 34 : 20, 0.9);
    const breath = G.loop('breath', it.world.setY(2.0));
    await G.wait(2.0);
    G.fov(null, 0.2);
    G.sfx('sting');
    await G.lookAt(it.headPos, 0.35);
    G.flash(1);
    G.hurt(1);
    G.sfx('scare');
    G.shake(0.05, 0.6);
    await G.wait(0.45);
    await G.fade(1, 0.12);
    breath.stop();
    it.remove();
    clear13(G);
    await G.wait(0.6);
    await G.fade(0, 0.5);
    G.cine(false);
    G.unlock();
    G.san(-20);
  }

  /* ================================================================ 電話（第二夜） */

  function startRing(G) {
    R.ring = G.loop('ring', A(G, '1F').anchors.phone);
    const h = A(G, '1F').props.handset;
    const y0 = h.position.y;
    R.ringShake = G.onFrame(() => {
      h.position.y = R.ring && Math.random() < 0.5 ? y0 + 0.006 : y0;
    });
    if (G.area !== '1F') G.toast('樓下的電話在響。');
  }

  function stopRing(G, timeout) {
    if (R.ring) R.ring.stop();
    R.ring = null;
    if (R.ringShake) R.ringShake();
    R.ringShake = null;
    G.nf.phoneDone = true;
    if (timeout) {
      G.run(async () => {
        G.sfx('sms');
        await G.wait(0.5);
        G.toast('林主任（21:52）：我今晚早睡，有事明天說。');
      });
    }
  }

  async function answerPhone(G) {
    stopRing(G, false);
    G.sfx('click');
    const ph = A(G, '1F').anchors.phone;
    await G.say('「{name}嗎？我林主任。」', { who: 'boss', pos: ph });
    await G.say('「頂樓的門沒鎖好，你現在上去，把門打開，再重新鎖一次。快點。」', { who: 'boss', pos: ph });
    const i = await G.choice('電話裡的林主任在等你回答。聲音很像，太像了。', ['「好，我馬上上去。」', '掛掉電話。', '「主任，你現在在哪裡？」']);
    if (i === 0) return die(G, 'E_PHONE', () => phoneScene(G));
    if (i === 1) {
      G.sfx('laugh', ph);
      G.san(-12);
    } else {
      await G.say('「我在頂樓等你啊。」', { who: 'boss', pos: ph });
      G.san(-15);
    }
  }

  /** 主任的電話：頂樓，風很大。他慢慢轉過身，臉的位置貼著一頁守則。 */
  async function phoneScene(G) {
    await G.fade(1, 0.8);
    const D6 = A(G, '6F');
    D6.props.rooftop.visible = true;
    D6.props.endless.visible = false;
    G.door('6F', 'roof', 1.6);
    G.teleport('6F', 0, 22.6, PI);
    G.setPitch(0.02);
    const wind = G.loop('breath', W(G, '6F', 0, 2, 32));
    const boss = fig(G, 'boss', '6F', 0, 30.5, 0, { paperFace: true });
    G.aux({ area: '6F', pos: [1.5, 7, 27], target: [0, 0.8, 30.5], intensity: 1.6, angle: 0.4, color: 0xa8bcd8 });
    await G.fade(0, 1.2);
    await G.rail([[0, 0, 22.6], [0, 0, 26.2]], 2.6, '6F');
    await G.lookAt(boss.headPos, 0.6);
    await G.say('「你來了。」', { who: 'boss', pos: boss.headPos });
    G.sfx('sting');
    await boss.turn(PI, 2.2);
    await G.fov(38, 1.0);
    await G.wait(0.9);
    await G.rail([[0, 0, 26.2], [0, 0, 28.9]], 0.6, '6F');
    G.flash(1);
    G.sfx('scare');
    G.shake(0.05, 0.5);
    await G.wait(0.3);
    wind.stop();
  }

  /* ================================================================ 電梯 4 樓 */

  function elevatorStop(G, from) {
    if (G.nf.elev4 || from === '4F') return null;
    G.nf.elev4 = true;
    return (g) => fourth(g);
  }

  async function fourth(G) {
    const n = G.night;
    const F4 = A(G, '4F');
    G.elevator('4F', true);
    await G.wait(0.6);
    // 鏡頭轉向門外
    G.run(() => G.lookAt(F4.w(0, 1.5, n === 2 ? 16 : 4), 1.2));
    let pressed = false;
    const panel = G.addInteract({ id: 'panel4', area: '4F', pos: F4.anchors.elevPanel, reach: 1.4, angle: 0.7, label: '按關門鍵', use: () => (pressed = true) });
    const exited = () => G.pos.x > F4.ox - 1.4;
    const got = await G.waitUntil(() => exited() || pressed, 9);
    G.removeInteract(panel);
    if (got && exited()) {
      if (n === 1) {
        G.lock();
        await G.wait(1.5);
        await G.fade(1, 1.2);
        G.san(-25);
        G.battery(-25);
        F4.elevator.target = 0;
        G.teleport('1F', 0, 16, PI);
        G.setPitch(-0.8); // 低頭：鞋底沾滿了香灰
        G.unlock();
        await G.fade(0, 1.4);
        await G.think('（你不記得自己是怎麼回來的。）');
        return 'warped';
      }
      // 四樓：門在你身後關上；所有人轉過來，燈每閃一次就近一點
      return die(G, 'E_4F', async () => {
        G.elevator('4F', false);
        await G.lookAt(F4.w(-1.6, 1.5, -1.5), 0.9);
        await G.wait(1.2);
        await G.lookAt(F4.w(0, 1.5, 4), 0.9);
        G.sfx('sting');
        if (n === 2) {
          const g = F4.props.guard;
          g.userData.setAnim('idle', { track: true, snap: true });
          for (let k = 0; k < 3; k++) {
            await flicker(G, 1, 0.35);
            g.position.z -= 4.6;
          }
        } else {
          const backs = F4.props.backs.children;
          backs.forEach((f) => {
            f.rotation.y += PI;
            f.userData.setAnim('idle', { track: true });
          });
          for (let k = 0; k < 3; k++) {
            await flicker(G, 1, 0.35);
            backs.forEach((f) => (f.position.z -= 0.55));
          }
        }
        await G.wait(0.5);
        G.flash(1);
        G.sfx('scare');
        G.shake(0.05, 0.6);
        await G.wait(0.3);
      });
    }
    if (pressed) {
      G.sfx('click');
      if (n === 1) {
        // 門關上了。電梯晃了一下，像有人走了進來。
        G.shake(0.025, 0.7);
        const ghost = fig(G, 'adult', '4F', -3.5, -2.2, PI / 4, { variant: 3, track: true });
        G.run(async () => {
          await G.wait(1.9);
          ghost.remove();
        });
        G.san(-12);
      } else {
        // 你一直按，門就是不關
        const g = n === 2 ? F4.props.guard : null;
        if (g) {
          g.position.z = 5.5;
          g.userData.setAnim('idle', { track: true, snap: true });
        }
        G.sfx('sting');
        G.san(-18);
        await G.wait(2.0);
        if (g) {
          g.position.z = 16.8;
          g.userData.setAnim('beckon', { track: false });
        }
      }
    } else {
      if (n === 3) await G.say('「明天見。」', { who: 'many', pos: F4.w(0, 1.6, 1.0) });
      G.san(n === 1 ? -3 : -5);
    }
    return 'ok';
  }

  function panelExtra(G) {
    if (G.night !== 3) return [];
    return [{ label: '7（亮著）', use: async (g) => {
      g.lock();
      g.elevator(g.area, false);
      await g.wait(1.2);
      g.sfx('motor');
      g.shake(0.006, 6);
      // 按鈕陷了下去，沒有彈回來。電梯一直往上，久到不可能。
      await g.wait(2.0);
      g.sfx('ding');
      await g.wait(1.3);
      g.sfx('ding');
      await g.wait(0.9);
      g.sfx('ding');
      g.san(-25);
      g.setBattery(0);
      const off = { x: g.pos.x - g.world.areas[g.area].ox, z: g.pos.z };
      g.teleport('1F', off.x, off.z);
      g.sfx('ding');
      g.elevator('1F', true);
      g.unlock();
      g.toast('手電筒的電全沒了。');
    } }];
  }

  /* ================================================================ 樓梯與 7F */

  function stairsTarget(G, from, dir) {
    const n = G.night;
    const t = G.time;
    const nf = G.nf;
    if (from === '7F') return { blocked: '' };
    if (dir !== 'up') return null;
    if (n === 3 && from === '6F' && t >= T.DOOR7 && t < T.END && !nf.chenLost && !nf.rescued) {
      nf.on7 = 'seventh';
      return { area: '7F', arrive: 'below', special: 'seventh' };
    }
    if (nf.stairs7) return null;
    const lockTime = t >= T.LOCK && t < T.UNLOCK;
    let trig = false;
    if (n === 1) trig = (from === '3F' || from === '5F') && t >= 120;
    if (n === 2) trig = ['2F', '3F', '5F'].includes(from) && t >= 60;
    if (n === 3) trig = (from === '3F' || from === '5F') && t < T.DOOR7;
    if (!trig || lockTime) return null;
    nf.stairs7 = true;
    nf.on7 = 'anomaly';
    nf.dest7 = G.D.FLOORS[G.D.FLOORS.indexOf(from) + 1];
    nf.loops7 = 0;
    return { area: '7F', arrive: 'below', special: 'anomaly' };
  }

  async function onLanding(G, areaId, dir, from, tgt) {
    if (areaId !== '7F') return;
    const n = G.night;
    G.addFlag('saw7f');
    const A7 = A(G, '7F');
    const sign = A7.stairs.sign.getWorldPosition(new THREE.Vector3());
    if (tgt.special === 'seventh') return seventhDoor(G);
    G.sfx(tgt.loop ? 'static' : 'sting');
    // 鏡頭帶到樓層標示：7F
    await G.lookAt(sign, tgt.loop ? 0.4 : 0.8);
    if (tgt.loop) return;
    if (n === 2) {
      // 標示下面有人用紅筆補了一行字
      await G.wait(0.4);
      await G.lookAt(A7.props.stairText.getWorldPosition(new THREE.Vector3()), 0.6);
    } else if (n === 3) {
      const above = A7.w(6, 2.8, -3);
      await G.say('「{name}——」', { who: 'self', pos: above });
      G.run(async () => {
        while (G.area === '7F' && G.nf.on7 === 'anomaly') {
          await G.wait(4.5);
          if (G.area === '7F' && G.nf.on7 === 'anomaly') await G.say('「{name}——」', { who: 'self', pos: above });
        }
      });
    }
  }

  async function up7(G) {
    const n = G.night;
    const nf = G.nf;
    if (nf.on7 === 'seventh') {
      G.toast('上面沒有路了。');
      return;
    }
    if (n === 1) {
      nf.loops7 = (nf.loops7 || 0) + 1;
      G.san(-7);
      if (nf.loops7 < 3) {
        await G.useStairs('up', { area: '7F', arrive: 'below', loop: true });
        return;
      }
      nf.on7 = null;
      G.battery(-20);
      await G.useStairs('up', { area: nf.dest7, arrive: 'below' });
      return;
    }
    return die(G, 'E_7F', () => endlessStairs(G));
  }

  /** 七樓：一直往上，標示再也沒有變回來；最後抬頭，上面的樓梯站滿了人 */
  async function endlessStairs(G) {
    const A7 = A(G, '7F');
    const sign = A7.stairs.sign.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i < 4; i++) {
      await G.rail(A7.stairs.upPath, 1.0 - i * 0.15, '7F');
      await G.fade(1, 0.15);
      G.teleport('7F', A7.stairs.fromBelow[0][0], A7.stairs.fromBelow[0][2], null, A7.stairs.fromBelow[0][1]);
      G.fade(0, 0.15).catch(() => {});
      await G.rail(A7.stairs.fromBelow, 0.8 - i * 0.12, '7F');
      G.sfx('static');
      await G.lookAt(sign, 0.3);
      await G.wait(0.15);
    }
    const crowd = stairCrowd(G, 6, ['adult', 'woman', 'guard']);
    G.blackout(true);
    await G.wait(0.4);
    crowd.forEach((f) => (f.obj.visible = true));
    G.blackout(false);
    G.loop('whisper');
    await G.lookAt(A7.w(5.6, 2.2, -3.0), 1.4);
    await G.fov(48, 1.4);
    G.sfx('sting');
    await G.wait(1.2);
  }

  /** 有人叫你：回答之後，上面的樓梯一下子站滿了人，一起笑 */
  async function answerName(G) {
    const A7 = A(G, '7F');
    return die(G, 'E_NAME', async () => {
      await G.say('「我在這裡。」', { who: 'self' });
      const crowd = stairCrowd(G, 7, ['adult', 'woman', 'adult', 'self']);
      await G.lookAt(A7.w(5.6, 2.0, -3.0), 0.8);
      G.blackout(true);
      await G.wait(0.6);
      crowd.forEach((f) => (f.obj.visible = true));
      G.blackout(false);
      G.sfx('laugh', A7.w(6, 2.4, -3));
      await G.wait(1.2);
      crowd.forEach((f) => f.anim('lean', { track: true }));
      await G.say('「找到了。」', { who: 'many', pos: A7.w(5, 2.2, -3) });
      await G.fov(42, 0.5);
      await lunge(G, crowd[0], 0.8);
    });
  }

  /** 轉身下樓：一路走回 1F，途中不可以回頭 */
  async function down7(G) {
    const n = G.night;
    const nf = G.nf;
    const A7 = A(G, '7F');
    const was = nf.on7;
    nf.on7 = null;
    if (was === 'seventh') {
      await G.useStairs('down', { area: '6F', arrive: 'above' });
      G.san(-5);
      return;
    }
    G.lock();
    let looked = false;
    let steps = 0;
    const off = G.onFrame((dt) => {
      steps += dt;
      if (steps > 0.55) {
        steps = 0;
        const back = G.forward().multiplyScalar(-2.4).add(G.pos).setY(G.pos.y + 1.2);
        G.sfx('step', back, { mat: 'concrete', gain: 1.6 });
      }
      if (!looked && G.yawOff(-1, 0) < 1.0) {
        looked = true;
        G.flash(0.9);
        G.sfx('scare');
        G.hurt(1);
        const p = G.pos;
        // 第一夜：樓梯上方有人蹲著；第二夜：站滿了人；第三夜：就貼在你身後
        const ghosts = [];
        if (n === 1) ghosts.push(fig(G, 'adult', '7F', 3.7, -0.9, -PI / 2, { crouch: true, track: true }));
        else if (n === 2) for (let i = 0; i < 4; i++) ghosts.push(fig(G, i % 2 ? 'woman' : 'adult', '7F', 3.0 + i * 0.35, -0.9 + (i % 2 ? 0.3 : -0.3), -PI / 2, { variant: i, track: true }));
        else ghosts.push(fig(G, 'self', '7F', p.x - A7.ox - 0.9, p.z, -PI / 2, { track: true, tag: G.S.name || '　' }));
        ghosts.forEach((g) => {
          g.face(p.x, p.z);
          g.track(true, true);
        });
        G.run(async () => {
          await G.wait(0.9);
          ghosts.forEach((g) => g.remove());
        });
      }
    });
    const path = [[2.6, 0, -0.9], [4.1, -0.05, -0.9], [6.8, -1.65, -0.9]];
    await G.rail(path, 3.2, '7F');
    await G.fade(1, 0.6);
    await G.wait(1.4);
    off();
    const arr = A(G, '1F').stairs.fromAbove;
    G.teleport('1F', arr[0][0], arr[0][2], null, arr[0][1]);
    G.fade(0, 0.5).catch(() => {});
    await G.rail(arr, 1.2, '1F');
    G.unlock();
    G.san(looked ? (n === 1 ? -18 : -20) : -5);
  }

  /* ---------------------------------------------------------------- 七樓（第三夜 05:00） */

  async function seventhDoor(G) {
    const A7 = A(G, '7F');
    G.door('7F', 'stair7', true);
    G.sfx('door', A7.anchors.door7);
    // 門後面，是第十三個畫面裡的那條走廊
    await G.lookAt(A7.w(0.2, 1.3, 8), 1.0);
    if (G.S.san < 20) {
      G.nf.shaky = true;
      await G.think('（你的手抖得快握不住手電筒。光圈在牆上一直晃，你不確定自己能不能一路照著影子，走到走廊盡頭。）');
    }
    const entered = await G.waitUntil(() => G.area !== '7F' || G.pos.x < A7.ox + 1.3, 600);
    if (!entered || G.area !== '7F') return;
    await corridor7(G);
  }

  async function corridor7(G) {
    const A7 = A(G, '7F');
    const nf = G.nf;
    nf.on7 = null;
    nf.timeFrozen = true; // 七樓沒有時間；走廊裡時鐘停在 05:xx
    nf.noRun = true; // 低著頭照影子，跑不起來
    const chen = A7.props.chen;
    chen.userData.setAnim('write', { track: false });
    chen.userData.head.rotation.set(0, 0, 0);
    if (!G.flashOn) {
      G.toast('太暗了。');
      const lit = await G.waitUntil(() => G.flashOn, 3);
      if (!lit) return die(G, 'E_7F', () => darkCorridor(G));
    }
    // 光從身後的門照進來，影子落在前方
    G.aux({ area: '7F', pos: [0.9, 2.3, -1.6], target: [0, 0, 12], intensity: 1.9, angle: 0.75, color: 0xffcf96 });
    G.shadow(true);
    nf.flashScale = 0.25;
    // 鏡頭自己低下來，讓玩家看見自己的影子
    G.cine(true);
    await G.lookAt(A7.w(0, 0, 2.6), 1.3);
    await G.wait(0.4);
    G.cine(false);
    if (G.S.clues.includes('c4')) G.toast('照著自己的影子。不管誰叫你，都不要照過去。');
    let offT = 0;
    let warned = false;
    let voices = 0;
    let fail = null;
    const behind = () => G.pos.clone().add(G.V3(0, 1.5, -3.5));
    await new Promise((resolve) => {
      const off = G.onFrame((dt) => {
        const z = G.pos.z;
        if (z < 1.2) {
          if (!G.flashOn && G.S.battery <= 0) fail = 'dark';
          if (fail) {
            off();
            resolve();
          }
          return;
        }
        const facingBack = G.yawOff(0, -1) < 1.15;
        const onShadow = G.flashOn && G.pitch < -0.32 && G.yawOff(0, 1) < 0.95;
        if (facingBack) fail = 'light';
        if (!G.flashOn && G.S.battery <= 0) fail = 'dark';
        offT = onShadow ? Math.max(0, offT - dt * 0.5) : offT + dt;
        if (offT > 0.6 && !warned) {
          // 光一離開影子：耳邊一陣低語，畫面閃一下
          warned = true;
          G.flash(0.35);
          G.hurt(0.4);
          G.voice('many', 1.2, behind());
        }
        if (offT < 0.2) warned = false;
        if (offT > 1.8) fail = G.flashOn ? 'light' : 'dark';
        if (voices === 0 && z > 7) {
          voices = 1;
          G.run(() => G.say('「{name}！你在幹什麼？快回來！」', { who: 'boss', pos: behind() }));
        } else if (voices === 1 && z > 14) {
          voices = 2;
          G.run(() => G.say('「{name}，回家吃飯了。」', { who: 'woman', pos: behind() }));
          G.run(() => G.san(-6));
        } else if (voices === 2 && z > 21) {
          voices = 3;
          G.run(() => G.say('「是我啊。你回頭看看我。」', { who: 'self', pos: behind() }));
          G.run(() => G.san(-4));
        }
        if (fail || z > 27.6) {
          off();
          resolve();
        }
      });
    });
    if (fail === 'light') return die(G, 'E_LIGHT', () => noShadow(G));
    if (fail) return die(G, 'E_7F', () => darkCorridor(G));

    // 老陳
    G.lock();
    const chenHead = A7.anchors.chen;
    await G.lookAt(chenHead, 0.8);
    await G.say('「你是誰？」', { who: 'chen', pos: chenHead });
    const a = await G.choice('他沒有回頭。', ['「我是來交班的。」', '「老陳，我來帶你回去。」']);
    chen.userData.setAnim('idle', { track: false });
    await G.say(a === 0 ? '「交班啊。好久沒聽到這兩個字了。」' : '「回去？回哪裡去？」', { who: 'chen', pos: chenHead });
    await G.say('「先回答我一個問題。它學什麼都學得很像，就是學不會這個。」', { who: 'chen', pos: chenHead });
    await G.say('「我姓陳。怎麼寫？」', { who: 'chen', pos: chenHead });
    const b = await G.choice('「我姓陳。怎麼寫？」', ['「耳東陳。」', '「耳車陣。」']);
    if (b === 1) {
      await G.say('「……你也是它。」', { who: 'chen', pos: chenHead });
      // 他轉回去，繼續在牆上寫字
      chen.userData.setAnim('write', { track: false });
      await G.wait(1.2);
      G.san(-30);
      nf.chenLost = true;
      await leave7(G);
      return;
    }
    // 他第一次回頭看你
    await G.tween(1.4, (k) => (chen.userData.head.rotation.y = k * PI * 0.75));
    await G.say('「好，我們走。」', { who: 'chen', pos: chenHead });
    await G.say('「你走前面，一直照著影子，不要回頭。我跟著你的影子走。」', { who: 'chen', pos: chenHead });
    await G.fade(1, 0.5);
    chen.visible = false;
    G.teleport('7F', 0, 27.2, 0);
    G.setPitch(-0.45);
    // 現在光在身後（老陳的燈），影子往門口延伸
    G.aux({ area: '7F', pos: [-0.5, 2.0, 31.2], target: [0, 0, 16], intensity: 2.0, angle: 0.8, color: 0xffc27a });
    const invisible = (h) => h.obj.traverse((o) => {
      if (o.isMesh) o.material = G.world.M.invisible;
    });
    const chenShadow = fig(G, 'chen', '7F', 0, 28.4, 0, { anim: 'walk' });
    invisible(chenShadow);
    let third = null;
    G.unlock();
    await G.fade(0, 0.6);
    let result = null;
    let lastZ = G.pos.z;
    await new Promise((resolve) => {
      const off = G.onFrame((dt) => {
        const z = G.pos.z;
        const sp = Math.abs(z - lastZ) / Math.max(dt, 0.001);
        lastZ = z;
        chenShadow.setPos(G.pos.x - A7.ox, z + 1.3);
        chenShadow.anim('walk', { speed: Math.min(1.4, sp) });
        if (third) {
          third.setPos(G.pos.x - A7.ox + 0.3, z + 2.7);
          third.anim('walk', { speed: Math.min(1.4, sp) });
        }
        if (!third && z < 15) {
          // 地上的影子，從兩個變成三個
          third = fig(G, 'tall', '7F', 0.3, z + 2.7, 0, { anim: 'walk' });
          invisible(third);
          G.sfx('heavyStep', G.pos.clone().add(G.V3(0, 0.5, 2.7)));
          G.shake(0.01, 0.3);
        }
        if (G.yawOff(0, 1) < 1.3) result = 'back';
        if (z < 0.6) result = 'out';
        if (result) {
          off();
          resolve();
        }
      });
    });
    chenShadow.remove();
    if (third) third.remove();
    if (result === 'back') {
      // 身後空無一人，只有一支紅筆在地上滾了兩圈
      G.sfx('sting');
      G.lock();
      const pen = A7.props.redPen;
      const x0 = G.pos.x - A7.ox + 0.15;
      pen.position.set(x0, 0.012, G.pos.z + 1.3);
      pen.visible = true;
      G.cine(true);
      await G.lookAt(A7.w(x0, 0, pen.position.z), 0.6);
      await G.tween(1.1, (k) => {
        pen.rotation.z = 0.4 + k * 4;
        pen.position.x = x0 + k * 0.22;
      });
      await G.wait(0.6);
      G.cine(false);
      G.unlock();
      G.san(-30);
      nf.chenLost = true;
      await leave7(G);
      return;
    }
    nf.rescued = true;
    G.addFlag('rescued');
    await leave7(G);
    R.compArea = null;
    companion(G);
    await G.lookAt(R.companion.headPos, 0.8);
    await G.say('「謝謝。」', { who: 'chen', pos: R.companion.headPos });
  }

  /** 沒有光：四周的腳步聲越來越近 */
  async function darkCorridor(G) {
    G.blackout(true);
    G.setFlash(false);
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * PI * 2;
      const r = 3 - i * 0.35;
      G.sfx('heavyStep', G.pos.clone().add(G.V3(Math.cos(a) * r, 0.5, Math.sin(a) * r)));
      await G.wait(0.4 - i * 0.03);
    }
    G.loop('whisper');
    await G.wait(1.0);
    G.flash(0.7);
    G.sfx('scare');
    G.shake(0.05, 0.5);
    await G.wait(0.3);
  }

  /** 沒有影子：光裡什麼都沒有；低頭，影子也不見了；它用你的樣子走下樓 */
  async function noShadow(G) {
    const A7 = A(G, '7F');
    G.nf.flashScale = 1;
    await G.lookAt(G.pos.clone().add(G.V3(0, 1.4, -6)), 0.6);
    G.loop('whisper');
    await G.wait(1.3);
    G.shadow(false);
    await G.lookAt(G.pos.clone().add(G.V3(0, 0, -1.4)), 1.2);
    G.sfx('sting');
    await G.wait(1.2);
    const p = G.pos;
    const self = fig(G, 'self', '7F', p.x - A7.ox + 0.4, p.z + 0.9, PI, { tag: G.S.name || '　' });
    await G.say('「謝謝。」', { who: 'self', pos: self.headPos });
    await G.lookAt(self.headPos, 0.7);
    await self.walkTo(A7.ox + 0.4, -0.6, 1.2);
  }

  async function leave7(G) {
    G.lock();
    await G.fade(1, 0.8);
    G.aux(null);
    G.shadow(false);
    G.nf.flashScale = 1;
    G.nf.shaky = false;
    G.nf.timeFrozen = false;
    G.nf.noRun = false;
    G.door('7F', 'stair7', false);
    const arr = A(G, '6F').stairs.fromAbove;
    G.teleport('6F', arr[0][0], arr[0][2], null, arr[0][1]);
    G.fade(0, 0.6).catch(() => {});
    await G.rail(arr, 1.2, '6F');
    G.unlock();
  }

  function companion(G) {
    if (R.compArea !== G.area || !R.companion) {
      if (R.companion) R.companion.remove();
      R.companion = fig(G, 'chen', G.area, G.pos.x - A(G, G.area).ox, G.pos.z + 1.5, 0, { tag: '陳' });
      R.compArea = G.area;
    }
    const c = R.companion;
    const p = c.world;
    const dx = G.pos.x - p.x;
    const dz = G.pos.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.6) {
      const k = (d - 1.5) / d;
      c.setPos(p.x - A(G, G.area).ox + dx * k * 0.08, p.z + dz * k * 0.08);
      c.anim('walk', { speed: Math.min(1.4, (d - 1.5) * 1.5) });
    } else if (c.obj.userData.anim.mode === 'walk') c.anim('idle', { speed: 0 });
    c.face(G.pos.x, G.pos.z);
  }

  /* ================================================================ 理智歸零 */

  /** 新的住戶：住在這裡的人一個一個圍過來；你慢慢坐到地上 */
  async function onSanZero(G, cause) {
    G.cine(true);
    G.lock();
    G.fear(1);
    G.loop('whisper');
    const Ar = A(G, G.area);
    const p = G.pos.clone();
    const ring = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + 0.3;
      const kind = i === 0 ? 'child' : i % 3 === 0 ? 'woman' : 'adult';
      const f = fig(G, kind, G.area, p.x - Ar.ox + Math.cos(a) * 1.9, p.z + Math.sin(a) * 1.9, 0, { variant: i, track: true });
      f.face(p.x, p.z);
      f.obj.visible = false;
      ring.push(f);
    }
    for (const f of ring) {
      f.obj.visible = true;
      G.sfx('step', f.world, { mat: 'concrete' });
      await G.wait(0.3);
    }
    await G.lookAt(ring[0].headPos, 1.0);
    await G.tween(2.4, (k) => {
      G.P.pos.y = p.y - k * 0.85;
    });
    await G.say('「管理員，你也住在這裡嗎？」', { who: 'child', pos: ring[0].headPos });
    ring.forEach((f) => f.anim('lean', { track: true }));
    await G.wait(1.0);
    await G.fade(1, 1.6);
    G.endGame('E_SAN', cause);
  }

  /* ================================================================ 第一夜的事件 */

  async function freeBattery(G) {
    G.nf.battery = true;
    const i = await G.choice('繳費機上，一盒全新的電池。便利貼：「給新來的。」', ['不理它。', '換上這些電池。', '收起來，帶回保全室。']);
    A(G, 'B1').props.batteryBox.visible = false;
    if (i === 1) {
      // 手電筒亮得刺眼：每一台車的防塵布底下，都坐著一個人
      G.setBattery(100);
      G.setFlash(true);
      G.sfx('sting');
      const B = A(G, 'B1');
      const ghosts = B.props.cars.map((c, k) => fig(G, 'adult', 'B1', c.seat.x - B.ox, c.seat.z, -PI / 2, { seated: true, y: 0.15, variant: k + 2, track: true }));
      G.cine(true);
      await G.lookAt(ghosts[1].headPos, 0.9);
      ghosts.forEach((g) => g.track(true, true));
      await G.wait(1.4);
      G.cine(false);
      G.san(-15);
    } else if (i === 2) {
      G.sfx('drip');
      G.toast('口袋越來越重，越來越濕。');
      G.san(-5);
    }
  }

  async function tv(G) {
    G.nf.tv = true;
    const i = await G.choice('新聞畫面右上角的日期，是十年前。', ['關掉電視。', '不理它。']);
    if (i === 0) {
      // 黑掉的螢幕：候診椅上一瞬間坐滿了人
      A(G, '2F').props.tv.material.color.setHex(0x000000);
      const A2 = A(G, '2F');
      const ghosts = A2.props.waitChairs.slice(0, 7).map((c, k) => fig(G, k % 3 === 1 ? 'woman' : 'adult', '2F', c.position.x, c.position.z, -PI / 2, { seated: true, variant: k, track: true }));
      G.flash(0.5);
      G.sfx('static');
      await G.wait(0.5);
      ghosts.forEach((g) => g.remove());
      G.san(-6);
    } else {
      G.voice('man', 1.2, A(G, '2F').anchors.tv);
      G.san(-2);
    }
  }

  async function roster(G) {
    G.nf.roster = true;
    const R5 = A(G, '5F');
    G.cine(true);
    await G.lookAt(R5.anchors.roster, 0.5);
    await G.fov(32, 0.8);
    await G.wait(1.1);
    await G.fov(null, 0.4);
    G.cine(false);
    if (G.night === 1) {
      const i = await G.choice('每一格都寫著「陳」。最後一格是你的名字，你的字跡。', ['撕下值班表。', '不理它。']);
      if (i === 0) {
        G.sfx('page');
        G.toast('後面還有一張，一模一樣。');
        G.san(-8);
      } else G.san(-4);
    } else {
      const i = await G.choice('今晚是你，明天也是你。再下一格寫著「交班」。', ['不理它。', '在「交班」旁邊寫下老陳的名字。']);
      if (i === 1) {
        G.addFlag('wrote_chen');
        G.sfx('chalk');
        await G.wait(0.6);
        G.voice('man', 0.8, R5.anchors.roster.clone().setX(R5.anchors.roster.x - 1));
        G.san(-6);
      } else G.san(-4);
    }
  }

  async function child(G) {
    const c = R.child;
    const pos = c.headPos;
    G.lock();
    // 頭慢慢轉過來，轉到身體轉不到的角度
    const cw = c.world;
    let yaw = Math.atan2(G.pos.x - cw.x, G.pos.z - cw.z) - c.obj.rotation.y;
    while (yaw > PI) yaw -= PI * 2;
    while (yaw < -PI) yaw += PI * 2;
    c.anim('idle', { track: false });
    const head = c.obj.userData.head;
    await G.lookAt(pos, 0.9);
    if (Math.abs(yaw) > 1.2) G.sfx('scrape', pos);
    await G.tween(Math.abs(yaw) > 1.2 ? 1.6 : 0.6, (k) => (head.rotation.y = yaw * k));
    await G.say('「管理員，」', { who: 'child', pos });
    await G.say('「我住在這裡。我找不到我媽媽。你可以帶我回家嗎？」', { who: 'child', pos });
    const i = await G.choice('他在等你回答。', ['「明天早上管理室有人。」然後離開。', '問他住在幾樓。', '牽著他的手，帶他去保全室。']);
    G.unlock();
    if (i === 0) {
      // 他沒有說話。身後傳來翻書的聲音，一頁一頁，跟著你
      c.anim('swing', { track: true });
      G.run(async () => {
        for (let k = 0; k < 4; k++) {
          await G.wait(1.1);
          G.sfx('page', c.world.clone().setY(0.9));
        }
      });
      G.san(-3);
    } else if (i === 1) {
      await G.say('「七樓。」', { who: 'child', pos });
      await G.say('「最上面那層。」', { who: 'child', pos });
      c.track(false);
      await G.tween(0.8, (k) => (c.obj.userData.head.rotation.z = k * 0.75));
      G.san(-10);
    } else {
      // 他的手很冰，很小。你低頭跟他說話——你牽著的，是一個空書包的背帶
      G.lock();
      G.cine(true);
      const C = A(G, '3F');
      const side = G.forward().setY(0).normalize();
      const sx = G.pos.x - C.ox + side.z * 0.45 + side.x * 0.35;
      const sz = G.pos.z - side.x * 0.45 + side.z * 0.35;
      c.setPos(sx, sz);
      c.obj.position.y = 0;
      c.face(G.pos.x, G.pos.z);
      await G.wait(1.4);
      await G.lookAt(c.headPos, 0.9);
      await G.wait(0.5);
      await flicker(G, 1, 0.25);
      c.remove();
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.14), G.world.M.red);
      bag.position.set(sx, 0.07, sz);
      bag.rotation.set(PI / 2, 0, 0.9);
      addExtra(G, '3F', bag);
      G.sfx('sting');
      await G.lookAt(A(G, '3F').w(sx, 0, sz), 0.6);
      await G.wait(1.2);
      G.cine(false);
      G.unlock();
      G.san(-20);
    }
  }

  /* ================================================================ 第二夜的事件 */

  async function woman(G) {
    const w = R.woman;
    const pos = w.headPos.clone().setY(0.95);
    G.lock();
    w.anim('idle', { track: true });
    await G.lookAt(pos, 0.9);
    await G.say('「管理員，」', { who: 'woman', pos });
    await G.say('「我住樓上，我家的門打不開。你可以陪我上去嗎？七樓，很快。」', { who: 'woman', pos });
    const i = await G.choice('她光著腳，蹲在鐵捲門前。', ['「明天早上管理室有人。」然後離開。', '陪她上樓。', '問她叫什麼名字。']);
    G.unlock();
    if (i === 0) {
      // 她慢慢站起來，站得比你高很多
      G.cine(true);
      const wp = w.obj.position.clone();
      const yaw = w.obj.rotation.y;
      w.remove();
      const tall = fig(G, 'woman', '2F', wp.x, wp.z, yaw, { track: true });
      tall.track(true, true);
      await G.tween(1.6, (k) => tall.obj.scale.set(1, 0.55 + k * 0.8, 1));
      await G.lookAt(tall.world.setY(2.2), 0.7);
      await G.wait(0.8);
      G.cine(false);
      R.woman = tall;
      G.san(-3);
    } else if (i === 1) {
      G.lock();
      await G.fade(1, 1.2);
      w.remove();
      G.san(-25);
      G.battery(-25);
      G.teleport('1F', 0, -1.2, PI);
      G.unlock();
      await G.fade(0, 1);
      await G.think('（3、5、6、7、7、7……回過神來，你一個人站在 1F。）');
    } else {
      await G.say('「{name}。」', { who: 'woman', pos });
      await G.say('「跟你一樣。」', { who: 'woman', pos });
      G.san(-15);
    }
  }

  async function board2(G) {
    G.nf.board = true;
    G.cine(true);
    await G.lookAt(A(G, '3F').anchors.board, 0.5);
    await G.fov(40, 0.7);
    await G.wait(0.8);
    await G.fov(null, 0.3);
    G.cine(false);
    const i = await G.choice('七層的大樓，每層一個小人。第七層的穿著制服。角落有一行很小的字。', ['湊近看。', '擦掉白板。']);
    if (i === 0) {
      await G.note('c5');
      G.san(-2);
    } else {
      setBoard(G, 'blank');
      G.sfx('chalk');
      G.toast('第七層的小人，怎麼擦都擦不掉。');
      G.san(-8);
    }
  }

  async function carNote(G) {
    G.nf.car = true;
    const i = await G.choice('引擎在轉，駕駛座上沒有人，椅墊是溫的。副駕駛座上有一本筆記本。', ['翻開筆記本。', '把車子熄火。', '離開。']);
    if (i === 0) {
      await G.note('c2');
      G.san(-4);
    } else if (i === 1) {
      if (R.engine) R.engine.stop();
      R.engine = null;
      await G.wait(0.8);
      await G.say('「謝謝。」', { who: 'man', pos: A(G, 'B1').props.cars[1].seat.clone().setY(1.0) });
      G.san(-8);
    }
  }

  async function scratch(G) {
    const door = A(G, '6F').anchors.roofDoor;
    G.sfx('scrape', door);
    await G.wait(2);
    G.sfx('scrape', door);
    await G.say('「{name}，幫我開門。」', { who: 'self', pos: door });
  }

  async function roof2(G) {
    G.nf.roofTalk = true;
    const door = A(G, '6F').anchors.roofDoor;
    const i = await G.choice('門的另一邊，有人在用指甲刮門。', ['不理會。', '問：「你是誰？」']);
    if (i === 1) {
      await G.say('「我是你啊。」', { who: 'self', pos: door });
      G.san(-15);
    } else G.san(-5);
  }

  /* ================================================================ 第三夜的事件 */

  async function double(G) {
    const d = R.double;
    const pos = d.headPos;
    G.lock();
    d.anim('idle', { track: true });
    await G.lookAt(pos, 0.9);
    // 慢慢推近：他的名牌上寫著你的名字
    await G.fov(46, 1.4);
    await G.say('「我住在這裡。」', { who: 'self', pos });
    await G.say('「你可以讓我回家嗎？回你家。」', { who: 'self', pos });
    await G.fov(null, 0.4);
    const i = await G.choice('他穿著跟你一樣的制服，長得跟你一模一樣。', ['「明天早上管理室有人。」然後離開。', '問他：「你叫什麼名字？」', '答應他。']);
    G.unlock();
    if (i === 0) {
      await G.say('「明天早上，管理室有人。」', { who: 'self', pos });
      G.san(-5);
    } else if (i === 1) {
      await G.say('「{name}。那你呢？」', { who: 'self', pos });
      G.san(-20);
    } else {
      // 他站起來，從你身邊走過去
      G.sfx('sting');
      G.lock();
      G.cine(true);
      const dp = d.obj.position.clone();
      d.remove();
      const up = fig(G, 'self', '2F', dp.x + 0.5, dp.z, PI / 2, { tag: G.S.name || '　' });
      const A2 = A(G, '2F');
      const p = G.pos;
      await G.lookAt(up.headPos, 0.5);
      await up.walkTo(p.x + 0.7, p.z - 0.6, 1.3);
      await up.walkTo(A2.ox + 0.4, -1.2, 1.3);
      up.remove();
      G.cine(false);
      G.unlock();
      G.san(-45);
    }
  }

  async function bosses(G) {
    R.bosses.forEach((b) => b.track(true, true));
    G.sfx('sting');
    const pos = R.bosses[1].headPos;
    await G.lookAt(pos, 0.6);
    await G.say('「{name}，三點記得上頂樓。守則第五條。」', { who: 'many', pos });
    const i = await G.choice('三台車的駕駛座上，都坐著一個林主任。', ['不理會。', '「第五條不是這樣寫的。」']);
    if (i === 1) {
      G.sfx('laugh', pos);
      await G.say('「你記性真好。」', { who: 'many', pos });
      G.san(-10);
    } else G.san(-8);
  }

  async function board3(G) {
    G.nf.board = true;
    const i = await G.choice('黑板上只有一道題目：「福安大廈共有幾層？」', ['寫下「六」。', '寫下「七」。', '安靜地離開。']);
    if (i === 0) {
      // 學生們同時放下筆，消失了
      setBoard(G, 'six');
      G.sfx('chalk');
      R.students.forEach((s) => s.anim('idle'));
      await G.wait(0.6);
      G.blackout(true);
      await G.wait(0.4);
      R.students.forEach((s) => s.remove());
      G.blackout(false);
      G.san(5);
    } else if (i === 1) {
      // 所有學生同時轉過頭來
      setBoard(G, 'seven');
      G.sfx('chalk');
      await G.wait(0.5);
      R.students.forEach((s) => {
        s.anim('idle', { track: true });
        s.track(true, true);
      });
      G.sfx('sting');
      G.cine(true);
      await G.lookAt(R.students[Math.floor(R.students.length / 2)].headPos, 0.35);
      await G.wait(1.2);
      G.cine(false);
      G.san(-20);
    } else G.san(-4);
  }

  async function roof3(G) {
    G.nf.roofLock = true;
    const i = await G.choice('紅線全斷了，三道鎖都開著。門虛掩著。', ['把門鎖好。', '推開門，看看頂樓。']);
    if (i === 0) {
      G.door('6F', 'roof', false);
      G.sfx('lock', A(G, '6F').anchors.roofDoor);
      await G.say('「好了。」', { who: 'self', pos: A(G, '6F').anchors.roofDoor.clone().setZ(25) });
      G.san(-4);
    } else {
      // 一排保全制服晾在衣架上，最後一件的名牌是空白的
      G.door('6F', 'roof', 1.6);
      G.sfx('door');
      G.cine(true);
      await G.lookAt(W(G, '6F', 0, 1.5, 29), 1.0);
      await G.fov(40, 0.8);
      await G.wait(1.0);
      await G.fov(null, 0.4);
      G.cine(false);
      G.san(-25);
    }
  }

  /* ================================================================ 06:00 */

  function dawn(G) {
    dawnLight(G, 0);
    if (G.night === 3) setLogbook(G, 'end');
    G.toast('06:00。天亮了。');
  }

  return {
    setupNight, startNight, update, onEnterArea, onSanZero,
    logbookLabel, onLogbook, onExit, onPunch, onPower,
    elevatorStop, panelExtra, stairsTarget, onLanding,
    get debug() { return R; },
  };
})();
