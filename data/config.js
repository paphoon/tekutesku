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

  // 「晴れそうな山の候補」の下に並べる、山の天気の専門サイト（中身は載せず、リンクだけ）
  // 山ごとのページの URL がわかったら、mountains.js の山に weather:{yamatenki:"URL"} のように書けます。
  weatherLinks: [
    {id:"yamatenki", name:"山の天気予報", url:"https://i.yamatenki.co.jp/"},
    {id:"tenkura",   name:"てんきとくらす（登山指数）", url:"https://tenkura.n-kishou.co.jp/tk/"},
    {id:"tenkijp",   name:"tenki.jp 登山天気", url:"https://tenki.jp/mountain/"},
    {id:"jma",       name:"気象庁 天気予報", url:"https://www.jma.go.jp/bosai/forecast/"},
  ],

  // ご意見募集（Supabase）。この鍵は「送る」ことしかできない公開用の鍵です。
  // 届いた意見は Supabase の管理画面 → Table Editor → feedback で読めます。
  feedback: {
    url: "https://jqyfsfrqwzjgvfshapwe.supabase.co",   // Supabase プロジェクト tekuteku-sanpo
    key: "sb_publishable_o3iQTd3BUJGFunJ3HihiqA_ZUa-IMu1",
  },
};
