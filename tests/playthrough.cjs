#!/usr/bin/env node
/*
 * 自動遊玩測試：用 Playwright 開啟遊戲，實際玩過三種路線。
 *   1. 第一夜 03:00 開門 → 結局「敲門聲」，再用「重來第一夜」回到開場
 *   2. 三夜全程照真規則行動並救出老陳 → 真結局「交班」
 *   3. 第三夜照被竄改的第五條上頂樓 → 結局「第五條」
 * 任何頁面錯誤或 console.error 都會讓測試失敗。
 *
 * 用法：node tests/playthrough.cjs   （需要 playwright）
 */
const path = require('node:path');
const assert = require('node:assert/strict');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}

const FILE = `file://${path.resolve(__dirname, '..', process.env.NP_PAGE || 'index.html')}`;

function driver(page) {
  const choose = async (text) => {
    await page.locator('#scene .choice', { hasText: text }).first().click();
  };
  const cont = () => choose('繼續');
  const clock = async (expected) => {
    assert.equal(await page.locator('#tb-clock').textContent(), expected);
  };
  const go = async (dest, mode) => {
    await choose(dest);
    if (mode) await choose(mode);
  };
  const sceneHas = async (text) => {
    await page.locator('#scene', { hasText: text }).waitFor({ timeout: 3000 });
  };
  return { choose, cont, clock, go, sceneHas };
}

async function newGame(page, name = '測試員') {
  const d = driver(page);
  await page.click('#btn-new');
  await d.choose('繼續');
  await page.fill('#sign-name', name);
  await page.locator('#scene .choice', { hasText: '簽名' }).click();
  await d.choose('開始值班');
  return d;
}

async function nightOne(d, page) {
  await d.clock('23:00');
  await d.go('2F 牙醫診所', '走樓梯');
  await d.choose('不理它，打卡');
  await d.cont();

  await d.clock('00:00');
  await d.go('3F 補習班', '走樓梯');
  await d.choose('明天早上管理室有人');
  await d.cont();

  await d.clock('01:00');
  await d.go('6F 機房', '搭電梯');
  await d.sceneHas('樓層顯示：4');
  await d.choose('不動，不按任何按鈕');
  await d.cont();
  await d.choose('打開來看');
  await d.cont();

  await d.clock('02:00');
  await d.go('5F 空辦公室', '搭電梯');
  await d.choose('打卡，離開');
  await d.cont();

  await d.clock('03:00');
  await d.go('留在 1F 保全室');
  await d.choose('不開門，也不回答');
  await d.cont();

  await d.clock('04:00');
  await d.go('B1 停車場', '搭電梯');
  await d.choose('不理它，打卡離開');
  await d.cont();

  await d.clock('05:00');
  await d.go('留在 1F 保全室');
  await d.choose('關掉螢幕');
  await d.cont();

  await d.choose('下班');
  assert.equal(await page.locator('#cp-num').textContent(), '5 / 5');
  await d.choose('迎接下一夜');
}

async function nightTwo(d, page) {
  await d.choose('繼續');
  await d.choose('開始值班');

  await d.clock('23:00');
  await d.go('B1 停車場', '搭電梯');
  await d.choose('不動，不按任何按鈕');
  await d.cont();
  await d.choose('翻開筆記本');
  await d.cont();

  await d.clock('00:00');
  await d.go('留在 1F 保全室');
  await d.sceneHas('電話響了');
  await d.choose('不接');
  await d.cont();

  await d.clock('01:00');
  await d.go('2F 牙醫診所', '搭電梯');
  await d.choose('明天早上管理室有人');
  await d.cont();

  await d.clock('02:00');
  await d.go('3F 補習班', '搭電梯');
  await d.choose('湊近看');
  await d.cont();

  await d.clock('03:00');
  await d.go('留在 1F 保全室');
  await d.choose('不開門，也不回答');
  await d.cont();

  await d.clock('04:00');
  await d.go('5F 空辦公室', '搭電梯');
  await d.choose('打卡，離開');

  await d.clock('05:00');
  await d.go('6F 機房', '搭電梯');
  await d.choose('不理會，打卡離開');

  await d.choose('下班');
  assert.equal(await page.locator('#cp-num').textContent(), '5 / 5');
  await d.choose('迎接下一夜');
}

async function nightThreeStart(d) {
  await d.choose('繼續');
  await d.choose('開始值班');

  await d.clock('23:00');
  await d.go('5F 空辦公室', '搭電梯');
  await d.sceneHas('多了一個按鈕');
  await d.choose('不動，不按任何按鈕');
  await d.cont();
  await d.choose('讀完它');
  await d.cont();

  await d.clock('00:00');
  await d.go('2F 牙醫診所', '搭電梯');
  await d.choose('明天早上管理室有人');
  await d.cont();

  await d.clock('01:00');
  await d.go('3F 補習班', '搭電梯');
  await d.choose('寫下「六」');
  await d.cont();

  await d.clock('02:00');
  await d.go('B1 停車場', '搭電梯');
  await d.choose('不理會，打卡離開');
}

async function run() {
  const browser = await chromium.launch(process.env.NP_CHROMIUM ? { executablePath: process.env.NP_CHROMIUM } : {});
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 860 } });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/ERR_FAILED|net::/.test(msg.text())) problems.push(`console: ${msg.text()}`);
  });

  await page.goto(FILE);

  /* 路線一：開門 → 敲門聲 → 重來 */
  {
    const d = await newGame(page);
    await d.clock('23:00');
    await d.go('留在 1F 保全室');
    await d.sceneHas('十三');
    await d.choose('關掉螢幕');
    await d.cont();
    for (const hour of ['00:00', '01:00', '02:00']) {
      await d.clock(hour);
      await d.go('留在 1F 保全室');
      await d.cont();
    }
    await d.clock('03:00');
    await d.go('留在 1F 保全室');
    await d.choose(/^\d開門。/);
    await page.locator('#ending-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#end-title').textContent(), '敲門聲');
    await page.click('#btn-retry');
    await d.sceneHas('林主任把一串鑰匙');
    console.log('✓ 路線一：開門 → 結局「敲門聲」，重來第一夜可用');
  }

  /* 路線二：真結局 */
  {
    await page.click('#btn-menu');
    await page.click('#btn-menu-title');
    const d = await newGame(page, '阿明');
    await nightOne(d, page);
    await nightTwo(d, page);
    await nightThreeStart(d);

    await d.clock('03:00');
    await d.go('留在 1F 保全室');
    await d.sceneHas('是你自己的聲音');
    await d.choose('不開門，也不回答');
    await d.cont();

    await d.clock('04:00');
    await d.go('6F 機房', '搭電梯');
    await d.choose('把門鎖好');
    await d.cont();

    await d.clock('05:00');
    await d.go('7F');
    await d.choose('照著自己的影子');
    await d.choose('繼續照著影子往前走');
    await d.choose('我是來交班的');
    await d.cont();
    await d.choose('耳東陳');
    await d.choose('繼續照著影子往前走，不回頭');
    await d.cont();

    await d.sceneHas('老陳站在你旁邊');
    await d.choose('不簽，直接離開');
    await page.locator('#ending-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#end-title').textContent(), '交班');
    console.log('✓ 路線二：三夜全程 → 真結局「交班」');
  }

  /* 路線三：照假的第五條上頂樓（從第三夜重來） */
  {
    const d = driver(page);
    await page.click('#btn-retry');
    await nightThreeStart(d);
    await d.clock('03:00');
    await d.go('6F 機房', '搭電梯');
    await d.choose('繼續等到 04:00');
    await page.locator('#ending-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#end-title').textContent(), '第五條');
    console.log('✓ 路線三：照被竄改的第五條 → 結局「第五條」');
  }

  /* 結局收藏 */
  await page.click('#btn-end-gallery');
  assert.equal(await page.locator('#gallery-count').textContent(), '已解鎖 3 / 12');
  console.log('✓ 結局收藏：已解鎖 3 / 12');

  /* 路線四：理智不足時上七樓（直接載入第三夜 05:00 的存檔） */
  {
    const d = driver(page);
    const SHAKY = '你的手抖得快握不住手電筒';
    const at0500 = async (san) => {
      const st = {
        v: 1, name: '阿明', night: 3, hi: 7, san, bat: 3, loc: 'guard', cps: [], clues: ['c1', 'c4'],
        flags: [], seen: [], marks: {}, warnings: 0, missed: 0, tonightClues: [],
      };
      await page.evaluate((s) => localStorage.setItem('np-save-v1', JSON.stringify({ S: s, base: s })), st);
      await page.reload();
      await page.click('#btn-continue');
      await d.clock('05:00');
      await d.go('7F');
    };

    await at0500(40);
    await d.sceneHas('第十三個畫面裡的那條走廊');
    assert.equal(await page.locator('#scene', { hasText: SHAKY }).count(), 0);
    console.log('✓ 路線四之一：理智 40 上七樓，沒有警告');

    await at0500(15);
    await d.sceneHas(SHAKY);
    await d.choose('轉身下樓');
    await d.cont();
    await d.choose('不簽，直接離開');
    await page.locator('#ending-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#end-title').textContent(), '天亮了');
    assert.equal(await page.locator('#end-cause').isVisible(), false);
    console.log('✓ 路線四之二：理智 15 出現警告，折返 → 結局「天亮了」');

    await at0500(15);
    await d.choose('照著自己的影子');
    await d.choose('繼續照著影子往前走');
    await d.choose('我是來交班的');
    await d.cont();
    await d.choose('耳東陳');
    await d.choose('繼續照著影子往前走，不回頭');
    await d.cont();
    await page.locator('#ending-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#end-title').textContent(), '新的住戶');
    assert.equal(await page.locator('#end-cause').textContent(), '死因：理智歸零（第三夜 05:00・7F）');
    console.log('✓ 路線四之三：理智 15 硬闖 → 「新的住戶」，畫面標出死因');
  }

  await browser.close();
  if (problems.length) {
    problems.forEach((p) => console.error(p));
    throw new Error('頁面出現錯誤');
  }
  console.log('全部通過。');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
