#!/usr/bin/env node
/*
 * 把 3d/ 合併成單一 HTML 片段（dist/night-patrol-3d.html）。
 * three.js 仍然從 CDN 載入（jsDelivr，失敗時改用 unpkg），其他 CSS 與 JS 全部內嵌。
 *
 * 用法：node tools/build-3d.mjs [輸出路徑]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '3d');
const out = resolve(process.argv[2] || join(root, '..', 'dist/night-patrol-3d.html'));
const read = (p) => readFileSync(join(root, p), 'utf8');

const html = read('index.html');
const block = (name) => {
  const m = html.match(new RegExp(`<!-- BEGIN ${name} -->([\\s\\S]*?)<!-- END ${name} -->`));
  if (!m) throw new Error(`3d/index.html 缺少 ${name} 區塊`);
  return m[1].trim();
};

const head = block('HEAD').split('\n').filter((l) => !l.includes('name="description"')).join('\n');
const tail = html.slice(html.indexOf('<!-- END APP -->'));
const external = [...tail.matchAll(/<script src="(https:[^"]+)"><\/script>/g)].map((m) => m[0]);
const fallback = tail.match(/<script>window\.THREE[\s\S]*?<\/script>/);
const local = [...tail.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => {
  const src = read(m[1]);
  if (src.includes('</script')) throw new Error(`${m[1]} 含有 </script，無法內嵌`);
  return `<script>\n${src}\n</script>`;
});

const page = [head, `<style>\n${read('css/style.css')}\n</style>`, block('APP'), ...external, fallback ? fallback[0] : '', ...local].join('\n');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${page}\n`);
console.log(`已輸出 ${out}（${(Buffer.byteLength(page) / 1024).toFixed(1)} KB）`);
