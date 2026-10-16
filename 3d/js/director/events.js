/*
 * 夜巡守則・七樓（3D）— 導演：三夜的住戶與物件事件
 * 共用狀態與工具在 base.js（window.NP3D_DIR）；對外介面在 index.js。
 */
(() => {
  'use strict';

  const N = window.NP3D_DIR;
  const { T, PI, once, A, W, fig, addExtra, stairY } = N;

  /* ================================================================ 第一夜的事件 */

  async function freeBattery(G) {
    G.nf.battery = true;
    const i = await G.choice('繳費機上，一盒全新的電池。便利貼：「給新來的。」', ['不理它。', '換上這些電池。', '收起來，帶回保全室。']);
    A(G, 'B1').props.batteryBox.visible = false;
    N.logAct(G, 'battery', '8', ['停車場的繳費機上有一盒電池。你沒有碰它。', '停車場的繳費機上有一盒電池。你換上了它。', '停車場的繳費機上有一盒電池。你把它收了起來。'][i]);
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
    const c = N.R.child;
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
    N.logAct(G, 'child', '7', ['3F 的男孩說他住在這裡。你說「明天早上管理室有人」，然後離開。', '3F 的男孩說他住在這裡。你問他住在幾樓。', '3F 的男孩說他住在這裡。你牽起了他的手。'][i]);
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
      await N.flicker(G, 1, 0.25);
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
    const w = N.R.woman;
    const pos = w.headPos.clone().setY(0.95);
    G.lock();
    w.anim('idle', { track: true });
    await G.lookAt(pos, 0.9);
    await G.say('「管理員，」', { who: 'woman', pos });
    await G.say('「我住樓上，我家的門打不開。你可以陪我上去嗎？七樓，很快。」', { who: 'woman', pos });
    const i = await G.choice('她光著腳，蹲在鐵捲門前。', ['「明天早上管理室有人。」然後離開。', '陪她上樓。', '問她叫什麼名字。']);
    G.unlock();
    N.logAct(G, 'woman', '7', ['2F 的阿姨說她住樓上。你說「明天早上管理室有人」，然後離開。', '2F 的阿姨說她住樓上。你陪她上了樓。', '2F 的阿姨說她住樓上。你問了她的名字。'][i]);
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
      N.R.woman = tall;
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
      N.setBoard(G, 'blank');
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
      if (N.R.engine) N.R.engine.stop();
      N.R.engine = null;
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
    const d = N.R.double;
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
    N.logAct(G, 'double', '7', ['2F 有一個跟你一模一樣的人。你說「明天早上管理室有人」，然後離開。', '2F 有一個跟你一模一樣的人。你問了他的名字。', '2F 有一個跟你一模一樣的人。你答應讓他回家。'][i]);
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
    N.R.bosses.forEach((b) => b.track(true, true));
    G.sfx('sting');
    const pos = N.R.bosses[1].headPos;
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
      N.setBoard(G, 'six');
      G.sfx('chalk');
      N.R.students.forEach((s) => s.anim('idle'));
      await G.wait(0.6);
      G.blackout(true);
      await G.wait(0.4);
      N.R.students.forEach((s) => s.remove());
      G.blackout(false);
      G.san(5);
    } else if (i === 1) {
      // 所有學生同時轉過頭來
      N.setBoard(G, 'seven');
      G.sfx('chalk');
      await G.wait(0.5);
      N.R.students.forEach((s) => {
        s.anim('idle', { track: true });
        s.track(true, true);
      });
      G.sfx('sting');
      G.cine(true);
      await G.lookAt(N.R.students[Math.floor(N.R.students.length / 2)].headPos, 0.35);
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

  Object.assign(N, { freeBattery, tv, roster, child, woman, board2, carNote, scratch, roof2, double, bosses, board3, roof3 });
})();
