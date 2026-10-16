/*
 * 夜巡守則・七樓（3D）— 導演：每一夜的佈置、互動登記、開場與大門、每一幀、理智歸零、06:00
 * 共用狀態與工具在 base.js（window.NP3D_DIR）；對外介面在 index.js。
 */
(() => {
  'use strict';

  const N = window.NP3D_DIR;
  const { T, PI, once, A, W, fig, addExtra, stairY } = N;

  /* ================================================================ 佈置 */

  function setupNight(G) {
    N.R = { offAt: null, gaze: 0, cctv: 'idle', companion: null, compArea: null };
    N.fired = new Set();
    N.spawned.forEach((h) => h.remove());
    N.spawned = [];
    N.extras.forEach((m) => m.parent && m.parent.remove(m));
    N.extras = [];
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
    N.setBoard(G, n === 2 ? 'building' : n === 3 ? 'exam' : 'formula');
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
    // 第三夜：走廊盡頭坐著兩個老陳，一真一假，左右隨機
    const fake = P7.fakeChen;
    const two = n === 3;
    N.R.realSide = Math.random() < 0.5 ? -1 : 1;
    chen.position.x = two ? N.R.realSide * 0.75 : 0.15;
    fake.visible = two;
    fake.position.x = -N.R.realSide * 0.75;
    fake.userData.setAnim('write', { track: false });
    fake.userData.head.rotation.set(0, two ? PI : 0, 0);
    fake.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    // 它的影子由鏡像替身投出來：兩個都有影子，但它的影子用另一隻手寫字
    const caster = P7.fakeCaster;
    caster.visible = two;
    caster.position.copy(fake.position);
    caster.userData.anim.phase = fake.userData.anim.phase;
    if (two) {
      chen.userData.setAnim('reach', { track: false });
      fake.userData.setAnim('reach', { track: false });
    }
    caster.userData.setAnim(two ? 'reach' : 'write', { track: false });
    P7.endWall.visible = true;
    Object.values(P7.endHalves).forEach((m) => (m.visible = false));
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
    N.setLogbook(G, 'start');
    // 大廳與天空
    const L = Ar['1F'];
    N.lobbyAmbient = N.lobbyAmbient || L.ambient;
    L.ambient = N.lobbyAmbient;
    L.props.sky.material = Wd.M.skyNight;
    L.props.breakfast.position.y = 0;

    registerNight(G);
  }


  /* ================================================================ 互動 */

  function registerNight(G) {
    const n = G.night;
    const nf = G.nf;

    // 7F 樓梯平台的上下樓
    const A7 = A(G, '7F');
    G.addInteract({ id: 'up7', area: '7F', pos: A7.anchors.stairsUp, reach: 1.9, angle: 0.65, label: () => (n === 2 ? '照第十條，繼續往上' : '繼續往上'), when: () => !!nf.on7 && !G.busy, use: () => N.up7(G) });
    G.addInteract({ id: 'down7', area: '7F', pos: A7.anchors.stairsDown, reach: 1.9, angle: 0.65, label: '轉身往下走', when: () => !!nf.on7 && !G.busy, use: () => N.down7(G) });
    G.addInteract({ id: 'answer7', area: '7F', pos: A7.w(5.5, 2.4, -3.0), reach: 4, angle: 0.5, label: '回答：「我在這裡。」', when: () => n === 3 && nf.on7 === 'anomaly', use: () => N.answerName(G) });

    // 第一夜
    if (n === 1) {
      G.addInteract({ id: 'freeBattery', area: 'B1', pos: A(G, 'B1').anchors.freeBattery, reach: 1.6, label: '一盒全新的電池', when: () => !nf.battery, use: () => N.freeBattery(G) });
      G.addInteract({ id: 'tv', area: '2F', pos: A(G, '2F').anchors.tv, reach: 3.2, angle: 0.4, label: '電視', when: () => !nf.tv, use: () => N.tv(G) });
      G.addInteract({ id: 'roster', area: '5F', pos: A(G, '5F').anchors.roster, reach: 1.8, label: '值班表', when: () => !nf.roster, use: () => N.roster(G) });
      G.addInteract({ id: 'roof', area: '6F', pos: A(G, '6F').anchors.roofDoor, reach: 1.8, label: '頂樓鐵門', when: () => !nf.roofLook, use: async () => {
        nf.roofLook = true;
        // 三道鎖、紅線；門的另一邊，有人輕輕敲了兩下
        await G.lookAt(W(G, '6F', 0, 1.15, 23.8), 0.7);
        await G.wait(0.9);
        G.sfx('knock', A(G, '6F').anchors.roofDoor);
        G.shake(0.006, 0.4);
      } });
      const C = A(G, '3F');
      N.R.child = fig(G, 'child', '3F', C.anchors.child.x - C.ox, C.anchors.child.z, PI / 2, { seated: true, anim: 'swing' });
    }

    // 第二夜
    if (n === 2) {
      G.addInteract({ id: 'board', area: '3F', pos: A(G, '3F').anchors.board, reach: 3.2, angle: 0.5, label: '白板', when: () => !nf.board, use: () => N.board2(G) });
      G.addInteract({ id: 'roster', area: '5F', pos: A(G, '5F').anchors.roster, reach: 1.8, label: '值班表', when: () => !nf.roster, use: () => N.roster(G) });
      const car = A(G, 'B1').props.cars[1];
      G.addInteract({ id: 'notebook', area: 'B1', pos: car.seat.clone().setY(1.0).setX(car.seat.x - 1.6), reach: 2.2, angle: 0.6, label: '車上的筆記本', when: () => !nf.car, use: () => N.carNote(G) });
      G.addInteract({ id: 'roof', area: '6F', pos: A(G, '6F').anchors.roofDoor, reach: 1.8, label: '頂樓鐵門', when: () => !nf.roofTalk, use: () => N.roof2(G) });
      N.R.woman = fig(G, 'woman', '2F', -0.85, 7.6, PI / 2, { crouch: true, anim: 'rock' });
    }

    // 第三夜
    if (n === 3) {
      G.addInteract({ id: 'board', area: '3F', pos: A(G, '3F').anchors.board, reach: 3.2, angle: 0.5, label: '黑板上的題目', when: () => !nf.board, use: () => N.board3(G) });
      G.addInteract({ id: 'redwall', area: '5F', pos: A(G, '5F').anchors.roster, reach: 2.0, label: '隔板上的紅字', when: () => !G.S.clues.includes('c4'), use: async () => {
        await G.note('c4');
        G.san(-4);
      } });
      G.addInteract({ id: 'roof', area: '6F', pos: A(G, '6F').anchors.roofDoor, reach: 1.8, label: '虛掩的頂樓鐵門', when: () => !nf.roofLock && G.time < T.LOCK, use: () => N.roof3(G) });
      const B = A(G, 'B1');
      N.R.bosses = B.props.cars.map((c) => fig(G, 'boss', 'B1', c.seat.x - B.ox, c.seat.z, -PI / 2, { seated: true, y: 0.15 }));
      const C = A(G, '3F');
      N.R.students = C.props.desks.map((d, i) => fig(G, i % 3 === 0 ? 'child' : 'adult', '3F', d.x - C.ox, d.z, PI / 2, { seated: true, variant: i, anim: 'write' }));
      N.R.double = fig(G, 'self', '2F', -4.4, 7.5, -PI / 2, { seated: true, tag: G.S.name || '　' });
    }

    // 打卡鐘裡夾著的紙條：老陳只用這個管道（打卡之後，紙條從縫隙露出來）
    N.papers = N.papers || {};
    Object.values(N.papers).forEach((m) => (m.visible = false));
    const notes = G.D.PUNCH_NOTES[n] || {};
    for (const [floor, clue] of Object.entries(notes)) {
      const Ar = A(G, floor);
      if (!N.papers[floor]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.1), new THREE.MeshBasicMaterial({ color: 0xe9e2cc, side: THREE.DoubleSide }));
        const pa = Ar.anchors.punch;
        m.position.set(pa.x - Ar.ox, pa.y + 0.12, pa.z);
        m.rotation.set(0, 0, 0.35);
        Ar.group.add(m);
        N.papers[floor] = m;
      }
      G.addInteract({ id: `note-${floor}`, area: floor, pos: Ar.anchors.punch, reach: 1.6, label: '打卡鐘縫隙裡的紙條', when: () => G.S.cps.includes(floor) && !G.S.clues.includes(clue), use: async () => {
        N.papers[floor].visible = false;
        await G.note(clue);
        G.san(-2, { silent: true });
      } });
    }

    // 電話（第二夜）
    G.addInteract({ id: 'phone', area: '1F', pos: A(G, '1F').anchors.phone, reach: 1.6, label: '接電話', when: () => !!N.R.ring, use: () => N.answerPhone(G) });
    // 保全室的門（03:00 之後）
    G.addInteract({ id: 'guardDoor', area: '1F', pos: W(G, '1F', -1.5, 1.1, 10.0), reach: 1.8, angle: 0.6, label: '門外的聲音', when: () => !!nf.lockedIn && G.time < T.UNLOCK, use: () => N.doorChoice(G) });
  }

  /* ================================================================ 每夜開頭、日誌、大門 */

  async function startNight(G) {
    const touch = document.body.classList.contains('touch-mode');
    if (G.nf.resumed) return;
    if (!G.S.signedIn) await N.signIn(G);
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
    if (!S.signedIn) return N.signIn(G);
    if (G.time < T.END) {
      G.toast('06:00 才能簽退。');
      return;
    }
    if (G.nf.signedOut) return;
    if (n < 3) {
      G.nf.signedOut = true;
      N.setLogbook(G, 'out');
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
      return N.die(G, 'E_SIGN', () => signScene(G));
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
    if (G.nf.fakeChen) return N.die(G, 'E_FAKE', () => fakeExit(G));
    const rescued = !!G.nf.rescued;
    return N.die(G, rescued ? 'E_TRUE' : 'E_DAWN', async () => {
      const L = A(G, '1F');
      G.sfx('door');
      dawnLight(G, 1);
      if (rescued && N.R.companion) {
        N.R.compFree = true;
        N.R.companion.walkTo(L.ox + 0.9, 29.5, 1.15);
      }
      await G.rail([[G.pos.x - L.ox, 0, G.pos.z], [0, 0, 23.4], [0, 0, 28.6]], 3.6, '1F');
      if (rescued) {
        const owner = fig(G, 'adult', '1F', -4.8, 31.5, 0, { variant: 4, track: true });
        owner.face(G.pos.x, G.pos.z);
        await G.lookAt(owner.headPos, 0.9);
        await G.say('「老陳，好久不見。照舊？」', { who: 'man', pos: owner.headPos });
        await G.lookAt(N.R.companion ? N.R.companion.headPos : W(G, '1F', 0.9, 1.6, 29.5), 0.8);
        await G.wait(0.6);
        await G.lookAt(W(G, '1F', 0, 9, 46), 2.2);
      } else {
        // 不要回頭——但結局已經寫完了：你終究回頭看了一眼
        await G.wait(0.6);
        await G.lookAt(W(G, '1F', 0, 1.6, 18), 1.8);
        const ghost = fig(G, 'chen', '1F', 0.4, 19.5, 0, { tag: '陳', track: true });
        ghost.face(G.pos.x, G.pos.z);
        await G.wait(1.4);
        await N.flicker(G, 2, 0.2);
        ghost.remove();
        await G.wait(0.8);
      }
    });
  }

  /** 帶錯了人：走進早晨，早餐店老闆問你「你一個人？」；回頭，他就在你身後，地上只有你的影子 */
  async function fakeExit(G) {
    const L = A(G, '1F');
    G.sfx('door');
    dawnLight(G, 1);
    const c = N.R.companion;
    N.R.compFree = true;
    if (c) c.walkTo(L.ox + 0.7, 28.0, 1.15);
    await G.rail([[G.pos.x - L.ox, 0, G.pos.z], [0, 0, 23.4], [0, 0, 28.6]], 3.6, '1F');
    const owner = fig(G, 'adult', '1F', -4.8, 31.5, 0, { variant: 4, track: true });
    owner.face(G.pos.x, G.pos.z);
    await G.lookAt(owner.headPos, 0.9);
    await G.say('「你一個人？」', { who: 'man', pos: owner.headPos });
    await G.wait(0.4);
    if (c) {
      c.setPos(G.pos.x - L.ox, G.pos.z - 0.9);
      c.face(G.pos.x, G.pos.z);
      c.track(true, true);
    }
    G.sfx('sting');
    await G.lookAt(c ? c.headPos : W(G, '1F', 0, 1.6, 27), 0.5);
    await G.wait(1.0);
    // 低頭：晨光從背後照過來，地上只有一個影子
    G.aux({ area: '1F', pos: [0.3, 6, 22], target: [0, 0, 31], intensity: 3.2, angle: 0.45, color: 0xffe2b8 });
    G.shadow(true);
    await G.lookAt(W(G, '1F', 0, 0, G.pos.z + 1.8), 1.0);
    await G.wait(1.2);
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
    const clue = (G.D.PUNCH_NOTES[G.night] || {})[id];
    const paper = N.papers && N.papers[id];
    if (clue && paper && !G.S.clues.includes(clue)) {
      paper.visible = true;
      G.run(async () => {
        await G.wait(0.3);
        await G.lookAt(paper.getWorldPosition(new THREE.Vector3()), 0.6);
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
    if (t >= T.LOCK && once('lock') && t < T.UNLOCK - 2) G.run(() => N.lockdown(G));
    if (t >= T.UNLOCK && once('unlock')) G.run(() => N.unlock(G));
    if (n === 2 && t >= 130 && t < 180 && !G.nf.phoneDone && once('ring')) N.startRing(G);
    if (n === 2 && t >= 180 && N.R.ring && once('ringEnd')) N.stopRing(G, true);
    if (n === 3 && t >= T.DOOR7 && once('door7')) G.sfx('door', W(G, G.area, 4.5, 2.5, -3.0));
    if (t >= T.END && once('dawn')) dawn(G);

    // 監視器
    if (N.R.cctv === 'idle' && t >= 55 && (t < T.LOCK || t >= T.UNLOCK) && G.area === '1F' && G.inZone('guardRoom')) {
      N.R.cctv = 'active';
      G.run(() => N.cctv(G));
    }

    // 人物觸發
    if (n === 1 && N.R.child && G.area === '3F' && G.inZone('classroom') && G.dist(N.R.child.world) < 3.4 && once('child')) G.run(() => N.child(G));
    if (n === 2 && N.R.woman && G.area === '2F' && G.dist(N.R.woman.world) < 3.6 && once('woman')) G.run(() => N.woman(G));
    if (n === 2 && G.area === '6F' && G.dist(A(G, '6F').anchors.roofDoor) < 5 && once('scratch')) G.run(() => N.scratch(G));
    if (n === 3 && N.R.double && G.area === '2F' && G.inZone('waiting') && G.dist(N.R.double.world) < 3.6 && once('double')) G.run(() => N.double(G));
    if (n === 3 && N.R.bosses && G.area === 'B1' && N.R.bosses.some((b) => G.dist(b.world) < 7) && once('bosses')) G.run(() => N.bosses(G));
    if (n === 2 && G.area === 'B1' && once('engine')) N.R.engine = G.loop('engine', A(G, 'B1').props.cars[1].seat);
    if (G.area === '6F' && G.dist(A(G, '6F').props.machine) < 9 && !N.R.machine) N.R.machine = G.loop('machine', A(G, '6F').props.machine);
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
    if ((G.nf.rescued || G.nf.fakeChen) && !N.R.compFree) N.companion(G);

    // 看不見的導演：03:00 以外，讓玩家一直覺得它在附近
    N.ambient(G, dt);
  }

  function onEnterArea(G, id) {
    if (N.R.machine && id !== '6F') {
      N.R.machine.stop();
      N.R.machine = null;
    }
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


  /* ================================================================ 06:00 */

  function dawn(G) {
    dawnLight(G, 0);
    if (G.night === 3) N.setLogbook(G, 'end');
    G.toast('06:00。天亮了。');
  }

  /**
   * 結算畫面的巡邏紀錄：只寫你做了什麼。第二夜起，紀錄裡會混進一行你沒做過的事（紅筆）。
   * 玩家要自己判斷：哪幾條守則被你驗證過、哪一行是被人補上去的。
   */
  function patrolLog(G) {
    const src = G.nf.patrol || [];
    const list = src.map((e) => ({ rule: e.rule, text: e.text }));
    if (G.night >= 2) {
      const has = (k) => src.find((e) => e.key === k);
      const cands = [];
      const ph = has('phone');
      if (!ph || /沒有接/.test(ph.text)) cands.push({ rule: '電話', text: '保全室的電話響了。你接起來，照林主任說的上了頂樓。' });
      const st = has('stairs7');
      if (st && /往下走/.test(st.text)) cands.push({ rule: '3・9', text: '樓梯間的標示變成 7F。你照著紅筆字，繼續往上走了。' });
      const th = has('three');
      if (th && /鎖上了門/.test(th.text)) cands.push({ rule: '5', text: '03:00 有人敲門，說他是老陳。你開了門，跟他交了班。' });
      if (!cands.length) cands.push({ rule: '1', text: '下班之前，你在日誌的下班欄先簽了一次名。' });
      const f = cands[Math.floor(Math.random() * cands.length)];
      list.splice(Math.floor(Math.random() * (list.length + 1)), 0, { ...f, forged: true });
    }
    return list;
  }

  /** 從第三夜 05:00 重來：世界照第三夜重新佈置，再補上簽到後的狀態 */
  function onResume(G) {
    N.setLogbook(G, 'in');
    N.setRoster(G);
    N.R.cctv = 'done';
  }

  Object.assign(N, { patrolLog, onResume, setupNight, registerNight, startNight, logbookLabel, onLogbook, signScene, onExit, dawnLight, onPunch, update, onEnterArea, onSanZero, dawn });
})();
