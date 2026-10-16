/*
 * 夜巡守則・七樓（3D）— 導演：樓梯間的 7F、第三夜 05:00 的七樓走廊、老陳
 * 共用狀態與工具在 base.js（window.NP3D_DIR）；對外介面在 index.js。
 */
(() => {
  'use strict';

  const N = window.NP3D_DIR;
  const { T, PI, once, A, W, fig, addExtra, stairY } = N;

  /* ================================================================ 樓梯與 7F */

  function stairsTarget(G, from, dir) {
    const n = G.night;
    const t = G.time;
    const nf = G.nf;
    if (from === '7F') return { blocked: '' };
    if (dir !== 'up') return null;
    if (n === 3 && from === '6F' && t >= T.DOOR7 && t < T.END && !nf.chenLost && !nf.rescued) {
      // 全作高潮之前記下重來點：在七樓失敗，可以從這裡再試
      G.checkpoint();
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
      N.logAct(G, 'stairs7', '3・9', '樓梯間的標示變成 7F。你繼續往上走。');
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
    return N.die(G, 'E_7F', () => endlessStairs(G));
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
    const crowd = N.stairCrowd(G, 6, ['adult', 'woman', 'guard']);
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
    return N.die(G, 'E_NAME', async () => {
      await G.say('「我在這裡。」', { who: 'self' });
      const crowd = N.stairCrowd(G, 7, ['adult', 'woman', 'adult', 'self']);
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
      await N.lunge(G, crowd[0], 0.8);
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
    N.logAct(G, 'stairs7', '3・9', looked ? '樓梯間的標示變成 7F。你轉身往下走，途中回頭了。' : '樓梯間的標示變成 7F。你轉身往下走，沒有回頭。');
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
      if (!lit) return N.die(G, 'E_7F', () => darkCorridor(G));
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
    if (fail === 'light') return N.die(G, 'E_LIGHT', () => noShadow(G));
    if (fail) return N.die(G, 'E_7F', () => darkCorridor(G));

    // 走廊盡頭：兩個老陳，都背對你在牆上寫字。真的那個有影子，牆上的字是正的
    const real = chen;
    const fake = A7.props.fakeChen;
    const both = N.R.fakeGone ? [real] : [real, fake];
    G.aux({ area: '7F', pos: [0, 0.55, 29.4], target: [0, 1.3, 31.9], intensity: 2.2, angle: 0.95, color: 0xffcf96 });
    nf.flashScale = 0.6;
    both.forEach((f) => {
      f.userData.setAnim('write', { track: false });
      f.userData.head.rotation.set(0, 0, 0);
    });
    const headOf = (f) => A7.w(f.position.x, 0.95, f.position.z - 0.3);
    G.cine(true);
    G.lock();
    await G.lookAt(A7.w(0, 1.2, 31.2), 1.0);
    if (both.length === 2) {
      await G.say('「是你嗎？」', { who: 'chen', pos: headOf(both[0]) });
      await G.say('「是你嗎？帶我回去。」', { who: 'chen', pos: headOf(both[1]) });
    } else {
      await G.say('「是你嗎？帶我回去。」', { who: 'chen', pos: headOf(real) });
    }
    G.cine(false);
    G.unlock();
    // 走上前，拍他的肩膀
    let chosen = null;
    const ids = both.map((f, i) => {
      const id = `tap-${i}`;
      G.addInteract({ id, area: '7F', pos: A7.w(f.position.x, 1.0, f.position.z - 0.2), reach: 1.7, angle: 0.55, label: '拍他的肩膀', when: () => !chosen, use: () => (chosen = f) });
      return id;
    });
    const picked = await G.waitUntil(() => !!chosen || G.pos.z < 22 || G.area !== '7F', 900);
    ids.forEach((id) => G.removeInteract(id));
    if (!picked || !chosen) {
      // 你沒有帶任何人走
      G.san(-10);
      nf.chenLost = true;
      await leave7(G);
      return;
    }
    const isReal = chosen === real;
    G.lock();
    const ch = headOf(chosen);
    await G.lookAt(ch, 0.6);
    chosen.userData.setAnim('idle', { track: false });
    await G.tween(1.4, (k) => (chosen.userData.head.rotation.y = k * PI * 0.75));
    await G.say('「你來了。」', { who: 'chen', pos: ch });
    await G.say('「你走前面，一直照著影子，不要回頭。我跟著你的影子走。」', { who: 'chen', pos: ch });
    await G.fade(1, 0.5);
    chosen.visible = false;
    G.teleport('7F', 0, 27.2, 0);
    G.setPitch(-0.45);
    nf.flashScale = 0.25;
    // 現在光在身後（盡頭的燈），影子往門口延伸
    G.aux({ area: '7F', pos: [-0.5, 2.0, 31.2], target: [0, 0, 16], intensity: 2.0, angle: 0.8, color: 0xffc27a });
    const invisible = (h) => h.obj.traverse((o) => {
      if (o.isMesh) o.material = G.world.M.invisible;
    });
    // 真的老陳有影子：地上會有兩個影子。帶錯了人，地上只有你自己的
    const chenShadow = isReal ? fig(G, 'chen', '7F', 0, 28.4, 0, { anim: 'walk' }) : null;
    if (chenShadow) invisible(chenShadow);
    let third = null;
    G.unlock();
    await G.fade(0, 0.6);
    let result = null;
    let lastZ = G.pos.z;
    let stepT = 0;
    await new Promise((resolve) => {
      const off = G.onFrame((dt) => {
        const z = G.pos.z;
        const sp = Math.abs(z - lastZ) / Math.max(dt, 0.001);
        lastZ = z;
        if (chenShadow) {
          chenShadow.setPos(G.pos.x - A7.ox, z + 1.3);
          chenShadow.anim('walk', { speed: Math.min(1.4, sp) });
        } else if (sp > 0.3) {
          // 身後一直有腳步聲，地上卻只有一個影子
          stepT += dt;
          if (stepT > 0.62) {
            stepT = 0;
            G.sfx('step', G.pos.clone().add(G.V3(0, 0.2, 1.3)), { mat: 'concrete' });
          }
        }
        if (third) {
          third.setPos(G.pos.x - A7.ox + 0.3, z + 2.7);
          third.anim('walk', { speed: Math.min(1.4, sp) });
        }
        if (isReal && !third && z < 15) {
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
    if (chenShadow) chenShadow.remove();
    if (third) third.remove();
    if (result === 'back' && !isReal) {
      // 你回頭了。跟在你身後的，名牌上的字是反的
      G.lock();
      G.cine(true);
      const p = G.pos;
      const it = fig(G, 'chen', '7F', p.x - A7.ox, p.z + 1.1, PI, { tag: '陳', mirrorTag: true, track: true });
      it.obj.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
      });
      it.face(p.x, p.z);
      G.sfx('sting');
      await G.lookAt(it.headPos, 0.35);
      await G.say('「你看到了。」', { who: 'chen', pos: it.headPos });
      await N.flicker(G, 2, 0.25);
      it.remove();
      fake.visible = false;
      N.R.fakeGone = true;
      G.cine(false);
      G.unlock();
      G.san(-15);
      // 它不見了。走廊盡頭，現在只剩一個人
      await leave7(G);
      return;
    }
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
    if (isReal) {
      nf.rescued = true;
      G.addFlag('rescued');
    } else {
      nf.fakeChen = true;
    }
    await leave7(G);
    N.R.compArea = null;
    companion(G);
    await G.lookAt(N.R.companion.headPos, 0.8);
    await G.say('「謝謝。」', { who: 'chen', pos: N.R.companion.headPos });
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
    if (N.R.compArea !== G.area || !N.R.companion) {
      if (N.R.companion) N.R.companion.remove();
      const isFake = !!G.nf.fakeChen;
      N.R.companion = fig(G, 'chen', G.area, G.pos.x - A(G, G.area).ox, G.pos.z + 1.5, 0, { tag: '陳', mirrorTag: isFake });
      if (isFake) N.R.companion.obj.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
      });
      N.R.compArea = G.area;
    }
    const c = N.R.companion;
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

  Object.assign(N, { stairsTarget, onLanding, up7, endlessStairs, answerName, down7, seventhDoor, corridor7, darkCorridor, noShadow, leave7, companion });
})();
