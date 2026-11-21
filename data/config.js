/* ============================================================
   てくてく、さんぽ — 設定
   ここを書きかえるだけで、サイトの基本設定が変わります。
   ============================================================ */
window.TEKU = window.TEKU || {};

TEKU.config = {
  siteName: "てくてく、さんぽ",
  siteNameEn: "TEKUTEKU SANPO",

  // 出発地（行き方の時間はここからの目安）
  origin: "東京駅",

  // YouTube チャンネル
  youtubeChannel: "https://www.youtube.com/@tekuteku-sanpo",

  // キャラクター画像（このファイルを置くと、ロゴの横などに表示されます）
  // 背景が透明の PNG がおすすめ。ファイルがなければ何も表示されません。
  mascot: "assets/mascot.png",

  // Google フォームの回答シートを「ウェブに公開（CSV）」したときの URL。
  // 空のままなら、data/records.js の記録だけを表示します。
  recordsCsvUrl: "",

  // 登った日から何日たったら記録を表示するか（留守が分からないように）
  recordDelayDays: 3,
};
