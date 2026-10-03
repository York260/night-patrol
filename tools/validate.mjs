#!/usr/bin/env node
/*
 * 內容驗證：檢查 content.js 的事件、線索、結局與守則是否互相對得上，
 * 並檢查「公平性」設計：每一條假守則都必須留下可被玩家發現的破綻。
 *
 * 用法：node tools/validate.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(root, 'js/content.js'), 'utf8'), sandbox);
const C = sandbox.window.NP_CONTENT;

const errors = [];
const warn = [];
const fail = (msg) => errors.push(msg);

const TRIGGERS = new Set(['guard', 'loc', 'transit', 'lock', 'lockout', 'roof', 'seventh', 'signout', 'chain']);
const TEMPLATE_KEYS = new Set(['name', 'time', 'dest', 'missed']);
const ENGINE_ENDINGS = ['E_SAN', 'E_FIRED']; // 由引擎直接觸發
const CHECKPOINTS = ['B1', '2F', '3F', '5F', '6F'];

function checkTemplates(where, list) {
  for (const item of list) {
    if (typeof item !== 'string') continue;
    for (const [, key] of item.matchAll(/\{(\w+)\}/g)) {
      if (!TEMPLATE_KEYS.has(key)) fail(`${where}: 未知的模板變數 {${key}}`);
    }
  }
}

/* 事件 */
const referencedEndings = new Set(ENGINE_ENDINGS);
const referencedChains = new Set();
const clueSources = new Map();

for (const [id, ev] of Object.entries(C.EVENTS)) {
  if (!TRIGGERS.has(ev.at)) fail(`${id}: 未知的觸發種類 ${ev.at}`);
  if (!ev.night) fail(`${id}: 缺少 night`);
  if (ev.at === 'loc' && !C.LOCATIONS[ev.loc]) fail(`${id}: 未知樓層 ${ev.loc}`);
  if (ev.at === 'transit' && !['stairs', 'elevator'].includes(ev.mode)) fail(`${id}: transit 需要 mode`);
  if (!Array.isArray(ev.choices) || ev.choices.length === 0) fail(`${id}: 沒有選項`);
  checkTemplates(id, ev.text);
  ev.choices.forEach((c, i) => {
    const res = c.res || {};
    const where = `${id} 選項 ${i + 1}`;
    checkTemplates(where, [c.t]);
    if (res.text) checkTemplates(where, res.text);
    if (res.next) {
      if (!C.EVENTS[res.next]) fail(`${where}: next 指向不存在的事件 ${res.next}`);
      else referencedChains.add(res.next);
    }
    if (res.clue) {
      if (!C.CLUES[res.clue]) fail(`${where}: 不存在的線索 ${res.clue}`);
      clueSources.set(res.clue, [...(clueSources.get(res.clue) || []), id]);
    }
    if (typeof res.end === 'string') {
      if (!C.ENDINGS[res.end]) fail(`${where}: 不存在的結局 ${res.end}`);
      referencedEndings.add(res.end);
    } else if (typeof res.end === 'function') {
      for (const [m] of res.end.toString().matchAll(/E_[A-Z0-9]+/g)) {
        if (!C.ENDINGS[m]) fail(`${where}: 不存在的結局 ${m}`);
        referencedEndings.add(m);
      }
    }
    if (res.abort && res.end) fail(`${where}: abort 與 end 不應同時出現`);
  });
}

for (const [id, ev] of Object.entries(C.EVENTS)) {
  if (ev.at === 'chain' && !referencedChains.has(id)) fail(`${id}: chain 事件沒有被任何事件接上`);
}

/* 每一夜都要有 03:00、下班事件，五個打卡點都要有專屬事件 */
for (const night of [1, 2, 3]) {
  const tonight = Object.values(C.EVENTS).filter((e) => [].concat(e.night).includes(night));
  for (const at of ['lock', 'lockout', 'signout']) {
    if (!tonight.some((e) => e.at === at)) fail(`第 ${night} 夜缺少 ${at} 事件`);
  }
  for (const loc of CHECKPOINTS) {
    if (!tonight.some((e) => e.at === 'loc' && e.loc === loc)) warn.push(`第 ${night} 夜的 ${loc} 沒有專屬事件`);
  }
}

/* 結局 */
for (const id of C.ENDING_ORDER) {
  if (!C.ENDINGS[id]) fail(`ENDING_ORDER 中的 ${id} 不存在`);
  if (!referencedEndings.has(id)) fail(`結局 ${id} 沒有任何觸發來源`);
}
for (const id of Object.keys(C.ENDINGS)) {
  if (!C.ENDING_ORDER.includes(id)) fail(`結局 ${id} 沒有列在 ENDING_ORDER`);
}

/* 線索 */
for (const id of Object.keys(C.CLUES)) {
  if (!clueSources.has(id)) fail(`線索 ${id} 無法取得`);
}

/* 守則與公平性 */
for (const id of Object.keys(C.RULES)) {
  if (!(id in C.TRUTH)) fail(`守則 ${id} 沒有登記真偽`);
}
for (const [night, hb] of Object.entries(C.HANDBOOKS)) {
  for (const page of hb.pages) {
    for (const id of page.rules) {
      const rule = C.RULES[id];
      if (!rule) fail(`第 ${night} 夜守則引用不存在的 ${id}`);
      else if (rule.ink !== 'print') fail(`${id} 應該是印刷字`);
      if (C.TRUTH[id] === false && page.stamp !== 'flip') fail(`第 ${night} 夜：假的印刷守則 ${id} 所在頁面印章沒有反過來`);
    }
    if (page.footer && C.TRUTH[page.footer] === false && page.stamp !== 'flip') {
      fail(`第 ${night} 夜：假的頁尾 ${page.footer} 所在頁面印章沒有反過來`);
    }
  }
  for (const id of hb.hand) {
    const rule = C.RULES[id];
    if (!rule) {
      fail(`第 ${night} 夜守則引用不存在的 ${id}`);
      continue;
    }
    if (rule.ink !== 'hand') fail(`${id} 應該是手寫字`);
    const expected = C.TRUTH[id] ? '陳' : '陣';
    if (rule.sign !== expected) fail(`${id} 的署名應該是「${expected}」，目前是「${rule.sign}」`);
  }
}

const lieCount = Object.values(C.TRUTH).filter((v) => !v).length;
console.log(`事件 ${Object.keys(C.EVENTS).length}・結局 ${C.ENDING_ORDER.length}・線索 ${Object.keys(C.CLUES).length}・守則 ${Object.keys(C.RULES).length}（其中 ${lieCount} 條為假，含頁尾）`);
warn.forEach((w) => console.log(`注意：${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`錯誤：${e}`));
  process.exit(1);
}
console.log('內容驗證通過。');
