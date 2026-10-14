#!/usr/bin/env node
/*
 * 3D 版自動測試：用 Playwright（SwiftShader 軟體 WebGL）開啟 3d/index.html，
 * 透過 window.NP3D_DEBUG 跑過幾段關鍵流程，任何頁面錯誤都會讓測試失敗。
 *
 *   第一夜：開場簽到 → 搭電梯停 4 樓（不動）→ 抵達 2F 打卡 → 樓梯遇到 7F → 不回頭下樓
 *          → 03:00 鎖在保全室 → 開門 → 結局「敲門聲」
 *   第三夜：05:00 上七樓 → 照著影子走 → 「耳東陳」→ 不回頭帶老陳出來 → 06:00 推門 → 結局「交班」
 *
 * 需要 playwright 與 three@0.149.0（或用 NP3D_THREE 指定 three.min.js 路徑）。
 * 只跑第三夜：ONLY3=1 node tests/smoke-3d.cjs
 */
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const req = (name) => {
  try {
    return require(name);
  } catch {
    return require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', name));
  }
};
const { chromium } = req('playwright');

function threeSource() {
  const candidates = [process.env.NP3D_THREE, path.join(__dirname, '..', 'node_modules/three/build/three.min.js')].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
  throw new Error('找不到 three.min.js：請 npm install three@0.149.0，或用 NP3D_THREE 指定路徑');
}

const PAGE = `file://${path.resolve(__dirname, '..', '3d/index.html')}`;

async function main() {
  const THREE_JS = threeSource();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, reducedMotion: 'reduce' });
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (/three@0\.149\.0\/build\/three\.min\.js/.test(u)) return r.fulfill({ body: THREE_JS, contentType: 'application/javascript' });
    if (u.startsWith('file:')) return r.continue();
    return r.abort();
  });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_FAILED|net::/.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
  });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#title:not([hidden])', { timeout: 60000 });

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const use = (id) => ev((i) => {
    const it = NP3D_DEBUG.interactables.find((x) => x.id === i);
    if (!it) throw new Error(`no interactable ${i}`);
    NP3D_DEBUG.G.run(() => it.use(NP3D_DEBUG.G));
  }, id);
  const until = (fn, timeout = 60000) => page.waitForFunction(fn, null, { timeout });
  const pick = async (n) => {
    await page.waitForSelector('#choice:not([hidden])', { timeout: 60000 });
    await page.keyboard.press(`Digit${n}`);
    await page.waitForTimeout(150);
  };

  if (!process.env.ONLY3) {
    await page.click('#btn-new');
    await page.click('#card-go');
    // 開場直接攤開值班日誌，簽名（第一夜同時填名字）
    await page.waitForSelector('#sign:not([hidden])');
    await page.fill('#sign-name', '阿明');
    await page.press('#sign-name', 'Enter');
    await until(() => NP3D_DEBUG.S.signedIn && !document.querySelector('#sign:not([hidden])'));

    await ev(() => NP3D_DEBUG.G.teleport('1F', -2.8, -1.5, -Math.PI / 2));
    await use('panel-1F');
    await pick(2);
    await until(() => NP3D_DEBUG.S.area === '4F');
    await until(() => NP3D_DEBUG.S.area === '2F' && !NP3D_DEBUG.G.busy);
    console.log('✓ 電梯停在 4 樓，不動，抵達 2F');
    await use('punch-2F');
    await until(() => NP3D_DEBUG.S.cps.includes('2F'));

    await ev(() => {
      NP3D_DEBUG.setTime(130);
      NP3D_DEBUG.G.teleport('3F', 2.6, -2.0, -Math.PI / 2);
    });
    await use('up-3F');
    await until(() => NP3D_DEBUG.S.area === '7F' && !NP3D_DEBUG.G.busy);
    await use('down7');
    await until(() => NP3D_DEBUG.S.area === '1F' && !NP3D_DEBUG.G.busy && !NP3D_DEBUG.P.rail);
    console.log('✓ 樓梯遇到 7F，不回頭走回 1F');

    await ev(() => {
      NP3D_DEBUG.G.teleport('1F', -3.4, 6.2, Math.PI / 2);
      NP3D_DEBUG.setTime(299);
    });
    await until(() => NP3D_DEBUG.S.blackout && NP3D_DEBUG.S.nf.lockedIn);
    await ev(() => NP3D_DEBUG.setTime(318));
    await use('guardDoor');
    await pick(1);
    await page.waitForSelector('#ending:not([hidden])', { timeout: 90000 });
    assert.equal(await page.textContent('#end-title'), '敲門聲');
    console.log('✓ 03:00 開門 → 結局「敲門聲」');
  }

  await ev(() => {
    NP3D_DEBUG.startNight({ night: 3, name: '阿明', san: 70, clues: ['c1', 'c2', 'c3', 'c4'], flags: [], warnings: 0, missed: 0, marks: {} });
  });
  await page.waitForSelector('#card:not([hidden])');
  await page.click('#card-go');
  await page.waitForSelector('#sign:not([hidden])');
  assert.equal(await page.inputValue('#sign-name'), '阿明');
  await page.click('#sign-go');
  await until(() => NP3D_DEBUG.S.signedIn);
  await ev(() => {
    NP3D_DEBUG.setTime(421);
    NP3D_DEBUG.G.teleport('6F', 2.6, -2.0, -Math.PI / 2);
    NP3D_DEBUG.G.setFlash(true);
  });
  await use('up-6F');
  await until(() => NP3D_DEBUG.S.area === '7F' && !NP3D_DEBUG.G.busy);

  const walk = async (z0, z1, yaw, pitch) => {
    const n = 60;
    for (let i = 0; i <= n; i++) {
      await ev(([z, y, p]) => {
        const G = NP3D_DEBUG.G;
        G.P.pos.set(G.world.areas['7F'].ox, 0, z);
        G.setYaw(y);
        G.setPitch(p);
      }, [z0 + ((z1 - z0) * i) / n, yaw, pitch]);
      await page.waitForTimeout(110);
      if (await page.isVisible('#choice')) return 'choice';
      if (await page.isVisible('#ending')) return 'ending';
    }
    return 'done';
  };
  await ev(() => {
    const G = NP3D_DEBUG.G;
    G.P.pos.set(G.world.areas['7F'].ox + 0.5, 0, -1.5);
  });
  await page.waitForTimeout(800);
  const r1 = await walk(-1.0, 28.5, Math.PI, -0.5);
  assert.notEqual(r1, 'ending', '照著影子走不應該失敗');
  await pick(1);
  await pick(1);
  await until(() => NP3D_DEBUG.P.moveLock === 0 && NP3D_DEBUG.P.pos.z < 28);
  await page.waitForTimeout(1200);
  await walk(27.0, 0.2, 0, -0.4);
  await until(() => NP3D_DEBUG.S.area === '6F' && !NP3D_DEBUG.P.rail);
  assert.equal(await ev(() => !!NP3D_DEBUG.S.nf.rescued), true);
  console.log('✓ 七樓：照著影子走、耳東陳、不回頭，救出老陳');
  await ev(() => {
    NP3D_DEBUG.setTime(481);
    NP3D_DEBUG.G.teleport('1F', 0, 22, 0);
  });
  await page.waitForTimeout(800);
  await use('exit');
  await page.waitForSelector('#ending:not([hidden])', { timeout: 90000 });
  assert.equal(await page.textContent('#end-title'), '交班');
  console.log('✓ 06:00 推門離開 → 真結局「交班」');

  await browser.close();
  if (problems.length) {
    problems.forEach((p) => console.error(p));
    throw new Error('頁面出現錯誤');
  }
  console.log('全部通過。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
