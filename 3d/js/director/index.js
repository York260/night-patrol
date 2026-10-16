/*
 * 夜巡守則・七樓（3D）— 導演：對外介面
 *
 * 文字版的每個「選項」，在這裡都變成身體的動作：
 *   不要回頭  → 監看視角方向
 *   不要動、不要按按鈕 → 監看移動與互動
 *   不要開門、不要接電話、不要回答 → 互動提示就在眼前，但守則叫你別按
 *   照著自己的影子 → 手電筒必須一直往下照
 *
 * 表現原則：能用畫面、聲音、鏡頭說的事，就不用字幕。
 *   內心獨白只留最短的幾個字；需要玩家注意的東西，用鏡頭帶過去（G.lookAt）。
 *   每一種死法都有自己的 3D 場面：die() → 電影模式（上下黑邊）→ 場面 → 結局卡。
 *
 * 檔案：base（共用）、flow（每一夜的流程）、threeam（03:00）、cctv（監視器）、
 *       phone（電話與電梯）、seventh（7F）、events（住戶與物件）。main.js 只認得這個介面。
 */
window.NP3D_DIRECTOR = (() => {
  'use strict';

  const N = window.NP3D_DIR;
  return {
    setupNight: N.setupNight,
    startNight: N.startNight,
    update: N.update,
    onEnterArea: N.onEnterArea,
    onSanZero: N.onSanZero,
    onResume: N.onResume,
    patrolLog: N.patrolLog,
    logbookLabel: N.logbookLabel,
    onLogbook: N.onLogbook,
    onExit: N.onExit,
    onPunch: N.onPunch,
    onPower: N.onPower,
    elevatorStop: N.elevatorStop,
    panelExtra: N.panelExtra,
    stairsTarget: N.stairsTarget,
    onLanding: N.onLanding,
    get debug() {
      return N.R;
    },
  };
})();
