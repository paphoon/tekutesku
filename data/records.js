/* ============================================================
   てくてく日記（手で書く分）
   ------------------------------------------------------------
   ふだんは Google フォームから入力すれば、ここを書かなくても表示されます。
   フォームを使わずに足したいときだけ、ここに書きます。

   date     : 登った日 "2025-05-19"
   mountain : 山（mountains.js の id か、山の名前）
   title    : 日記のタイトル
   body     : 感想（長くて OK。改行は \n）
   route    : ルート      way : "電車・バス" か "車"
   weather  : 天気        time : 歩いた時間 "1:30"
   yamap    : YAMAP の活動日記の URL
   youtube  : YouTube の動画の URL
   sample   : true にすると「見本」と表示される
   ============================================================ */
window.TEKU = window.TEKU || {};

TEKU.records = [
  {date:"2023-05-19", mountain:"koasama",
   title:"1時間未満で登れるお手軽で浅間山に近づける山",
   body:"初めての動画。歩きも、投稿ものんびり気ままに。",
   route:"峰の茶屋から往復", way:"", weather:"", time:"",
   yamap:"", youtube:"https://www.youtube.com/watch?v=OeiaxBIG3X0", sample:true},
];
