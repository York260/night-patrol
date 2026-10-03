#!/usr/bin/env node
/*
 * 把 index.html、css、js 合併成單一 HTML 片段（dist/night-patrol.html），
 * 方便直接分享或發佈成 Artifact。片段不含 <html>/<head>/<body>，
 * 發佈時會由外層頁面包起來；直接用瀏覽器開啟也能正常運作。
 *
 * 用法：node tools/build-artifact.mjs [輸出路徑]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || join(root, 'dist/night-patrol.html'));
const read = (p) => readFileSync(join(root, p), 'utf8');

const html = read('index.html');
const block = (name) => {
  const m = html.match(new RegExp(`<!-- BEGIN ${name} -->([\\s\\S]*?)<!-- END ${name} -->`));
  if (!m) throw new Error(`index.html 缺少 ${name} 區塊`);
  return m[1].trim();
};

const head = block('HEAD')
  .split('\n')
  .filter((line) => !line.includes('name="description"'))
  .join('\n');

const scripts = ['js/content.js', 'js/audio.js', 'js/game.js'].map((p) => {
  const src = read(p);
  if (src.includes('</script')) throw new Error(`${p} 含有 </script，無法內嵌`);
  return `<script>\n${src}\n</script>`;
});

const page = [head, `<style>\n${read('css/style.css')}\n</style>`, block('APP'), ...scripts].join('\n');

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${page}\n`);
console.log(`已輸出 ${out}（${(Buffer.byteLength(page) / 1024).toFixed(1)} KB）`);
