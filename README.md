# 夜巡守則 Night Patrol

一款規則怪談網頁遊戲。

你是福安大廈新來的夜班保全，手上只有一本《夜間保全守則》。三個晚上，守則一直在變：有些條文被改過，有些紅筆字不是原本的人寫的。分辨哪幾條是真的，活到早上六點，也許還能把上一個保全從七樓帶回來。

- 三個夜晚，約 20 到 30 分鐘
- 12 個結局（1 個真結局）
- 純文字＋程序化音效，建議戴耳機
- 支援桌面與手機

## 兩個版本

| 版本 | 位置 | 說明 |
| --- | --- | --- |
| 文字版 | `index.html` | 選擇式的規則怪談，約 20–30 分鐘 |
| 3D 版《夜巡守則・七樓》 | `3d/index.html` | 第一人稱 3D 恐怖，守則變成身體的動作：不要回頭、不要動、照著自己的影子走 |

## 怎麼玩

直接用瀏覽器開啟 `index.html`，或在專案目錄執行：

```sh
npx serve .
```

文字版：每個整點選一個地方去，完成五個打卡點，撐到 06:00。遇到不對勁的事，翻開守則。

3D 版：用瀏覽器開啟 `3d/index.html`（需要網路載入 three.js）。WASD 移動、滑鼠看、E 互動、F 手電筒、H 守則；手機用左下搖桿與右半邊拖曳。

## 專案結構

```
index.html              頁面骨架
css/style.css           樣式
js/content.js           守則、事件、線索、結局（所有內容都在這裡）
js/audio.js             Web Audio 程序化音效
js/game.js              遊戲引擎
docs/GDD.md             遊戲設計文件
tools/validate.mjs      內容與公平性驗證
tools/build-artifact.mjs  合併成單一 HTML 檔（dist/night-patrol.html）
tests/playthrough.cjs   Playwright 自動遊玩測試
3d/                     3D 版（data、textures、audio、world、director、main）
docs/GDD-3D.md          3D 版設計文件
tools/build-3d.mjs      合併成單一 HTML 檔（dist/night-patrol-3d.html）
tests/smoke-3d.cjs      3D 版自動測試（Playwright + SwiftShader）
```

## 開發

```sh
npm run validate   # 檢查事件、結局、線索與守則破綻
npm test           # 自動遊玩三條路線（需要 playwright）
npm run build      # 輸出 dist/night-patrol.html
npm run build:3d   # 輸出 dist/night-patrol-3d.html
npm run test:3d    # 3D 版自動測試
```

設計細節請看 [docs/GDD.md](docs/GDD.md)。
