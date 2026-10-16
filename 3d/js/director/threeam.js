/*
 * 夜巡守則・七樓（3D）— 導演：03:00–04:00：停電、鎖門、門外的聲音、它在黑暗裡找你、第五條
 * 共用狀態與工具在 base.js（window.NP3D_DIR）；對外介面在 index.js。
 */
(() => {
  'use strict';

  const N = window.NP3D_DIR;
  const { T, PI, once, A, W, fig, addExtra, stairY } = N;

  /* ================================================================ 03:00 */

  async function lockdown(G) {
    G.blackout(true);
    G.sfx('static');
    G.standUp();
    if (G.area === '1F' && G.inZone('guardRoom')) {
      N.logAct(G, 'three', '5', '03:00 停電的時候，你在保全室，鎖上了門。');
      return lockIn(G, true);
    }
    N.logAct(G, 'three', '5', G.area === '6F' ? '03:00 停電的時候，你在 6F 的頂樓鐵門前。' : `03:00 停電的時候，你在 ${G.area}，不在保全室。`);
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
    if (i === 1 && opts.length === 3) N.logAct(G, 'door3', '5', '門外的聲音一直在。你隔著門問了它一個問題。');
    const door = W(G, '1F', -1.2, 1.4, 10);
    if (i === 0) {
      return N.die(G, 'E_DOOR', async () => {
        G.nf.doorOpen = true;
        G.door('1F', 'guard', true);
        G.sfx('door', door);
        // 門外的東西，和那個聲音一點都不像
        const f = fig(G, 'tall', '1F', -1.05, 10.6, -PI / 2, { anim: 'twitch', track: true });
        f.face(G.pos.x, G.pos.z);
        await G.lookAt(f.headPos, 0.8);
        await G.wait(1.0);
        await N.flicker(G, 2, 0.18);
        const p = G.pos;
        const L = A(G, '1F');
        const fw = G.forward().setY(0).normalize();
        f.setPos(p.x - L.ox + fw.x * 1.6, p.z + fw.z * 1.6);
        f.face(p.x, p.z);
        await N.flicker(G, 1, 0.3);
        await N.lunge(G, f);
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

  /* ---------------------------------------------------------------- 它的路線 */

  // 每層樓都是一條筆直的走廊（凸形，可以直線移動），房間、大廳、停車場、頂樓各只有一個出入口。
  // 它不穿牆：要進出這些區域，先走到出入口外（out），再走到出入口內（in）。座標是區域內的本地座標。
  const COMMON_PORTALS = {
    landing: { in: [2.1, -1.5], out: [0.9, -1.5] },
    cab: { in: [-2.1, -1.5], out: [-0.9, -1.5] },
  };
  const PORTALS = {
    B1: { parking: { in: [0, 0.6], out: [0, -0.6] } },
    '1F': { lobby: { in: [0, 12.6], out: [0, 11.4] }, guardRoom: { in: [-2.1, 10.0], out: [-0.9, 10.0] } },
    '2F': { waiting: { in: [-2.1, 7.2], out: [-0.9, 7.2] }, treat: { in: [2.1, 10.6], out: [0.9, 10.6] } },
    '3F': { classroom: { in: [2.1, 4.2], out: [0.9, 4.2] }, office: { in: [-2.1, 14.6], out: [-0.9, 14.6] } },
    '5F': { office: { in: [0, 3.6], out: [0, 2.4] } },
    '6F': { machine: { in: [2.1, 6.6], out: [0.9, 6.6] }, storage: { in: [-2.1, 13.6], out: [-0.9, 13.6] }, rooftop: { in: [0, 24.7], out: [0, 23.3] } },
  };

  function portalsOf(areaId) {
    return { ...COMMON_PORTALS, ...(PORTALS[areaId] || {}) };
  }

  /** 這個位置在哪一區；不在任何房間裡就算走廊 */
  function regionOf(G, areaId, p) {
    for (const name of Object.keys(portalsOf(areaId))) if (G.inZone(name, p)) return name;
    return 'corridor';
  }

  /** 從 from 往 to 走，下一個要去的點（世界座標） */
  function nextWaypoint(G, areaId, from, to) {
    const Ar = A(G, areaId);
    const portals = portalsOf(areaId);
    const rf = regionOf(G, areaId, from);
    const rt = regionOf(G, areaId, to);
    if (rf === rt) return to;
    const at = (xz) => G.V3(xz[0] + Ar.ox, 0, xz[1]);
    const near = (pt) => Math.hypot(pt.x - from.x, pt.z - from.z) < 0.35;
    if (rf !== 'corridor') {
      // 先離開自己所在的房間
      const pIn = at(portals[rf].in);
      return near(pIn) ? at(portals[rf].out) : pIn;
    }
    // 在走廊上：走到對方房間的門口，再進去
    const pOut = at(portals[rt].out);
    return near(pOut) ? at(portals[rt].in) : pOut;
  }

  /**
   * 不在保全室：它會在黑暗裡找你。
   * 開著手電筒或在跑，它就聽得見、看得見你，大步追上來（約每秒 2.6 公尺，比走路快、比跑步慢）；
   * 關燈慢慢走，它只能慢慢摸過來（約每秒 1.3 公尺）。躲進房間、關燈、不要跑，它只會停在門口。
   * 它沿著走廊與門口走，不穿牆；你沒在看它、而且離得夠遠時，它偶爾會一下子「跳」到更近的地方。
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
    N.R.stalker = { despawn };
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
              // 躲好了：它只走到門外，停在那裡
              const out = portalsOf(areaId)[room.zone].out;
              tx = out[0] + Ar.ox;
              tz = out[1];
            }
            const goal = G.V3(tx, 0, tz);
            let wp = nextWaypoint(G, areaId, fp, goal);
            const unseen = !G.looking(f.headPos, 40) && d > 7;
            let stepLen = exposed ? 1.8 : 0.9;
            // 你沒在看它的時候，它偶爾一口氣走到下一個路線點（但不會直接貼到你身上）
            const jump = unseen && Math.random() < 0.3;
            if (jump) stepLen = Math.min(4.5, d - 3.5);
            let dx = wp.x - fp.x;
            let dz = wp.z - fp.z;
            let len = Math.hypot(dx, dz);
            if (jump && len < stepLen && wp !== goal) {
              // 已經到了這個路線點，再往下一個走
              const wp2 = nextWaypoint(G, areaId, wp, goal);
              const rest = stepLen - len;
              const ex = wp2.x - wp.x;
              const ez = wp2.z - wp.z;
              const el = Math.hypot(ex, ez) || 1;
              wp = G.V3(wp.x + (ex / el) * Math.min(rest, el), 0, wp.z + (ez / el) * Math.min(rest, el));
              dx = wp.x - fp.x;
              dz = wp.z - fp.z;
              len = Math.hypot(dx, dz);
            }
            const step = Math.min(len, stepLen);
            if (len > 0.05 && step > 0) {
              f.setPos(fp.x - Ar.ox + (dx / len) * step, fp.z + (dz / len) * step);
              f.face(G.pos.x, G.pos.z);
            }
            // 跳過去的時候沒有腳步聲
            if (!jump) G.sfx('heavyStep', f.world);
            if (breath) breath.setPos(f.world);
          }
          if (d < 1.35) {
            off();
            const caughtBy = f;
            G.run(async () => {
              G.cine(true);
              G.lock();
              await N.lunge(G, caughtBy);
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
    return N.die(G, 'E_ROOF', async () => {
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
    if (N.R.stalker) N.R.stalker.despawn();
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

  Object.assign(N, { lockdown, lockIn, doorChoice, hunted, roofAt3, unlock });
})();
