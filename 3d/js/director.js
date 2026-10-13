/*
 * 夜巡守則・七樓（3D）— 導演（每一夜的事件腳本）
 *
 * 文字版的每個「選項」，在這裡都變成身體的動作：
 *   不要回頭  → 監看視角方向
 *   不要動、不要按按鈕 → 監看移動與互動
 *   不要開門、不要接電話、不要回答 → 互動提示就在眼前，但守則叫你別按
 *   照著自己的影子 → 手電筒必須一直往下照
 */
window.NP3D_DIRECTOR = (() => {
  'use strict';

  const T = { START: 30, LOCK: 300, UNLOCK: 360, DOOR7: 420, END: 480 };
  const PI = Math.PI;
  let R = {}; // 這一夜的執行期資料
  let fired = new Set();

  const once = (key) => {
    if (fired.has(key)) return false;
    fired.add(key);
    return true;
  };

  /* ================================================================ 佈置 */

  function setupNight(G) {
    R = { figs: [], loops: [], offAt: null, gaze: 0, cctv: 'idle', companion: null, compArea: null };
    fired = new Set();
    const W = G.world;
    const A = W.areas;
    const n = G.night;
    const TEX = G.TEX;

    // 2F
    A['2F'].props.shutter.visible = n === 2;
    A['2F'].props.tv.material = A['2F'].props.tv.material.clone();
    A['2F'].props.tv.material.color.setHex(n === 1 ? 0xffffff : 0x000000);
    // B1
    A.B1.props.cars.forEach((c, i) => {
      c.cover.visible = !(n === 3 || (n === 2 && i === 1));
      c.lights.forEach((l) => (l.material = n === 2 && i === 1 ? W.M.lamp : W.M.plain));
    });
    A.B1.props.batteryBox.visible = n === 1;
    // 3F
    setBoard(G, n === 2 ? 'building' : n === 3 ? 'exam' : 'formula');
    // 5F
    A['5F'].props.redWalls.forEach((m) => (m.visible = n === 3));
    A['5F'].props.roster.visible = n !== 3;
    // 6F
    A['6F'].props.chains.visible = n !== 3;
    A['6F'].props.redThread.visible = n === 1;
    A['6F'].props.rooftop.visible = n === 3;
    A['6F'].props.uniforms.visible = n === 3;
    A['6F'].props.endless.visible = false;
    G.door('6F', 'roof', n === 3 ? 0.35 : false);
    // 4F
    A['4F'].props.crowd.visible = n === 1;
    A['4F'].props.smoke.visible = n === 1;
    A['4F'].props.guard.visible = n === 2;
    A['4F'].props.backs.visible = n === 3;
    G.areaMode('4F', n === 1 ? null : 'lit');
    // 7F
    A['7F'].props.stairText.visible = n >= 2;
    G.door('7F', 'stair7', false);
    const chen = A['7F'].props.chen;
    chen.visible = n !== 2;
    chen.userData.head.rotation.y = n === 3 ? PI : 0;
    chen.rotation.y = 0;
    if (R.chenStand) R.chenStand.remove();
    if (n === 2) {
      const f = G.figure('chen', '7F', 0, 22, PI);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: TEX.chenSign() }));
      sign.position.set(0, 1.25, 0.32);
      f.obj.add(sign);
      f.obj.userData.armL.rotation.x = -1.3;
      f.obj.userData.armR.rotation.x = -1.3;
      R.chenStand = f;
    }
    // 電梯面板
    for (const id of G.D.FLOORS) {
      const p = A[id].elevator && A[id].elevator.panelMesh;
      if (p) p.material.map = TEX.elevatorPanel(n === 3);
    }
    // 日誌
    setLogbook(G, 'start');
    // 天空
    A['1F'].props.sky.material = W.M.skyNight;
    A['1F'].props.breakfast.position.y = 0;

    registerNight(G);
  }

  function setBoard(G, kind) {
    const b = G.world.areas['3F'].props.board;
    b.material.map = G.TEX.whiteboard(kind);
    b.material.needsUpdate = true;
  }

  function setLogbook(G, phase) {
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
    const m = G.world.areas['1F'].props.logbook;
    m.material = new THREE.MeshLambertMaterial({ map: G.TEX.logbook(rows) });
  }

  function setRoster(G) {
    const m = G.world.areas['5F'].props.roster;
    m.material.map = G.TEX.roster(G.S.name, G.night);
    m.material.needsUpdate = true;
  }

  /* ================================================================ 互動 */

  function A(G, id) {
    return G.world.areas[id];
  }

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
      G.addInteract({ id: 'note6', area: '6F', pos: A(G, '6F').anchors.punch, reach: 1.6, label: '打卡鐘縫隙裡的紙條', when: () => G.S.cps.includes('6F') && !G.S.clues.includes('c1'), use: async () => {
        await G.note('c1');
        G.san(-2, { silent: true });
      } });
      G.addInteract({ id: 'roof', area: '6F', pos: A(G, '6F').anchors.roofDoor, reach: 1.8, label: '頂樓鐵門', when: () => !nf.roofLook, use: async () => {
        nf.roofLook = true;
        await G.think('（三道鎖，鍊條上纏著一圈紅線。門的另一邊，有人輕輕敲了兩下。）');
        G.sfx('knock', A(G, '6F').anchors.roofDoor);
      } });
      const child = G.figure('child', '3F', A(G, '3F').anchors.child.x - A(G, '3F').ox, A(G, '3F').anchors.child.z, PI / 2, { seated: true });
      R.child = child;
      R.figs.push(child);
    }

    // 第二夜
    if (n === 2) {
      G.addInteract({ id: 'board', area: '3F', pos: A(G, '3F').anchors.board, reach: 3.2, angle: 0.5, label: '白板', when: () => !nf.board, use: () => board2(G) });
      G.addInteract({ id: 'roster', area: '5F', pos: A(G, '5F').anchors.roster, reach: 1.8, label: '值班表', when: () => !nf.roster, use: () => roster(G) });
      const car = A(G, 'B1').props.cars[1];
      G.addInteract({ id: 'notebook', area: 'B1', pos: car.seat.clone().setY(1.0).setX(car.seat.x - 1.6), reach: 2.2, angle: 0.6, label: '車上的筆記本', when: () => !nf.car, use: () => carNote(G) });
      G.addInteract({ id: 'roof', area: '6F', pos: A(G, '6F').anchors.roofDoor, reach: 1.8, label: '頂樓鐵門', when: () => !nf.roofTalk, use: () => roof2(G) });
      const w = G.figure('woman', '2F', -0.9, 7.6, PI / 2, {});
      w.obj.scale.y = 0.6;
      R.woman = w;
      R.figs.push(w);
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
      R.bosses = B.props.cars.map((c) => {
        const f = G.figure('boss', 'B1', c.seat.x - B.ox, c.seat.z, -PI / 2, { seated: true, y: 0.15 });
        R.figs.push(f);
        return f;
      });
      const C = A(G, '3F');
      R.students = C.props.desks.map((d) => {
        const f = G.figure(Math.random() < 0.5 ? 'child' : 'adult', '3F', d.x - C.ox, d.z, -PI / 2, { seated: true });
        R.figs.push(f);
        return f;
      });
      const dbl = G.figure('guard', '2F', -4.4, 7.5, -PI / 2, { seated: true });
      R.double = dbl;
      R.figs.push(dbl);
    }

    // 電話（第二夜）
    G.addInteract({ id: 'phone', area: '1F', pos: A(G, '1F').anchors.phone, reach: 1.6, label: '接電話', when: () => !!R.ring, use: () => answerPhone(G) });
    // 保全室的門（03:00 之後）
    G.addInteract({ id: 'guardDoor', area: '1F', pos: A(G, '1F').w(-1.5, 1.1, 10.0), reach: 1.8, angle: 0.6, label: '門外的聲音', when: () => !!nf.lockedIn && G.time < T.UNLOCK, use: () => doorChoice(G) });
  }

  /* ================================================================ 每夜開頭 */

  async function startNight(G) {
    const touch = document.body.classList.contains('touch-mode');
    if (G.night === 1) {
      G.toast(touch ? '左下拖曳移動，右半邊拖曳看。按「互動」使用物品。' : 'WASD 移動・滑鼠看・E 互動・F 手電筒・H 守則');
      await G.wait(1.2);
      await G.think('（先在日誌上簽到。日誌在桌上。）');
    } else if (G.night === 2) {
      await G.think('（守則最後一頁的背面，多了兩行紅筆字。）');
    } else {
      await G.think('（第二頁看起來不太對。手機裡還有第一夜拍的照片。）');
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
    if (!S.signedIn) {
      G.sfx('page');
      if (n === 1) S.name = await G.nameInput();
      S.signedIn = true;
      S.time = T.START;
      setLogbook(G, 'in');
      setRoster(G);
      await G.think(n === 1 ? '（上一個簽名是老陳的，四天前。下班欄是空的。）' : n === 2 ? '（老陳的下班欄，還是空的。）' : '（今晚，整本日誌上只有你一個人的名字。）');
      if (n === 1) {
        G.toast(document.body.classList.contains('touch-mode') ? '按「守則」翻開守則' : '按 H 翻開守則');
        await G.think('（五個打卡點：B1、2F、3F、5F、6F。電梯在走廊盡頭，樓梯在對面。）');
      }
      return;
    }
    if (G.time < T.END) {
      G.toast('06:00 才能簽退。');
      return;
    }
    if (G.nf.signedOut) return;
    if (n < 3) {
      G.nf.signedOut = true;
      setLogbook(G, 'out');
      G.sfx('page');
      await G.think(n === 1 ? '（你在下班欄簽下名字。手有點抖，但簽得很清楚。）' : '（下班欄已經有淺淺的凹痕，像有人用沒水的筆先簽過一次。是你的名字。）');
      G.endNight();
      return;
    }
    await G.think('（下班欄已經有一個簽名了。是你的名字，你的字跡。墨水還沒乾。）');
    const i = await G.choice('要簽名嗎？', ['簽名。', '不簽。']);
    if (i === 0) {
      G.sfx('page');
      await G.fade(1, 1.2);
      G.ending('E_SIGN');
    }
    G.nf.signedOut = true;
    G.objective('推開大門離開，不要回頭');
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
    G.lock();
    G.sfx('door');
    G.dawn(1);
    await G.fade(1, 1.6);
    G.ending(G.nf.rescued ? 'E_TRUE' : 'E_DAWN');
  }

  function onPunch(G, id) {
    if (G.night === 1 && id === '6F') G.run(() => G.think('（打卡鐘的縫隙裡，夾著一張摺得很小的紙。）'));
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
    if (n === 1 && t >= 282 && once('warn3') && !(G.area === '1F' && G.inZone('guardRoom'))) G.run(() => G.think('（快三點了。守則第五條……）'));
    if (t >= T.LOCK && once('lock')) G.run(() => lockdown(G));
    if (t >= T.UNLOCK && once('unlock')) G.run(() => unlock(G));
    if (n === 2 && t >= 130 && t < 180 && !G.nf.phoneDone && once('ring')) startRing(G);
    if (n === 2 && t >= 180 && R.ring && once('ringEnd')) stopRing(G, true);
    if (n === 3 && t >= T.DOOR7 && once('door7')) G.run(() => G.think('（樓梯間的方向，傳來一聲很輕的開門聲。）'));
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
    if (n === 2 && G.area === 'B1' && once('engine')) {
      const car = A(G, 'B1').props.cars[1];
      R.engine = G.loop('engine', car.seat);
    }
    if (G.area === '6F' && G.dist(A(G, '6F').props.machine) < 9 && !R.machine) R.machine = G.loop('machine', A(G, '6F').props.machine);
    if (G.area === 'B1' && Math.random() < dt * 0.25) G.sfx('drip', A(G, 'B1').w(Math.random() * 16 - 8, 2.6, Math.random() * 24));

    // 4F 的煙、招手
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
    if (F4.props.guard.visible) F4.props.guard.userData.armR.rotation.x = -1.6 + Math.sin(G.time * 6) * 0.5;

    // 老陳跟著你
    if (G.nf.rescued) companion(G);
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
    await G.think('（燈全熄了。）');
    if (G.night === 1) await G.think('（你這時才想起第五條。）');
    return hunted(G);
  }

  async function lockIn(G, onTime) {
    const nf = G.nf;
    if (nf.lockedIn) return;
    nf.lockedIn = true;
    G.door('1F', 'guard', false);
    G.sfx('slam', A(G, '1F').w(-1.5, 1, 10));
    await G.wait(0.4);
    G.sfx('lock', A(G, '1F').w(-1.5, 1, 10));
    await G.think(onTime ? '（你鎖上了保全室的門。只剩監視器螢幕的光。）' : '（你衝進保全室，鎖上門。）');
    const lines = {
      1: ['{name}，開門。', '我忘了拿鑰匙，外面好冷。', '{name}？我知道你在裡面。'],
      2: ['開門，是我，老陳。', '我回來上班了。你讓我進去，我跟你交班。', '年輕人……開門啊。'],
      3: ['開門。', '是我。', '你開門啊。你在裡面幹嘛？那是我的位子。'],
    }[G.night];
    const who = { 1: 'boss', 2: 'chen', 3: 'self' }[G.night];
    const door = A(G, '1F').w(-1.2, 1.4, 10);
    await G.waitUntil(() => G.time >= 317, 120);
    let i = 0;
    while (G.time < T.UNLOCK - 4) {
      G.sfx('knock', door);
      await G.wait(1.2);
      if (G.time >= T.UNLOCK - 4) break;
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
    const door = A(G, '1F').w(-1.2, 1.4, 10);
    if (i === 0) {
      G.door('1F', 'guard', true);
      G.sfx('door', door);
      await G.wait(0.9);
      const f = G.figure('tall', '1F', -0.9, 10.1, -PI / 2);
      f.face(G.pos.x, G.pos.z);
      G.flash(1);
      G.sfx('scare');
      G.shake(0.05, 0.8);
      await G.wait(0.7);
      await G.fade(1, 0.2);
      G.ending('E_DOOR');
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

  /** 不在保全室：它會在黑暗裡找你。開著手電筒，它就知道你在哪裡。 */
  async function hunted(G) {
    const caught = { 1: -30, 2: -40, 3: -50 }[G.night];
    let areaId = null;
    let fig = null;
    let stepT = 2.5;
    let respawn = 0;
    let breath = null;
    const spawn = () => {
      areaId = G.area;
      const Ar = A(G, areaId);
      const sp = Ar.anchors.stalkerSpawn || Ar.w(0, 0, 20);
      fig = G.figure('tall', areaId, sp.x - Ar.ox, sp.z, PI);
      breath = G.loop('breath', fig.world);
    };
    const despawn = () => {
      if (fig) fig.remove();
      if (breath) breath.stop();
      fig = null;
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
          if (!fig || areaId !== G.area) {
            despawn();
            respawn += dt;
            if (respawn > 6) {
              respawn = 0;
              spawn();
            }
            return;
          }
          const fp = fig.world;
          const d = G.dist(fp);
          if (d < 5) G.san(-1.1 * dt, { silent: true });
          stepT -= dt;
          if (stepT <= 0) {
            stepT = 1.25;
            const Ar = A(G, areaId);
            let tx = G.pos.x;
            let tz = G.pos.z;
            const room = Ar.rooms.find((r) => G.inZone(r.zone));
            const hiding = room && !G.flashOn;
            if (hiding) {
              tx = room.door.x;
              tz = room.door.z;
            }
            const dx = tx - fp.x;
            const dz = tz - fp.z;
            const len = Math.hypot(dx, dz);
            const step = Math.min(len, G.flashOn ? 2.1 : hiding ? 1.0 : 1.1);
            if (len > 0.05) {
              fig.setPos(fp.x - Ar.ox + (dx / len) * step, fp.z + (dz / len) * step);
              fig.face(G.pos.x, G.pos.z);
            }
            G.sfx('heavyStep', fig.world);
            breath && breath.setPos(fig.world);
          }
          if (d < 1.35) {
            off();
            G.run(async () => {
              G.lock();
              fig.face(G.pos.x, G.pos.z);
              G.flash(1);
              G.sfx('scare');
              G.shake(0.06, 0.9);
              G.hurt(1);
              await G.wait(0.8);
              despawn();
              await G.fade(1, 0.4);
              G.san(caught);
              const g1 = A(G, '1F');
              G.teleport('1F', g1.anchors.spawn.x - g1.ox, g1.anchors.spawn.z, PI / 2);
              G.S.time = T.UNLOCK;
              G.unlock();
              await G.fade(0, 1.2);
              await G.think('（你在保全室的地上醒來。04:00 了。你不記得它的臉。）');
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
    const wind = G.loop('breath', D6.anchors.roofDoor);
    await G.think('（03:00。你照著第五條，來到 6F。頂樓的鐵門開著。）');
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
      await G.think('（身後的鐵門砰的一聲關上，三道鎖同時扣上。）');
      G.san(-40);
      return;
    }
    G.lock();
    G.flash(0.8);
    G.sfx('sting');
    await G.fade(1, 1.4);
    G.ending('E_ROOF');
  }

  async function unlock(G) {
    if (R.stalker) R.stalker.despawn();
    G.blackout(false);
    G.door('1F', 'guard', true);
    G.nf.lockedIn = false;
    if (G.area === '1F' && G.inZone('guardRoom')) {
      if (G.night === 1) await G.think('（敲門聲停了。門縫底下的影子，一直站到燈亮才縮回去。）');
      else if (G.night === 2) await G.think('（門外安靜了。你感覺得到，剛才有人背靠著門坐了一個小時。）');
      else await G.think('（燈亮了。門縫底下塞進來一張日誌的紙，下班欄簽著你的名字。）');
    } else {
      await G.think('（04:00。燈亮了。）');
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
    if (n === 3) mon.all13 = true;
    else mon.show13 = true;
    G.sfx('static');
    await G.think(n === 1 ? '（十二個畫面。你習慣性地數了一遍……十三。）' : n === 2 ? '（又是十三。這次第十三個畫面裡的人，正對著鏡頭。）' : '（你不用數了。每一個畫面，都是那條走廊。）');
    R.gaze = 0;
    R.powerResult = null;
    const bank = F1.w(-5.2, 1.65, 5.1);
    const target = n === 3 ? bank : F1.props.monitor13.getWorldPosition(new THREE.Vector3());
    while (true) {
      const r = await G.waitUntil(() => {
        if (R.powerResult) return true;
        if (mon.power && G.area === '1F' && G.inZone('guardRoom') && G.dist(target) < 3.2 && G.looking(target, n === 3 ? 16 : 9)) R.gaze += 1 / 60;
        else R.gaze = Math.max(0, R.gaze - 1 / 120);
        return R.gaze > 2.6;
      }, 400);
      if (!r) return;
      if (R.powerResult === 'ok') {
        mon.show13 = false;
        mon.all13 = false;
        await G.think(n === 3 ? '（十二個畫面回來了。每個畫面角落的時間，都停在 05:00。）' : '（十二個畫面。你又數了三遍。）');
        R.cctv = 'done';
        return;
      }
      if (R.powerResult === 'early') {
        R.powerResult = null;
        G.san(-5);
        await G.think('（還不到十分鐘。它還在。）');
        continue;
      }
      // 盯著看
      mon.glitch = 0.15;
      G.sfx('sting');
      const chen = A(G, '7F').props.chen;
      if (n === 1) {
        chen.userData.head.rotation.y = PI;
        await G.think('（走廊盡頭坐著一個穿保全制服的人，在牆上寫字。他慢慢轉過頭來——）');
        G.san(-15);
        G.addFlag('saw_chen');
      } else if (n === 2) {
        await G.think('（紙上寫著「五點」。他的嘴在動，沒有聲音。影、子。）');
        G.san(-15);
        await G.note('c3');
      } else {
        await G.think('（牆上寫的是守則。最下面一段字比較新。）');
        G.san(-12);
        await G.note('c4');
      }
      G.sfx('static');
      mon.glitch = 1;
      await G.wait(0.6);
      mon.glitch = 0;
      mon.show13 = false;
      mon.all13 = false;
      R.cctv = 'done';
      return;
    }
  }

  /* ================================================================ 電話（第二夜） */

  function startRing(G) {
    R.ring = G.loop('ring', A(G, '1F').anchors.phone);
    G.run(() => G.think('（保全室的電話在響。）'));
  }

  function stopRing(G, timeout) {
    if (R.ring) R.ring.stop();
    R.ring = null;
    G.nf.phoneDone = true;
    if (timeout) {
      G.run(async () => {
        G.sfx('sms');
        await G.wait(0.5);
        G.toast('林主任（21:52）：我今晚早睡，有事明天說。');
        await G.think('（電話響了三十三聲，停了。）');
      });
    }
  }

  async function answerPhone(G) {
    stopRing(G, false);
    G.sfx('click');
    const ph = A(G, '1F').anchors.phone;
    await G.say('「{name}嗎？我林主任。」', { who: 'boss', pos: ph });
    await G.think('（聲音很像，太像了。連清喉嚨的位置都一樣。）');
    await G.say('「頂樓的門沒鎖好，你現在上去，把門打開，再重新鎖一次。快點。」', { who: 'boss', pos: ph });
    const i = await G.choice('電話裡的林主任在等你回答。', ['「好，我馬上上去。」', '掛掉電話。', '「主任，你現在在哪裡？」']);
    if (i === 0) {
      G.lock();
      await G.fade(1, 1.6);
      G.ending('E_PHONE');
    }
    if (i === 1) {
      G.sfx('laugh', ph);
      await G.think('（話筒放下之前，你聽見裡面很多人一起笑的聲音。）');
      G.san(-12);
    } else {
      await G.say('「我在頂樓等你啊。」', { who: 'boss', pos: ph });
      G.san(-15);
    }
  }

  /* ================================================================ 電梯 4 樓 */

  function elevatorStop(G, from, to) {
    if (G.nf.elev4 || from === '4F') return null;
    G.nf.elev4 = true;
    return (g) => fourth(g);
  }

  async function fourth(G) {
    const n = G.night;
    const F4 = A(G, '4F');
    G.elevator('4F', true);
    await G.wait(0.6);
    const line4 = n === 1 ? '（樓層顯示：4。門外沒有燈，有一股很淡、很舊的燒香味。）' : n === 2 ? '（4。這次門外有燈。走廊盡頭，有個穿保全制服的人在對你招手。）' : '（4。站滿了人，全都背對著你。）';
    G.run(() => G.think(line4));
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
        const L = A(G, '1F');
        G.teleport('1F', 0, 16, PI);
        G.unlock();
        await G.fade(0, 1.2);
        await G.think('（你站在一樓大廳。你不記得自己是怎麼回來的。鞋底沾滿了香灰。）');
        return 'warped';
      }
      G.elevator('4F', false);
      G.lock();
      await G.wait(1.4);
      const crowd = n === 2 ? F4.props.guard : F4.props.backs;
      crowd.traverse((o) => {
        if (o.userData && o.userData.head) o.rotation.y += PI;
      });
      G.sfx('sting');
      await G.think('（門在你身後關上了。）');
      await G.fade(1, 1.5);
      G.ending('E_4F');
    }
    if (pressed) {
      G.sfx('click');
      if (n === 1) {
        G.shake(0.02, 0.6);
        await G.think('（門關上了。電梯晃了一下，像有人走了進來。）');
        G.san(-12);
      } else {
        await G.think('（你一直按，門就是不關。）');
        G.san(-18);
        await G.wait(2.0);
      }
    } else {
      await G.think(n === 3 ? '（門關上之前，最靠近你的那個人說：「明天見。」）' : '（你一動也不動。門自己慢慢關上了。）');
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
      g.shake(0.006, 5);
      await g.think('（按鈕陷了下去，沒有彈回來。電梯一直往上，久到不可能。）');
      await g.wait(2.5);
      g.san(-25);
      g.setBattery(0);
      const P1 = g.world.areas['1F'];
      const off = { x: g.pos.x - g.world.areas[g.area].ox, z: g.pos.z };
      g.teleport('1F', off.x, off.z);
      g.sfx('ding');
      g.elevator('1F', true);
      g.unlock();
      await g.think('（門開的時候，你在 1F。手電筒的電全沒了。）');
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
    G.setPitch(0.28);
    if (tgt.special === 'seventh') return seventhDoor(G);
    if (tgt.loop) {
      G.sfx('static');
      await G.think(G.nf.loops7 === 1 ? '（7F。又是 7F。）' : '（7F。）');
      return;
    }
    G.sfx('sting');
    if (n === 1) await G.think('（7F。你才走了一層。）');
    else if (n === 2) await G.think('（7F。標示下面有人用紅筆補了一行字。）');
    else {
      const above = A(G, '7F').w(6, 2.8, -3);
      await G.say('「{name}——」', { who: 'self', pos: above });
      R.callLoop = G.onFrame(() => {});
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
    const A7 = A(G, '7F');
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
      await G.think('（標示忽然變回了正常的樓層。你到了，腿痠得像走了一整夜。）');
      return;
    }
    G.lock();
    for (let i = 0; i < 3; i++) {
      await G.rail(A7.stairs.upPath, 1.0, '7F');
      await G.fade(1, 0.25);
      G.teleport('7F', A7.stairs.fromBelow[0][0], A7.stairs.fromBelow[0][2], null, A7.stairs.fromBelow[0][1]);
      G.fade(0, 0.25).catch(() => {});
      await G.rail(A7.stairs.fromBelow, 0.9, '7F');
      G.sfx('static');
    }
    await G.think('（7F。7F。7F。）');
    await G.fade(1, 1.4);
    G.ending('E_7F');
  }

  async function answerName(G) {
    G.lock();
    await G.say('「我在這裡。」', { who: 'self' });
    G.sfx('laugh', A(G, '7F').w(6, 2.8, -3));
    await G.wait(1.2);
    await G.say('「找到了。」', { who: 'many', pos: A(G, '7F').w(5, 2.4, -3) });
    G.flash(1);
    G.sfx('scare');
    await G.fade(1, 0.6);
    G.ending('E_NAME');
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
      await G.think('（你轉身下樓。門關上之前，你好像聽見有人嘆了一口氣。）');
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
        const f = G.figure(n === 2 ? 'adult' : 'tall', '7F', 3.6, -0.9, -PI / 2, n === 1 ? { seated: true } : {});
        R.figs.push(f);
        setTimeout(() => f.remove(), 900);
      }
    });
    const path = [[2.6, 0, -0.9], [4.1, -0.05, -0.9], [6.8, -1.65, -0.9]];
    path.face = true;
    await G.rail(path, 3.2, '7F');
    await G.fade(1, 0.6);
    await G.wait(1.4);
    off();
    const F1 = A(G, '1F');
    const arr = F1.stairs.fromAbove;
    G.teleport('1F', arr[0][0], arr[0][2], null, arr[0][1]);
    G.fade(0, 0.5).catch(() => {});
    await G.rail(arr, 1.2, '1F');
    G.unlock();
    if (looked) {
      const line = n === 1 ? '（你回頭了。樓梯上方，剛剛有人蹲了下去。）' : n === 2 ? '（你回頭了。樓梯上站滿了人，全都抬著頭看你。）' : '（你回頭了。那個聲音就貼在你耳邊。）';
      await G.think(line);
      G.san(n === 1 ? -18 : -20);
    } else {
      await G.think(n === 3 ? '（那個聲音一路叫著你的名字，跟到 2F，然後不見了。）' : '（你沒有回頭。走到 1F 的時候，聲音停了。）');
      G.san(-5);
    }
  }

  /* ---------------------------------------------------------------- 七樓（第三夜 05:00） */

  async function seventhDoor(G) {
    const A7 = A(G, '7F');
    G.door('7F', 'stair7', true);
    G.sfx('door', A7.anchors.door7);
    if (G.S.san < 20) {
      G.nf.shaky = true;
      await G.think('（你的手抖得快握不住手電筒。光圈在牆上一直晃，你不確定自己能不能一路照著影子，走到走廊盡頭。）');
    } else {
      await G.think('（7F。門開著。門後面，是第十三個畫面裡的那條走廊。）');
    }
    const entered = await G.waitUntil(() => G.area !== '7F' || G.pos.x < A7.ox + 1.3, 600);
    if (!entered || G.area !== '7F') return;
    await corridor7(G);
  }

  async function corridor7(G) {
    const A7 = A(G, '7F');
    const nf = G.nf;
    G.nf.on7 = null;
    A7.props.chen.userData.head.rotation.y = 0;
    if (!G.flashOn) {
      await G.think('（太暗了。你什麼都看不見。）');
      const lit = await G.waitUntil(() => G.flashOn, 3);
      if (!lit) {
        G.lock();
        await G.fade(1, 1.6);
        G.ending('E_7F');
      }
    }
    // 光從身後的門照進來，影子落在前方
    G.aux({ area: '7F', pos: [0.9, 2.3, -1.6], target: [0, 0, 12], intensity: 1.9, angle: 0.75, color: 0xffcf96 });
    G.shadow(true);
    nf.flashScale = 0.25;
    await G.think('（走廊很長。光從你身後照進來，你的影子落在前面。）');
    if (G.S.clues.includes('c4')) G.run(() => G.think('（一直照著自己的影子。不管誰叫你，都不要照過去。）'));
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
          warned = true;
          G.flash(0.35);
          G.voice('many', 1.2, behind());
          G.run(() => G.think('（照著影子。不要把光移開。）', 2.2));
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
    if (fail) {
      G.lock();
      if (fail === 'light') {
        G.flash(1);
        G.sfx('scare');
        await G.think('（你把光照了過去。光裡什麼都沒有。你低下頭，你的影子也不見了。）');
        await G.fade(1, 1);
        G.ending('E_LIGHT');
      }
      await G.fade(1, 1.4);
      G.ending('E_7F');
    }
    // 老陳
    G.lock();
    const chenPos = A7.anchors.chen;
    await G.say('「你是誰？」', { who: 'chen', pos: chenPos });
    const a = await G.choice('他沒有回頭。', ['「我是來交班的。」', '「老陳，我來帶你回去。」']);
    await G.say(a === 0 ? '「交班啊。好久沒聽到這兩個字了。」' : '「回去？回哪裡去？」', { who: 'chen', pos: chenPos });
    await G.say('「先回答我一個問題。它學什麼都學得很像，就是學不會這個。」', { who: 'chen', pos: chenPos });
    await G.say('「我姓陳。怎麼寫？」', { who: 'chen', pos: chenPos });
    const b = await G.choice('「我姓陳。怎麼寫？」', ['「耳東陳。」', '「耳車陣。」']);
    if (b === 1) {
      await G.say('「……你也是它。」', { who: 'chen', pos: chenPos });
      G.san(-30);
      nf.chenLost = true;
      await leave7(G, '（他轉回去，繼續在牆上寫字。你一個人走下樓。）');
      return;
    }
    await G.say('「好，我們走。」', { who: 'chen', pos: chenPos });
    await G.say('「你走前面，一直照著影子，不要回頭。我跟著你的影子走。」', { who: 'chen', pos: chenPos });
    await G.fade(1, 0.5);
    const chen = A7.props.chen;
    chen.visible = false;
    G.teleport('7F', 0, 27.2, 0);
    G.setPitch(-0.45);
    // 現在光在身後（老陳的燈），兩個影子往門口延伸
    G.aux({ area: '7F', pos: [-0.5, 2.0, 31.2], target: [0, 0, 16], intensity: 2.0, angle: 0.8, color: 0xffc27a });
    const chenShadow = G.figure('chen', '7F', 0, 28.4, 0);
    chenShadow.obj.traverse((o) => {
      if (o.isMesh) o.material = G.world.M.invisible;
    });
    let third = null;
    G.unlock();
    await G.fade(0, 0.6);
    G.run(() => G.think('（地上有兩個影子。）'));
    let result = null;
    await new Promise((resolve) => {
      const off = G.onFrame(() => {
        const z = G.pos.z;
        chenShadow.setPos(G.pos.x - A7.ox, z + 1.3);
        if (third) third.setPos(G.pos.x - A7.ox + 0.3, z + 2.7);
        if (!third && z < 15) {
          third = G.figure('tall', '7F', 0.3, z + 2.7, 0);
          third.obj.traverse((o) => {
            if (o.isMesh) o.material = G.world.M.invisible;
          });
          G.sfx('heavyStep', G.pos.clone().add(G.V3(0, 0.5, 2.7)));
          G.run(() => G.think('（……三個。）'));
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
      G.sfx('sting');
      await G.think('（你回頭。身後空無一人，只有一支紅筆在地上滾了兩圈。）');
      G.san(-30);
      nf.chenLost = true;
      await leave7(G, '（你一個人走下樓。）');
      return;
    }
    nf.rescued = true;
    G.addFlag('rescued');
    await leave7(G, null);
    await G.say('「謝謝。」', { who: 'chen' });
    await G.think('（老陳跟在你身後。06:00 就要到了。）');
  }

  async function leave7(G, line) {
    G.lock();
    await G.fade(1, 0.8);
    G.aux(null);
    G.shadow(false);
    G.nf.flashScale = 1;
    G.nf.shaky = false;
    G.door('7F', 'stair7', false);
    const F6 = A(G, '6F');
    const arr = F6.stairs.fromAbove;
    G.teleport('6F', arr[0][0], arr[0][2], null, arr[0][1]);
    G.fade(0, 0.6).catch(() => {});
    await G.rail(arr, 1.2, '6F');
    G.unlock();
    if (line) await G.think(line);
  }

  function companion(G) {
    if (R.compArea !== G.area) {
      if (R.companion) R.companion.remove();
      R.companion = G.figure('chen', G.area, G.pos.x - A(G, G.area).ox, G.pos.z + 1.5, 0);
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
    }
    c.face(G.pos.x, G.pos.z);
  }

  /* ================================================================ 第一夜的事件 */

  async function freeBattery(G) {
    G.nf.battery = true;
    await G.think('（繳費機上放著一盒全新的電池，還沒拆封。盒子上貼著便利貼：「給新來的。」）');
    const i = await G.choice('要怎麼處理這盒電池？', ['不理它。', '換上這些電池。', '收起來，帶回保全室。']);
    A(G, 'B1').props.batteryBox.visible = false;
    if (i === 1) {
      G.setBattery(100);
      G.setFlash(true);
      G.sfx('sting');
      const B = A(G, 'B1');
      B.props.cars.forEach((c) => {
        const f = G.figure('adult', 'B1', c.seat.x - B.ox, c.seat.z, -PI / 2, { seated: true, y: 0.15 });
        R.figs.push(f);
      });
      await G.think('（手電筒亮得刺眼。每一台車的防塵布底下，都坐著一個人。他們都朝著你。）');
      G.san(-15);
    } else if (i === 2) {
      await G.think('（你把電池放進口袋。口袋越來越重，越來越濕。掏出來一看，是一把濕掉的沙。）');
      G.san(-5);
    } else {
      await G.think('（你轉身離開。再回頭的時候，電池不見了。）');
    }
  }

  async function tv(G) {
    G.nf.tv = true;
    await G.think('（新聞畫面右上角的日期，是十年前。）');
    const i = await G.choice('電視開著，沒有聲音。', ['關掉電視。', '不理它。']);
    if (i === 0) {
      const m = A(G, '2F').props.tv.material;
      m.color.setHex(0x000000);
      const A2 = A(G, '2F');
      const ghosts = A2.props.waitChairs.slice(0, 6).map((c) => G.figure('adult', '2F', c.position.x, c.position.z, -PI / 2, { seated: true }));
      G.flash(0.5);
      G.sfx('static');
      await G.think('（黑掉的螢幕上，映出候診椅上坐滿的人。）');
      ghosts.forEach((g) => g.remove());
      G.san(-6);
    } else {
      G.voice('man', 1.2, A(G, '2F').anchors.tv);
      await G.think('（電視的聲音忽然打開了一下：「……福安大廈今晚……」）');
      G.san(-2);
    }
  }

  async function roster(G) {
    G.nf.roster = true;
    if (G.night === 1) {
      await G.think('（值班表的每一格都寫著「陳」。最後一格寫著你的名字。是你的字跡。）');
      const i = await G.choice('值班表', ['撕下值班表。', '不理它。']);
      if (i === 0) {
        G.sfx('page');
        await G.think('（你把值班表撕下來。後面還有一張，一模一樣。）');
        G.san(-8);
      } else G.san(-4);
    } else {
      await G.think('（今晚那一格寫著你的名字。下一格也是。再下一格寫著「交班」。）');
      const i = await G.choice('值班表', ['不理它。', '在「交班」旁邊寫下老陳的名字。']);
      if (i === 1) {
        G.addFlag('wrote_chen');
        await G.think('（你寫下「陳」。隔板另一邊傳來很輕的一聲嘆氣，像是鬆了一口氣。）');
        G.san(-6);
      } else G.san(-4);
    }
  }

  async function child(G) {
    const c = R.child;
    const pos = c.world.clone().setY(1.0);
    G.lock();
    await G.say('「管理員，」', { who: 'child', pos });
    await G.say('「我住在這裡。我找不到我媽媽。你可以帶我回家嗎？」', { who: 'child', pos });
    const i = await G.choice('一個小男孩坐在最後一排，背著書包，腳碰不到地。', ['「明天早上管理室有人。」然後離開。', '問他住在幾樓。', '牽著他的手，帶他去保全室。']);
    G.unlock();
    if (i === 0) {
      await G.think('（男孩沒有說話。身後傳來翻書的聲音，一頁，一頁，跟著你的腳步。）');
      G.san(-3);
    } else if (i === 1) {
      await G.say('「七樓。」', { who: 'child', pos });
      await G.say('「最上面那層。」', { who: 'child', pos });
      c.obj.userData.head.rotation.z = 0.6;
      G.san(-10);
    } else {
      c.obj.position.y = 0;
      await G.think('（他的手很冰，很小。）');
      await G.wait(2.5);
      G.flash(0.6);
      G.sfx('sting');
      c.remove();
      await G.think('（你低頭跟他說話。你牽著的，是一個空書包的背帶。書包裡裝滿了香灰。）');
      G.san(-20);
    }
  }

  /* ================================================================ 第二夜的事件 */

  async function woman(G) {
    const w = R.woman;
    const pos = w.world.clone().setY(0.9);
    G.lock();
    await G.say('「管理員，」', { who: 'woman', pos });
    await G.say('「我住樓上，我家的門打不開。你可以陪我上去嗎？七樓，很快。」', { who: 'woman', pos });
    const i = await G.choice('一個穿睡衣的阿姨蹲在鐵捲門前，光著腳。', ['「明天早上管理室有人。」然後離開。', '陪她上樓。', '問她叫什麼名字。']);
    G.unlock();
    if (i === 0) {
      w.obj.scale.y = 1.25;
      await G.think('（她慢慢站起來，站得比你高很多。）');
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
      await G.think('（你們走進樓梯間，她一直往上，一直往上。3、5、6、7、7、7……回過神來，你一個人站在 1F。）');
    } else {
      await G.say('「{name}。」', { who: 'woman', pos });
      await G.say('「跟你一樣。」', { who: 'woman', pos });
      G.san(-15);
    }
  }

  async function board2(G) {
    G.nf.board = true;
    await G.think('（白板上畫了一棟大樓，七層，每一層都有一個小人。第七層的小人穿著制服。）');
    const i = await G.choice('白板角落有一行很小的字。', ['湊近看。', '擦掉白板。']);
    if (i === 0) {
      await G.note('c5');
      G.san(-2);
    } else {
      setBoard(G, 'blank');
      G.sfx('chalk');
      await G.think('（你把大樓擦掉了。第七層的小人，怎麼擦都擦不掉。）');
      G.san(-8);
    }
  }

  async function carNote(G) {
    G.nf.car = true;
    await G.think('（車燈亮著，引擎在轉。駕駛座上沒有人，椅墊是溫的。）');
    const i = await G.choice('副駕駛座上放著一本筆記本。', ['翻開筆記本。', '把車子熄火。', '離開。']);
    if (i === 0) {
      await G.note('c2');
      G.san(-4);
    } else if (i === 1) {
      if (R.engine) R.engine.stop();
      R.engine = null;
      await G.think('（鑰匙孔裡沒有鑰匙，引擎聲卻停了。後座傳來很輕的一聲：「謝謝。」）');
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
    const pos = d.world.clone().setY(1.0);
    d.face(G.pos.x, G.pos.z);
    G.lock();
    await G.say('「我住在這裡。」', { who: 'self', pos });
    await G.say('「你可以讓我回家嗎？回你家。」', { who: 'self', pos });
    const i = await G.choice('候診室裡坐著一個人，穿著跟你一樣的制服。他長得跟你一模一樣。', ['「明天早上管理室有人。」然後離開。', '問他：「你叫什麼名字？」', '答應他。']);
    G.unlock();
    if (i === 0) {
      await G.say('「明天早上，管理室有人。」', { who: 'self', pos });
      G.san(-5);
    } else if (i === 1) {
      await G.say('「{name}。那你呢？」', { who: 'self', pos });
      await G.think('（你張開嘴，想了很久才想起來。）');
      G.san(-20);
    } else {
      d.remove();
      G.sfx('sting');
      await G.think('（他站起來，從你身邊走過去。你突然想不起來，自己家住在哪裡。）');
      G.san(-45);
    }
  }

  async function bosses(G) {
    R.bosses.forEach((b) => b.face(G.pos.x, G.pos.z));
    G.sfx('sting');
    const pos = R.bosses[1].world.clone().setY(1.1);
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
      setBoard(G, 'six');
      G.sfx('chalk');
      R.students.forEach((s) => s.remove());
      await G.think('（學生們同時放下筆，消失了。桌上只剩一張考卷，滿分。考生姓名：陳。）');
      G.san(5);
    } else if (i === 1) {
      setBoard(G, 'seven');
      G.sfx('chalk');
      R.students.forEach((s) => s.face(G.pos.x, G.pos.z));
      G.sfx('sting');
      await G.think('（所有學生同時轉過頭來。他們都沒有臉。）');
      G.san(-20);
    } else G.san(-4);
  }

  async function roof3(G) {
    G.nf.roofLock = true;
    const i = await G.choice('頂樓鐵門的紅線全斷了，三道鎖都開著。門虛掩著。', ['把門鎖好。', '推開門，看看頂樓。']);
    if (i === 0) {
      G.door('6F', 'roof', false);
      G.sfx('lock', A(G, '6F').anchors.roofDoor);
      await G.say('「好了。」', { who: 'self', pos: A(G, '6F').anchors.roofDoor.clone().setZ(25) });
      G.san(-4);
    } else {
      G.door('6F', 'roof', 1.6);
      G.sfx('door');
      await G.think('（頂樓什麼都沒有，只有一排保全制服晾在衣架上。每一件的名牌都寫著不同的名字。最後一件是空白的。）');
      G.san(-25);
    }
  }

  /* ================================================================ 06:00 */

  function dawn(G) {
    const F1 = A(G, '1F');
    F1.props.sky.material = G.world.M.skyDawn;
    F1.props.breakfast.position.y = 2.4;
    G.areaMode('1F', 'dawn');
    G.dawn(0.5);
    if (G.night === 3) setLogbook(G, 'end');
    G.run(() => G.think('（06:00。玻璃門外的天色開始變白了。）'));
  }

  return {
    setupNight, startNight, update, onEnterArea,
    logbookLabel, onLogbook, onExit, onPunch, onPower,
    elevatorStop, panelExtra, stairsTarget, onLanding,
  };
})();
