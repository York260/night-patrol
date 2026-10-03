# 夜巡守則 Night Patrol

一款規則怪談網頁遊戲。

你是福安大廈新來的夜班保全，手上只有一本《夜間保全守則》。三個晚上，守則一直在變：有些條文被改過，有些紅筆字不是原本的人寫的。分辨哪幾條是真的，活到早上六點，也許還能把上一個保全從七樓帶回來。

- 三個夜晚，約 20 到 30 分鐘
- 12 個結局（1 個真結局）
- 純文字＋程序化音效，建議戴耳機
- 支援桌面與手機

## 怎麼玩

直接用瀏覽器開啟 `index.html`，或在專案目錄執行：

```sh
npx serve .
```

每個整點選一個地方去，完成五個打卡點，撐到 06:00。遇到不對勁的事，翻開守則。

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
```

## 開發

```sh
npm run validate   # 檢查事件、結局、線索與守則破綻
npm test           # 自動遊玩三條路線（需要 playwright）
npm run build      # 輸出 dist/night-patrol.html
```

設計細節請看 [docs/GDD.md](docs/GDD.md)。
