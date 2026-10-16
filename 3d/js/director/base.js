/*
 * 夜巡守則・七樓（3D）— 導演：共用：狀態、演出工具、日誌與值班表
 * 共用狀態與工具在 base.js（window.NP3D_DIR）；對外介面在 index.js。
 */
(() => {
  'use strict';

  // 這一夜的執行期資料（R）、觸發過的一次性事件、腳本生出的人物與道具，換夜時清掉
  const N = (window.NP3D_DIR = { R: {}, fired: new Set(), spawned: [], extras: [], lobbyAmbient: null, paper6: null });
  const T = { START: 30, LOCK: 300, UNLOCK: 360, DOOR7: 420, END: 480 };
  const PI = Math.PI;

  const once = (key) => {
    if (N.fired.has(key)) return false;
    N.fired.add(key);
    return true;
  };
  const A = (G, id) => G.world.areas[id];
  const W = (G, id, x, y, z) => A(G, id).w(x, y, z);
  const fig = (G, ...args) => {
    const h = G.figure(...args);
    N.spawned.push(h);
    return h;
  };
  const addExtra = (G, areaId, mesh) => {
    A(G, areaId).group.add(mesh);
    N.extras.push(mesh);
    return mesh;
  };


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

  /**
   * 巡邏紀錄：記下你在每條守則前「做了什麼」（不記結果），每夜結算時寫進值班日誌。
   * 同一個 key 只留最後一次。rule 是守則編號（字串，例如 '3・10'）。
   */
  function logAct(G, key, rule, text) {
    const list = G.nf.patrol || (G.nf.patrol = []);
    const i = list.findIndex((e) => e.key === key);
    const e = { key, rule, text };
    if (i >= 0) list[i] = e;
    else list.push(e);
  }

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

  Object.assign(N, { logAct, T, PI, once, A, W, fig, addExtra, setBoard, logRows, setLogbook, signIn, setRoster, die, flicker, lunge, stairY, stairCrowd });
})();
