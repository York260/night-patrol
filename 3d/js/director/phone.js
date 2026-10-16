/*
 * 夜巡守則・七樓（3D）— 導演：第二夜的電話、電梯停在 4 樓、第三夜亮著的 7
 * 共用狀態與工具在 base.js（window.NP3D_DIR）；對外介面在 index.js。
 */
(() => {
  'use strict';

  const N = window.NP3D_DIR;
  const { T, PI, once, A, W, fig, addExtra, stairY } = N;

  /* ================================================================ 電話（第二夜） */

  function startRing(G) {
    N.R.ring = G.loop('ring', A(G, '1F').anchors.phone);
    const h = A(G, '1F').props.handset;
    const y0 = h.position.y;
    N.R.ringShake = G.onFrame(() => {
      h.position.y = N.R.ring && Math.random() < 0.5 ? y0 + 0.006 : y0;
    });
    if (G.area !== '1F') G.toast('樓下的電話在響。');
  }

  function stopRing(G, timeout) {
    if (N.R.ring) N.R.ring.stop();
    N.R.ring = null;
    if (N.R.ringShake) N.R.ringShake();
    N.R.ringShake = null;
    G.nf.phoneDone = true;
    if (timeout) {
      N.logAct(G, 'phone', '9', '保全室的電話響了三十三聲。你沒有接。');
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
    N.logAct(G, 'phone', '9', i === 1 ? '保全室的電話響了。你接起來，又掛掉了。' : '保全室的電話響了。你接了，問林主任在哪裡。');
    if (i === 0) return N.die(G, 'E_PHONE', () => phoneScene(G));
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
    N.logAct(G, 'elev4', '2', got && exited() ? '電梯在 4 樓停下來。你走了出去。' : pressed ? '電梯在 4 樓停下來。你按了關門鍵。' : '電梯在 4 樓停下來。你一動也不動，等門自己關上。');
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
      return N.die(G, 'E_4F', async () => {
        G.elevator('4F', false);
        await G.lookAt(F4.w(-1.6, 1.5, -1.5), 0.9);
        await G.wait(1.2);
        await G.lookAt(F4.w(0, 1.5, 4), 0.9);
        G.sfx('sting');
        if (n === 2) {
          const g = F4.props.guard;
          g.userData.setAnim('idle', { track: true, snap: true });
          for (let k = 0; k < 3; k++) {
            await N.flicker(G, 1, 0.35);
            g.position.z -= 4.6;
          }
        } else {
          const backs = F4.props.backs.children;
          backs.forEach((f) => {
            f.rotation.y += PI;
            f.userData.setAnim('idle', { track: true });
          });
          for (let k = 0; k < 3; k++) {
            await N.flicker(G, 1, 0.35);
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

  Object.assign(N, { startRing, stopRing, answerPhone, phoneScene, elevatorStop, fourth, panelExtra });
})();
