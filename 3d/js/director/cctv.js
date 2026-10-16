/*
 * 夜巡守則・七樓（3D）— 導演：保全室監視器：第十三個畫面
 * 共用狀態與工具在 base.js（window.NP3D_DIR）；對外介面在 index.js。
 */
(() => {
  'use strict';

  const N = window.NP3D_DIR;
  const { T, PI, once, A, W, fig, addExtra, stairY } = N;

  /* ================================================================ 監視器 */

  function onPower(G, on) {
    if (!on) N.R.offAt = G.time;
    else if (N.R.offAt != null) {
      const waited = G.time - N.R.offAt;
      N.R.offAt = null;
      N.R.powerResult = waited >= 10 ? 'ok' : 'early';
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
    N.R.gaze = 0;
    N.R.powerResult = null;
    N.R.stage13 = 0;
    // 離開保全室這件事，即使發生在演出途中也要記得
    N.R.left13 = false;
    N.R.offWatch13 = G.onFrame(() => {
      if (!inRoom()) N.R.left13 = true;
    });
    let ignored = 0;
    let ev = null;
    while (true) {
      ev = null;
      await G.waitUntil(() => {
        if (N.R.powerResult) return (ev = 'power');
        const here = inRoom();
        const lockTime = G.time >= T.LOCK && G.time < T.UNLOCK;
        if (!here) {
          N.R.gaze = Math.max(0, N.R.gaze - 1 / 120);
          return false;
        }
        // 不理它：離開再回來，或一直待在房間裡不處理，它就更近一步
        if (N.R.left13) {
          N.R.left13 = false;
          ignored = 0;
          if (mon.power && !lockTime) return (ev = 'ignored');
        }
        if (mon.power && !lockTime) ignored += 1 / 60;
        if (ignored > 45) {
          ignored = 0;
          return (ev = 'ignored');
        }
        if (mon.power && G.dist(target) < 3.2 && G.looking(target, n === 3 ? 16 : 9)) N.R.gaze += 1 / 60;
        else N.R.gaze = Math.max(0, N.R.gaze - 1 / 120);
        if (N.R.gaze > 2.6) return (ev = 'stare');
        return false;
      });
      if (ev === 'power') {
        if (N.R.powerResult === 'ok') {
          N.logAct(G, 'cctv', '6', '監視器多了第十三個畫面。你關掉螢幕，十分鐘後才打開。');
          return clear13(G);
        }
        N.R.powerResult = null;
        G.san(-5);
        mon.glitch = 0.35;
        G.sfx('static');
        await G.wait(0.4);
        mon.glitch = 0;
        continue;
      }
      if (ev === 'ignored') {
        N.R.stage13 += 1;
        N.logAct(G, 'cctv', '6', '監視器多了第十三個畫面。你沒有理它。');
        if (N.R.stage13 >= 3) return behindYou(G, target);
        await closer13(G, target);
        continue;
      }
      N.logAct(G, 'cctv', '6', '監視器多了第十三個畫面。你一直盯著它看。');
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
    if (N.R.watcher13) N.R.watcher13.remove();
    N.R.watcher13 = null;
    if (N.R.offWatch13) N.R.offWatch13();
    N.R.offWatch13 = null;
    N.R.cctv = 'done';
  }

  /** 不理第十三個畫面：畫面裡的東西，每次都離鏡頭更近一點 */
  async function closer13(G, target) {
    const mon = G.mon;
    if (!N.R.watcher13) N.R.watcher13 = fig(G, 'tall', '7F', 0.2, 17, PI, { anim: 'twitch' });
    const w = N.R.watcher13;
    if (N.R.stage13 === 1) {
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
    if (N.R.watcher13) N.R.watcher13.remove();
    N.R.watcher13 = null;
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

  Object.assign(N, { onPower, cctv, clear13, closer13, behindYou });
})();
