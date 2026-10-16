/*
 * 夜巡守則・七樓（3D）— 導演：看不見的導演
 *
 * 03:00 以外的時間也要讓玩家覺得「它在附近」：遠處的關門聲、身後的腳步、走廊盡頭站著的人、
 * 燈閃一下、房間裡的低語、電梯自己叮一聲。都不會死，只扣一點理智。
 * 理智越低、夜越深，出現得越頻繁。演出、選擇、03:00–04:00、保全室裡、七樓、天亮之後都不出現。
 */
(() => {
  'use strict';

  const N = window.NP3D_DIR;
  const { T, PI, A, W, fig } = N;

  const rand = (a, b) => a + Math.random() * (b - a);

  /** 走廊中線上，玩家身後 dist 公尺的點（夾在走廊範圍內） */
  function behindOnCorridor(G, dist) {
    const Ar = A(G, G.area);
    const fw = G.forward().setY(0).normalize();
    const z = Math.max(1.5, Math.min(21.5, G.pos.z - fw.z * dist));
    return Ar.w(0, 0, z);
  }

  const EVENTS = [
    {
      id: 'steps',
      weight: 3,
      when: () => true,
      async run(G) {
        // 身後的腳步聲；一回頭就停
        const fw = G.forward().setY(0).normalize();
        const bx = -fw.x;
        const bz = -fw.z;
        for (let i = 0; i < 4; i++) {
          if (i > 0 && G.yawOff(bx, bz) < 0.9) break;
          G.sfx('step', G.pos.clone().add(G.V3(bx * 3.2, 0.2, bz * 3.2)), { mat: 'concrete', gain: 1.3 });
          await G.wait(0.55);
        }
        G.san(-1, { silent: true });
      },
    },
    {
      id: 'slam',
      weight: 2,
      when: (G) => G.area !== 'B1',
      async run(G) {
        // 走廊另一頭的門，砰的一聲
        const p = W(G, G.area, 0, 1.2, G.pos.z > 11 ? 1.0 : 21.5);
        G.sfx('slam', p);
        G.shake(0.006, 0.3);
        G.san(-1, { silent: true });
      },
    },
    {
      id: 'lights',
      weight: 2,
      when: (G) => G.lightsOn(),
      async run(G) {
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
          G.blackout(true);
          await G.wait(rand(0.08, 0.25));
          G.blackout(false);
          await G.wait(rand(0.1, 0.4));
        }
        G.san(-2, { silent: true });
      },
    },
    {
      id: 'figure',
      weight: 3,
      when: (G) => G.area !== '6F' || G.pos.z < 18,
      async run(G) {
        // 走廊盡頭站著一個人。你看它，它就不見了
        const n = G.night;
        const kind = n === 3 ? 'self' : ['adult', 'woman', 'child'][Math.floor(Math.random() * 3)];
        const p = behindOnCorridor(G, rand(9, 13));
        const Ar = A(G, G.area);
        const f = fig(G, kind, G.area, p.x - Ar.ox, p.z, 0, { variant: Math.floor(Math.random() * 6), track: true, tag: kind === 'self' ? G.S.name : undefined });
        f.face(G.pos.x, G.pos.z);
        let seen = 0;
        let life = 0;
        await G.waitUntil(() => {
          life += 1 / 60;
          if (G.looking(f.headPos, 14)) seen += 1 / 60;
          return seen > 0.45 || life > 7 || G.dist(f.world) < 6 || G.area !== Ar.id;
        }, 12);
        if (seen > 0.45) {
          G.flash(0.18);
          G.sfx('static', f.world);
          G.san(-3, { silent: true });
        }
        f.remove();
      },
    },
    {
      id: 'whisper',
      weight: 2,
      when: (G) => A(G, G.area).rooms.length > 0,
      async run(G) {
        const rooms = A(G, G.area).rooms;
        const r = rooms[Math.floor(Math.random() * rooms.length)];
        const p = r.door.clone().setY(1.4);
        G.voice(G.night === 3 ? 'self' : 'many', 1.6, p);
        G.san(-1, { silent: true });
      },
    },
    {
      id: 'ding',
      weight: 1,
      when: (G) => !!A(G, G.area).elevator && !G.inZone('cab') && G.dist(W(G, G.area, -1.5, 0, -1.5)) > 7,
      async run(G) {
        G.sfx('ding', W(G, G.area, -1.6, 1.4, -1.5));
        G.san(-1, { silent: true });
      },
    },
    {
      id: 'knock',
      weight: 2,
      when: () => true,
      async run(G) {
        // 牆的另一邊，有人敲了兩下
        const side = Math.random() < 0.5 ? -1.55 : 1.55;
        const p = W(G, G.area, side, 1.3, G.pos.z + rand(-1, 1));
        G.sfx('knock', p);
        G.san(-1, { silent: true });
      },
    },
  ];

  function quiet(G) {
    const t = G.time;
    return (
      !G.S.signedIn || G.busy || G.P.cine || G.P.moveLock > 0 || G.P.rail
      || (t >= T.LOCK - 2 && t < T.UNLOCK) || t >= T.END
      || G.area === '7F' || G.area === '4F'
      || (G.area === '1F' && G.inZone('guardRoom'))
      || !!N.R.ring || G.nf.lockedIn || G.nf.on7 || G.nf.rescued || G.nf.fakeChen
    );
  }

  function nextDelay(G) {
    let d = rand(55, 85);
    const san = G.S.san;
    if (san < 45) d *= 0.65;
    if (san < 25) d *= 0.7;
    if (G.time >= T.UNLOCK) d *= 0.6; // 後半夜比較不安靜
    if (G.night === 1) d *= 1.25;
    if (G.night === 3) d *= 0.85;
    return Math.max(20, d);
  }

  /** 每一幀由 flow.update 呼叫 */
  function ambient(G, dt) {
    const R = N.R;
    if (!R.amb) R.amb = { t: rand(40, 60), last: null, running: false };
    const a = R.amb;
    if (a.running || quiet(G)) return;
    a.t -= dt;
    if (a.t > 0) return;
    const pool = EVENTS.filter((e) => e.id !== a.last && e.when(G));
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    const ev = pool.find((e) => (r -= e.weight) < 0) || pool[0];
    a.t = nextDelay(G);
    if (!ev) return;
    a.last = ev.id;
    a.running = true;
    G.run(async () => {
      try {
        await ev.run(G);
      } finally {
        a.running = false;
      }
    });
  }

  Object.assign(N, { ambient, AMBIENT_EVENTS: EVENTS });
})();
