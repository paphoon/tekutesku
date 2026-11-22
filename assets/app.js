/* ============================================================
   てくてく、さんぽ — 画面の動き
   データは data/ フォルダのファイルを書きかえてください。
   ============================================================ */
(() => {
"use strict";

const CFG = TEKU.config;
const MOUNTAINS = TEKU.mountains;
const COURSES = TEKU.courses;
const LV = {1:"初級",2:"中級",3:"上級"};
const TYPES = ["往復","周回","縦走"];
const PREF_ORDER = ["北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬","埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野","岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"];
const REGION_ORDER = ["北海道","東北","関東","甲信越","北陸","東海","近畿","中国","四国","九州","沖縄"];
const MEMO_ROWS = [["good","よかった"],["care","気をつけて"],["access","行き方のコツ"],["food","ごはん・温泉"]];

/* ---------- 共通 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const fmtH = m => { const h = Math.floor(m/60), r = m%60; return h ? (r ? `${h}h${String(r).padStart(2,"0")}` : `${h}h`) : `${r}m`; };
const lvColor = lv => getComputedStyle(document.documentElement).getPropertyValue(`--lv${lv}`).trim();
const lvText = (a,b) => a===b ? LV[a] : `${LV[a]}〜${LV[b]}`;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const norm = s => String(s ?? "").replace(/[\s　]/g,"").replace(/（.*?）|\(.*?\)/g,"");
const safeUrl = u => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const ytId = u => { const m = String(u||"").match(/(?:youtu\.be\/|v=|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/); return m ? m[1] : ""; };
const pad = n => String(n).padStart(2,"0");
const fmtDate = d => `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}`;
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const sortBy = (arr, order) => arr.sort((a,b) => (order.indexOf(a)+1||99) - (order.indexOf(b)+1||99));
/* 山の色を、霞がかった淡い色にする（t=1 で真っ白に近づく） */
const tint = (hex, t) => {
  const n = parseInt(hex.slice(1), 16), base = [246,248,245];
  const c = [n>>16 & 255, n>>8 & 255, n & 255].map((v,i) => Math.round(v + (base[i]-v)*t));
  return `rgb(${c.join(",")})`;
};
const gvars = g => `--g1:${tint(g[0],.7)};--g2:${tint(g[1],.8)}`;
const paras = t => String(t||"").split(/\r?\n\s*\r?\n|\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>`<p>${esc(s)}</p>`).join("");

/* ---------- データの下ごしらえ ---------- */
const byId = Object.fromEntries(MOUNTAINS.map(m=>[m.id,m]));
COURSES.forEach(c => { c.peaks = c.peaks || [c.home]; });
const findMountain = v => {
  if (!v) return null;
  if (byId[v]) return byId[v];
  const n = norm(v);
  return MOUNTAINS.find(m => norm(m.name)===n) || MOUNTAINS.find(m => n && (norm(m.name).includes(n) || n.includes(norm(m.name)))) || null;
};
MOUNTAINS.forEach(m => {
  m.courses = [
    ...COURSES.filter(c => c.home===m.id),
    ...COURSES.filter(c => c.home!==m.id && c.peaks.includes(m.id)),
  ];
  if (!m.courses.length) m.courses = [{id:`${m.id}-none`, home:m.id, peaks:[m.id], name:"ルート準備中", type:"往復", lv:1, walk:0, dist:0, path:[m.name]}];
  m.minWalk = Math.min(...m.courses.map(c=>c.walk));
  m.minLv = Math.min(...m.courses.map(c=>c.lv));
  m.maxLv = Math.max(...m.courses.map(c=>c.lv));
  m.logs = [];
  m.memo = null;
  const car = Object.assign({}, (TEKU.carAccess||{})[m.id] || {}, m.car || {});
  m.car = Object.keys(car).length ? car : null;
});

/* ---------- 電車／車 ---------- */
let mode = "train";
try { if (localStorage.getItem("teku-mode") === "car") mode = "car"; } catch {}
// 登山口が山の基本と違うルート（c.route がある）は、山の駐車場の情報を使わない
const carOf = (m, c) => (c && c.car) || (c && c.route ? null : m.car);
const carMin = (m, c) => { const x = carOf(m, c); return (x && x.min) || null; };
const accessOf = (m, c) => mode === "car" ? (c ? carMin(m, c) : (carMin(m) || m.access)) : ((c && c.access) || m.access);
const MODE_LABEL = {train:"🚃 電車・バス", car:"🚗 車"};
const WX = {ready:false, days:[], data:{}, sel:null};   // 天気の目安（あとで読み込む）
(TEKU.memos||[]).forEach(x => {
  const m = findMountain(x.mountain);
  if (m && (x.tip || MEMO_ROWS.some(([k]) => x[k]))) m.memo = x;
});
const PEAK_NAMES = new Set([...MOUNTAINS.map(m=>m.name), ...(TEKU.peakNames||[])]);

/* ---------- キャラクター画像 ---------- */
let mascotOk = false;
const mascotImg = cls => mascotOk ? `<img class="${cls||""}" src="${esc(CFG.mascot)}" alt="">` : "";
if (CFG.mascot){
  const probe = new Image();
  probe.onload = () => {
    mascotOk = true;
    document.querySelectorAll("[data-mascot]").forEach(img => {
      img.src = CFG.mascot; img.hidden = false;
      const fb = img.parentElement.querySelector("[data-mascot-fallback]"); if (fb) fb.remove();
    });
    render(); showInfo(currentInfo);
  };
  probe.src = CFG.mascot;
}
document.querySelectorAll("[data-mascot]").forEach(img => { if (!CFG.mascot) img.remove(); });
$("footYt").href = CFG.youtubeChannel || "#";
$("year").textContent = new Date().getFullYear();

/* ---------- hero ---------- */
$("statCount").textContent = MOUNTAINS.length;
$("statCourses").textContent = COURSES.length;
$("statTrav").textContent = COURSES.filter(c=>c.type==="縦走").length;

const nav = $("nav");
const ridges = [...document.querySelectorAll(".ridges path")];
const sun = $("sun");
let ticking = false;
addEventListener("scroll", () => {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    const y = scrollY;
    nav.classList.toggle("solid", y > 40);
    if (!reduce && y < innerHeight * 1.2) {
      ridges.forEach(p => p.style.transform = `translateY(${y * -parseFloat(p.dataset.depth)}px)`);
      sun.style.transform = `translateY(${y * 0.35}px)`;
    }
    ticking = false;
  });
}, {passive:true});

/* ============================================================
   てくてく日記（records.js ＋ Google フォームの CSV）
   ============================================================ */
let LOGS = [];

function parseCSV(text){
  const rows = []; let row = [], cell = "", q = false;
  for (let i=0; i<text.length; i++){
    const ch = text[i];
    if (q){
      if (ch === '"'){ if (text[i+1] === '"'){ cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i+1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

function csvToRecords(text){
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim());
  const col = test => head.findIndex(test);
  const idx = {
    date:    col(h => h.includes("登った日")),
    mountain:col(h => h === "山" || /^山[\s（(]/.test(h)),
    title:   col(h => h.includes("タイトル")),
    body:    col(h => h.includes("感想")),
    body2:   col(h => h.includes("ひとこと")),
    route:   col(h => h.includes("ルート")),
    way:     col(h => h.includes("行き方")),
    weather: col(h => h.includes("天気")),
    time:    col(h => h.includes("歩いた時間")),
    yamap:   col(h => /yamap/i.test(h)),
    youtube: col(h => /youtube/i.test(h)),
    publish: col(h => h.includes("載せる")),
  };
  return rows.slice(1).map(r => {
    const g = k => idx[k] >= 0 ? (r[idx[k]] || "").trim() : "";
    return {date:g("date"), mountain:g("mountain"), title:g("title"), body:g("body") || g("body2"),
            route:g("route"), way:g("way"), weather:g("weather"), time:g("time"),
            yamap:g("yamap"), youtube:g("youtube"), publish:g("publish")};
  });
}

function parseDate(s){
  const m = String(s||"").match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  return m ? new Date(+m[1], +m[2]-1, +m[3]) : null;
}

function normalize(r){
  const m = findMountain(r.mountain);
  return {
    date:parseDate(r.date), mountain:m, mountainName: m ? m.name : (r.mountain || "その他の山"),
    title:r.title||"", body:r.body||r.comment||"",
    route:r.route||"", way:r.way||"", weather:r.weather||"", time:r.time||"",
    yamap:safeUrl(r.yamap), youtube:safeUrl(r.youtube), yt:ytId(r.youtube),
    publish: !/いいえ|no/i.test(r.publish||""), sample:!!r.sample,
  };
}

async function loadLogs(){
  let list = (TEKU.records||[]).map(normalize);
  let note = "";
  if (CFG.recordsCsvUrl){
    try {
      const res = await fetch(CFG.recordsCsvUrl, {cache:"no-store"});
      if (!res.ok) throw new Error(res.status);
      list = list.concat(csvToRecords(await res.text()).map(normalize));
    } catch(e){
      note = "フォームの日記を読み込めませんでした。時間をおいて開き直してください。";
    }
  }
  const limit = new Date(); limit.setHours(0,0,0,0); limit.setDate(limit.getDate() - (CFG.recordDelayDays||0));
  LOGS = list.filter(r => r.date && r.publish && (r.sample || r.date <= limit))
             .sort((a,b) => b.date - a.date);
  const used = {};
  LOGS.forEach(r => {   // 日記ごとの固定リンク（#diary/2025-05-19-takao）
    let k = `${ymd(r.date)}-${r.mountain ? r.mountain.id : "other"}`;
    used[k] = (used[k]||0) + 1; if (used[k] > 1) k += `-${used[k]}`;
    r.key = k;
  });
  MOUNTAINS.forEach(m => m.logs = LOGS.filter(r => r.mountain === m));
  renderDiary(note);
  render();
  drawRadar();
  showInfo(currentInfo);
  openFromHash();
}

function thumbHTML(r){
  return r.yt
    ? `<div class="thumb" style="background-image:url('https://i.ytimg.com/vi/${r.yt}/hqdefault.jpg')"></div><span class="yt-badge"></span>`
    : `<div class="noimg">${esc(r.mountain ? r.mountain.en : "SANPO")}</div>`;
}

function renderDiary(note){
  const done = MOUNTAINS.filter(m => m.logs.length).length;
  $("statDone").textContent = done;
  const pct = MOUNTAINS.length ? Math.round(done / MOUNTAINS.length * 100) : 0;
  $("logStats").innerHTML = `
    <div><b>${LOGS.length}</b><span>DIARIES</span></div>
    <div><b>${done}</b><span>CLIMBED</span></div>
    <div class="bar"><div class="track"><div class="fill" style="width:0"></div></div><span class="sub">このサイトの ${MOUNTAINS.length} 山のうち ${done} 山に登りました（${pct}%）</span></div>`;
  requestAnimationFrame(() => setTimeout(() => { const f = $("logStats").querySelector(".fill"); if (f) f.style.width = pct + "%"; }, 50));

  $("logs").innerHTML = LOGS.length ? LOGS.map(r => {
    const g = r.mountain ? r.mountain.g : ["#2f5b45","#183128"];
    return `<article class="log" data-diary="${r.key}" tabindex="0" role="button" aria-label="${esc(r.title || r.mountainName)}の日記を読む">
      <div class="log-media" style="${gvars(g)}">${thumbHTML(r)}<span class="log-date">${fmtDate(r.date)}</span></div>
      <div class="log-body">
        <div class="log-mtn">${esc(r.mountainName)}${r.mountain?` <span style="color:var(--ink-3);font-weight:500">${esc(r.mountain.pref)}</span>`:""}${r.sample ? `<span class="sample">見本</span>` : ""}</div>
        <h3 class="log-title">${esc(r.title || `${r.mountainName}をてくてく`)}</h3>
        ${r.body ? `<p class="log-excerpt">${esc(r.body.replace(/\s+/g," "))}</p>` : ""}
        <div class="log-meta">
          ${r.route ? `<span>${esc(r.route)}</span>` : ""}
          ${r.time ? `<span>${esc(r.time)}</span>` : ""}
          ${r.weather ? `<span>${esc(r.weather)}</span>` : ""}
        </div>
        <div class="log-more">読む →</div>
      </div>
    </article>`;
  }).join("")
    : `<p class="log-empty">まだ日記がありません。</p>`;
  $("logNote").textContent = note || `日記は、登った日から ${CFG.recordDelayDays||0} 日たってから表示されます。`;
}

const logsEl = $("logs");
logsEl.addEventListener("click", e => { const a = e.target.closest("[data-diary]"); if (a) openDiary(a.dataset.diary); });
logsEl.addEventListener("keydown", e => { const a = e.target.closest("[data-diary]"); if (a && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); openDiary(a.dataset.diary); }});

/* ---------- 日記を読む画面 ---------- */
const dlg = $("diaryDlg");
function memoHTML(m){
  const x = m.memo; if (!x) return "";
  const rows = MEMO_ROWS.filter(([k]) => x[k]).map(([k,l]) => `<dt>${l}</dt><dd>${esc(x[k])}</dd>`).join("");
  return `<div class="memo">
    <div class="memo-head">${mascotImg() || `<span class="pen">✎</span>`}<span>てくてくメモ</span>${x.sample?`<span class="sample">見本</span>`:""}</div>
    ${x.tip ? `<div style="font-family:var(--hand);font-weight:600;font-size:16px;line-height:1.6;margin-bottom:${rows?"8px":"0"}">${esc(x.tip)}</div>` : ""}
    ${rows ? `<dl>${rows}</dl>` : ""}
    ${x.updated ? `<div class="upd">${esc(x.updated.replace(/-/g,"."))} 更新</div>` : ""}
  </div>`;
}
function openDiary(key, fromHash){
  const r = LOGS.find(x => x.key === key); if (!r) return;
  const g = r.mountain ? r.mountain.g : ["#2f5b45","#183128"];
  let media = "";
  if (r.yt){
    media = location.protocol === "file:"
      ? `<a href="https://www.youtube.com/watch?v=${r.yt}" target="_blank" rel="noopener" class="yt-play" style="background-image:url('https://i.ytimg.com/vi/${r.yt}/hqdefault.jpg')"><span class="pb"></span></a>`
      : `<iframe src="https://www.youtube-nocookie.com/embed/${r.yt}?rel=0" title="YouTube 動画" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  } else {
    media = `<div class="noimg">${esc(r.mountain ? r.mountain.en : "SANPO")}</div>`;
  }
  $("dlgBody").innerHTML = `
    <div class="dlg-media" style="${gvars(g)}">${media}</div>
    <div class="dlg-body">
      <div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap">
        <span class="dlg-date">${fmtDate(r.date)}</span>
        <span class="log-mtn">${esc(r.mountainName)}</span>
        ${r.sample ? `<span class="sample">見本</span>` : ""}
      </div>
      <h2 class="dlg-title" id="dlgTitle">${esc(r.title || `${r.mountainName}をてくてく`)}</h2>
      <div class="log-meta">
        ${r.route ? `<span>${esc(r.route)}</span>` : ""}
        ${r.time ? `<span>歩いた時間 ${esc(r.time)}</span>` : ""}
        ${r.weather ? `<span>${esc(r.weather)}</span>` : ""}
        ${r.way ? `<span>${/車/.test(r.way) ? "🚗" : "🚃"} ${esc(r.way)}</span>` : ""}
      </div>
      ${r.body ? `<div class="dlg-text">${paras(r.body)}</div>` : ""}
      ${r.mountain ? memoHTML(r.mountain) : ""}
      <div class="dlg-foot">
        ${r.yamap ? `<a class="lk yamap" href="${esc(r.yamap)}" target="_blank" rel="noopener">YAMAPで見る ↗</a>` : ""}
        ${r.youtube ? `<a class="lk yt" href="${esc(r.youtube)}" target="_blank" rel="noopener">YouTubeで見る ↗</a>` : ""}
        ${r.mountain ? `<button type="button" class="lk plain" data-goto="${r.mountain.id}">${esc(r.mountain.name)}のルートを見る →</button>` : ""}
        <button type="button" class="lk plain" data-copy>リンクをコピー</button>
      </div>
    </div>`;
  if (!fromHash) history.replaceState(null, "", `#diary/${key}`);
  if (!dlg.open) dlg.showModal();
  dlg.querySelector(".dlg-inner").scrollTop = 0;
}
function closeDiary(){ if (dlg.open) dlg.close(); }
dlg.addEventListener("close", () => {
  $("dlgBody").innerHTML = "";   // 動画を止める
  if (location.hash.startsWith("#diary/")) history.replaceState(null, "", location.pathname + location.search + "#diary");
});
$("dlgClose").onclick = closeDiary;
dlg.addEventListener("click", e => {
  if (e.target === dlg) { closeDiary(); return; }
  const go = e.target.closest("[data-goto]");
  if (go){ closeDiary(); jumpTo(go.dataset.goto); return; }
  const cp = e.target.closest("[data-copy]");
  if (cp){
    const url = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => { cp.textContent = "コピーしました"; cp.classList.add("copied"); })
      .catch(() => { prompt("このリンクをコピーしてください", url); });
  }
});
function openFromHash(){
  const m = location.hash.match(/^#diary\/(.+)$/);
  if (m) openDiary(decodeURIComponent(m[1]), true);
}
addEventListener("hashchange", openFromHash);

/* ============================================================
   山のカード
   ============================================================ */
function seeded(str){ let h=2166136261; for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return ()=>((h=Math.imul(h^h>>>15,2246822507)>>>0)%1000)/1000; }
function ridgeSVG(m){
  const r = seeded(m.id), peakX = 120 + r()*160;
  const layer = (base, amp, peak, fill, op) => {
    let d = `M0 ${base}`;
    for (let x=0; x<=400; x+=25){
      const near = Math.max(0, 1 - Math.abs(x-peakX)/150);
      d += ` L${x} ${(base - near*peak - r()*amp).toFixed(1)}`;
    }
    return `<path d="${d} L400 150 L0 150Z" style="fill:${fill}" opacity="${op}"/>`;
  };
  // 奥の稜線ほど淡く、手前ほど濃く（空気遠近法）
  return `<svg viewBox="0 0 400 150" preserveAspectRatio="none" aria-hidden="true">
    ${layer(110,18,40,tint(m.g[0],.55),.55)}${layer(130,14,70,tint(m.g[0],.38),.55)}${layer(150,10,20,"var(--panel)",1)}</svg>`;
}

function routeHTML(route){
  return `<ol class="route" aria-label="東京駅からの行き方">${route.map(([s,t],k) => k%2===0
    ? `<li>${esc(s)}</li>` : `<li class="ride">↓ ${esc(s)}<em>${esc(t)}</em></li>`).join("")}</ol>`;
}
function pathHTML(path){
  return `<div class="path">${path.map((p,k) => {
    const cls = PEAK_NAMES.has(p) ? "pk" : (k===0||k===path.length-1) ? "ed" : "";
    return (k?"<i></i>":"") + `<span class="${cls}">${esc(p)}</span>`;
  }).join("")}</div>`;
}
/* ---------- Google マップ（API キー不要のリンク） ---------- */
const gq = s => encodeURIComponent(String(s||"").replace(/（.*?）|\(.*?\)/g," ").replace(/\s+/g," ").trim());
const gPlace = q => `https://www.google.com/maps/search/?api=1&query=${gq(q)}`;
const gDir = (dest, how) => `https://www.google.com/maps/dir/?api=1&origin=${gq(CFG.origin||"東京駅")}&destination=${gq(dest)}&travelmode=${how}`;
function mapsHTML(m, c){
  const route = c.route || m.route;
  const trail = route[route.length-1][0];
  const goal = c.path[c.path.length-1];
  const geo = (TEKU.geo||{})[m.id];
  const btn = (href, label) => `<a class="mp" href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;
  const out = [];
  const car = carOf(m, c);
  if (mode === "car" && car && car.parking){
    out.push(btn(gPlace(`${car.parking} ${m.pref}`), "🅿 駐車場"));
    out.push(btn(gDir(`${car.parking} ${m.pref}`, "driving"), "🧭 東京駅から車で"));
  } else {
    out.push(btn(gPlace(`${trail} ${m.pref}`), "📍 登山口"));
    out.push(btn(gDir(`${trail} ${m.pref}`, mode === "car" ? "driving" : "transit"), mode === "car" ? "🧭 東京駅から車で" : "🧭 東京駅から電車で"));
  }
  if (goal && goal !== trail && c.type === "縦走") out.push(btn(gPlace(`${goal} ${m.pref}`), "🏁 下山口"));
  if (geo) out.push(btn(`https://www.google.com/maps/search/?api=1&query=${geo[0]},${geo[1]}`, "⛰ 山頂"));
  return `<div class="maps"><span class="sub" style="margin:0">GOOGLE MAPS</span>${out.join("")}</div>`;
}

function carText(m, c){
  const car = carOf(m, c);
  if (!car) return "";
  return [car.min ? `東京駅から約${fmtH(car.min)}` : car.time, car.via, car.parking, car.note].filter(Boolean).join(" ・ ");
}
function panelHTML(m, c){
  const access = accessOf(m, c);
  const route = c.route || m.route;
  const others = c.peaks.length > 1 ? `<div class="peaks">この道で登れる山：${c.peaks.map(id =>
      `<button type="button" data-goto="${id}" data-course="${c.id}" ${id===m.id?"disabled":""}>${esc(byId[id].name)}</button>`).join("")}</div>` : "";
  const back = c.back || (c.type==="縦走" ? "" : "登山口に戻るので、帰りは行きと同じ道で帰れます。");
  const suit = c.type==="縦走" ? "🚃 電車・バス向き" : "🚗 車でも行きやすい";
  const car = carText(m, c);
  return `
    <div class="cp-head">
      <h4>${esc(c.name)}${c.lift?`<span class="lift">🚡 乗り物を使う</span>`:""}</h4>
      <div class="right"><span class="tb" data-t="${c.type}">${c.type}</span><span class="suit">${suit}</span></div>
    </div>
    <div class="c-kpi">
      <div><b>${access ? fmtH(access) : "–"}</b><span>${mode==="car"?"🚗":"🚃"} 東京駅から</span></div>
      <div><b>${c.walk ? fmtH(c.walk) : "–"}</b><span>歩く時間</span></div>
      <div><b>${c.dist ? c.dist+"km" : "–"}</b><span>歩く距離</span></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="sub" style="margin:0">COURSE — 歩く道</span><span class="lv" data-lv="${c.lv}"><i></i><i></i><i></i>${LV[c.lv]}</span></div>
    ${pathHTML(c.path)}
    ${others}
    ${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
    <div class="access">
      <div><div class="sub">ACCESS — 行き方</div>${routeHTML(route)}</div>
      ${back ? `<div class="back"><b>帰り</b><span>${esc(back)}</span></div>` : ""}
      ${car ? `<div class="back car"><b>車</b><span>${esc(car)}</span></div>` : ""}
    </div>
    ${mapsHTML(m, c)}`;
}

const state = {region:"すべて", pref:"すべて", lv:0, type:"すべて", sort:"access"};
const selected = {};
const cardsEl = $("cards");
const matches = c => (!state.lv || c.lv===state.lv) && (state.type==="すべて" || c.type===state.type);

function chips(el, items, key, st, onChange){
  el.innerHTML = items.map(([v,l]) => `<button class="chip${String(st[key])===String(v)?" on":""}" data-v="${esc(v)}">${esc(l)}</button>`).join("");
  el.onclick = e => {
    const b = e.target.closest(".chip"); if (!b) return;
    st[key] = typeof st[key] === "number" ? Number(b.dataset.v) : b.dataset.v;
    [...el.children].forEach(c => c.classList.toggle("on", c===b));
    onChange();
  };
}
const regions = sortBy([...new Set(MOUNTAINS.map(m=>m.region||"関東"))], REGION_ORDER);
function buildPrefChips(){
  const prefs = sortBy([...new Set(MOUNTAINS.filter(m => state.region==="すべて" || m.region===state.region).map(m=>m.pref))], PREF_ORDER);
  if (state.pref!=="すべて" && !prefs.includes(state.pref)) state.pref = "すべて";
  chips($("prefChips"), [["すべて","すべて"], ...prefs.map(p=>[p,p])], "pref", state, render);
}
$("regionGroup").hidden = regions.length < 2;
chips($("regionChips"), [["すべて","すべて"], ...regions.map(r=>[r,r])], "region", state, () => { buildPrefChips(); render(); });
buildPrefChips();
chips($("lvChips"), [[0,"すべて"],[1,"初級"],[2,"中級"],[3,"上級"]], "lv", state, render);
chips($("typeChips"), [["すべて","すべて"], ...TYPES.map(t=>[t,t])], "type", state, render);
$("sort").onchange = e => { state.sort = e.target.value; render(); };

function cardHTML(m, i){
  const filtered = m.courses.filter(matches);
  let sel = m.courses.find(c=>c.id===selected[m.id]);
  if (!sel || !matches(sel)) sel = filtered[0] || m.courses[0];
  selected[m.id] = sel.id;
  const months = Array.from({length:12},(_,k)=>{
    const n=k+1, cl = m.best.includes(n)?"best":m.ok.includes(n)?"ok":"";
    return `<i class="${cl}">${n}</i>`;
  }).join("");
  const nTrav = m.courses.filter(c=>c.type==="縦走").length;
  const tabs = m.courses.map(c => `<button type="button" role="tab" class="ctab${c.id===sel.id?" on":""}${matches(c)?"":" dim"}" data-c="${c.id}" aria-selected="${c.id===sel.id}">
      <span class="tb" data-t="${c.type}">${c.type}</span><span class="cn">${esc(c.name)}</span><span class="ct">${c.walk?fmtH(c.walk):"–"} · ${c.dist||"–"}KM</span></button>`).join("");
  const mylog = m.logs.length ? `<div class="c-mylog"><div class="sub">てくてく日記</div>${m.logs.slice(0,3).map(r =>
      `<button type="button" data-diary="${r.key}"><b>${fmtDate(r.date)}</b><span>${esc(r.title||r.route||"日記を読む")}</span>${r.yt?`<span class="yt-mini">▶ 動画</span>`:""}</button>`).join("")}</div>` : "";
  const badges = [
    m.logs.length ? `<span class="done-badge">✓ 登った${m.logs.length>1?` ×${m.logs.length}`:""}</span>` : "",
    m.memo ? `<span class="memo-badge">✎ メモ</span>` : "",
  ].join("");
  return `<article class="card" id="m-${m.id}" data-m="${m.id}" style="${gvars(m.g)}">
    <div class="c-top">${ridgeSVG(m)}
      <span class="c-no">No.${String(i+1).padStart(2,"0")}</span>
      <span class="c-elev">${m.elev.toLocaleString()}<small>m</small></span>
      ${badges ? `<div class="badges">${badges}</div>` : ""}
    </div>
    <div class="c-body">
      <div class="c-meta"><span>${esc(m.region||"")} ・ ${esc(m.pref)}</span><span class="ccount"><b>${m.courses.length}</b>コース${nTrav?`（縦走 ${nTrav}）`:""}</span></div>
      <h3 class="c-name">${esc(m.name)}<span>${esc(m.en)}</span></h3>
      ${memoHTML(m)}
      <p class="c-desc">${esc(m.desc)}</p>
      ${WX.ready && WX.data[m.id] ? `<div class="c-wx"><span class="sub" style="background:none;border:0;padding:0;margin:0">天気の目安</span>${WX.days.map(d => { const w = WX.data[m.id][d.key]; return w ? `<span title="${esc(w.text)}">${esc(d.label)} <b>${w.icon}</b></span>` : ""; }).join("")}</div>` : ""}
      ${mylog}
      <div class="ctabs" role="tablist" aria-label="${esc(m.name)}の登山ルート">${tabs}</div>
      <div class="cpanel" role="tabpanel">${panelHTML(m, sel)}</div>
      <div><div class="sub">SEASON — 黄緑がおすすめの時期</div><div class="months">${months}</div></div>
      <div class="tags">${m.tags.map(t=>`<span>#${esc(t)}</span>`).join("")}</div>
      <button type="button" class="c-voice" data-voice="${m.id}">✉ この山について意見を送る</button>
    </div>
  </article>`;
}

cardsEl.addEventListener("click", e => {
  const tab = e.target.closest(".ctab");
  if (tab){
    const card = tab.closest(".card"), m = byId[card.dataset.m];
    const c = m.courses.find(x=>x.id===tab.dataset.c);
    selected[m.id] = c.id;
    card.querySelectorAll(".ctab").forEach(t => { const on = t===tab; t.classList.toggle("on", on); t.setAttribute("aria-selected", on); });
    card.querySelector(".cpanel").innerHTML = panelHTML(m, c);
    return;
  }
  const dy = e.target.closest("[data-diary]");
  if (dy){ openDiary(dy.dataset.diary); return; }
  const vo = e.target.closest("[data-voice]");
  if (vo){ openVoice(vo.dataset.voice); return; }
  const go = e.target.closest("[data-goto]");
  if (go) jumpTo(go.dataset.goto, go.dataset.course);
});

const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); }
}), {threshold:.05});

function render(){
  let list = MOUNTAINS.map((m,i)=>({m,i}))
    .filter(({m}) => (state.region==="すべて"||m.region===state.region) && (state.pref==="すべて"||m.pref===state.pref) && m.courses.some(matches));
  const mine = m => (m.logs.length?2:0) + (m.memo?1:0);
  const s = {
    access:(a,b)=>accessOf(a.m)-accessOf(b.m),
    elev:(a,b)=>b.m.elev-a.m.elev,
    time:(a,b)=>a.m.minWalk-b.m.minWalk,
    courses:(a,b)=>b.m.courses.length-a.m.courses.length,
    done:(a,b)=>mine(b.m)-mine(a.m) || accessOf(a.m)-accessOf(b.m),
  }[state.sort];
  list.sort(s);
  $("count").textContent = `${list.length} / ${MOUNTAINS.length}`;
  cardsEl.innerHTML = list.length ? list.map(({m,i})=>cardHTML(m,i)).join("")
    : `<p class="empty">条件に合う山がありません。条件を変えてみてください。</p>`;
  cardsEl.querySelectorAll(".card").forEach((c,k) => { c.style.transitionDelay = `${Math.min(k,6)*50}ms`; io.observe(c); });
  if (reduce) cardsEl.querySelectorAll(".card").forEach(c=>c.classList.add("in"));
}

function resetFilters(){
  Object.assign(state, {region:"すべて", pref:"すべて", lv:0, type:"すべて"});
  document.querySelectorAll("#regionChips .chip,#lvChips .chip,#typeChips .chip").forEach(c=>c.classList.toggle("on", c.dataset.v==="すべて"||c.dataset.v==="0"));
  buildPrefChips();
}
function jumpTo(mid, cid){
  const c = cid && COURSES.find(x=>x.id===cid);
  if (!$("m-"+mid) || (c && !matches(c))) resetFilters();
  if (c) selected[mid] = cid;
  render();
  const card = $("m-"+mid);
  card.classList.add("in"); card.style.transitionDelay = "0ms";
  card.scrollIntoView({behavior: reduce?"auto":"smooth", block:"start"});
  card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash");
  const on = card.querySelector(".ctab.on"); if (on) on.scrollIntoView({block:"nearest", inline:"center"});
}

/* ============================================================
   縦走ルート
   ============================================================ */
const tstate = {lv:0, pk:"all"};
chips($("travLv"), [[0,"すべて"],[1,"初級"],[2,"中級"],[3,"上級"]], "lv", tstate, renderTrav);
chips($("travPk"), [["all","すべて"],["multi","2つ以上の山をつなぐ"]], "pk", tstate, renderTrav);
const travAll = COURSES.filter(c => c.type==="縦走" || c.peaks.length>1);
function renderTrav(){
  const list = travAll.filter(c => (!tstate.lv||c.lv===tstate.lv) && (tstate.pk==="all"||c.peaks.length>1))
    .sort((a,b)=>a.walk-b.walk);
  $("travList").innerHTML = list.map(c => {
    const pk = c.path.filter(p=>PEAK_NAMES.has(p));
    const line = [c.path[0], ...pk, c.path[c.path.length-1]].map((p,k)=> (k?'<span class="sep"></span>':'') + `<span class="${PEAK_NAMES.has(p)?"pk":""}">${esc(p)}</span>`).join("");
    const title = c.name.includes("縦走")||c.name.includes("→") ? c.name : `${byId[c.home].name}：${c.name}`;
    return `<button type="button" class="trav" data-goto="${c.home}" data-course="${c.id}">
      <div class="trav-time"><b>${fmtH(c.walk)}</b><span>歩く時間</span></div>
      <div>
        <h3>${esc(title)} <span class="tb" data-t="${c.type}">${c.type}</span>${c.peaks.length>1?`<span class="tb" style="color:var(--accent)">${c.peaks.length}座</span>`:""}</h3>
        <div class="trav-line">${line}</div>
      </div>
      <div class="trav-side"><b>${c.dist}km</b><span class="lv" data-lv="${c.lv}"><i></i><i></i><i></i>${LV[c.lv]}</span></div>
    </button>`;
  }).join("") || `<p class="empty">条件に合うルートがありません。</p>`;
}
$("travList").addEventListener("click", e => {
  const b = e.target.closest("[data-goto]"); if (b) jumpTo(b.dataset.goto, b.dataset.course);
});

/* ============================================================
   ACCESS RADAR
   ============================================================ */
const svg = $("radarSvg");
const CX = 300, MAXMIN = 210, RR = 260;
const rad = min => Math.min(min, MAXMIN) / MAXMIN * RR;
function drawRadar(){
  let out = `<defs><linearGradient id="swl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--accent);stop-opacity:0"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:.18"/></linearGradient></defs>`;
  out += `<g class="sweep"><path d="M${CX} ${CX} L${CX} ${CX-RR} A${RR} ${RR} 0 0 1 ${CX+RR*Math.sin(Math.PI/5)} ${CX-RR*Math.cos(Math.PI/5)} Z" fill="url(#swl)"/></g>`;
  [60,120,180].forEach(t => {
    out += `<circle class="ring" cx="${CX}" cy="${CX}" r="${rad(t)}"/>`;
    out += `<text class="ring-label" x="${CX+4}" y="${CX-rad(t)-6}">${t/60}H</text>`;
  });
  out += `<circle class="ring" cx="${CX}" cy="${CX}" r="${RR}" style="stroke:var(--line-2)"/>`;
  [0,45,90,135].forEach(a => {
    const x = Math.sin(a*Math.PI/180)*RR, y = -Math.cos(a*Math.PI/180)*RR;
    out += `<line class="axis" x1="${CX-x}" y1="${CX-y}" x2="${CX+x}" y2="${CX+y}"/>`;
  });
  [["N",0],["E",90],["S",180],["W",270]].forEach(([l,a]) => {
    out += `<text class="compass" x="${CX+Math.sin(a*Math.PI/180)*(RR+22)}" y="${CX-Math.cos(a*Math.PI/180)*(RR+22)+6}" text-anchor="middle">${l}</text>`;
  });
  // 点は (0,0) に描いて、位置は transform で動かす（電車↔車で山がすっと動く）
  MOUNTAINS.forEach(m => {
    const col = lvColor(m.minLv);
    out += `<g class="dot" data-id="${m.id}" tabindex="0" role="button" aria-label="${esc(m.name)}">
      <circle r="16" fill="${col}" opacity=".12"/>
      ${m.logs.length ? `<circle class="done" r="11"/>` : ""}
      <polyline stroke="${col}" stroke-opacity=".5" fill="none" points="0,0 0,0"/>
      <circle class="sunring" r="10"/>
      <circle class="core" r="6" fill="${col}"/>
      <text>${esc(m.name)}</text>
    </g>`;
  });
  out += `<circle class="hub" cx="${CX}" cy="${CX}" r="7"/><circle cx="${CX}" cy="${CX}" r="14" fill="none" style="stroke:var(--accent)" opacity=".4"/>
    <text class="hub-label" x="${CX}" y="${CX+30}" text-anchor="middle">${esc(CFG.origin||"東京駅")}</text>`;
  svg.innerHTML = out;
  placeDots(false);
  applyWxRadar();
}

function radarLayout(){
  const pts = MOUNTAINS.map(m => {
    const a = m.bearing*Math.PI/180, r = rad(accessOf(m));
    const x = CX + Math.sin(a)*r, y = CX - Math.cos(a)*r;
    const left = Math.sin(a) < -0.1;
    return {m, x, y, left, ly:y, lx: x + (left?-14:14), w: m.name.length*13};
  });
  for (let it=0; it<80; it++){
    let moved = false;
    for (const p of pts) for (const q of pts){
      if (p===q || p.left!==q.left) continue;
      const px0 = p.left ? p.lx-p.w : p.lx, px1 = p.left ? p.lx : p.lx+p.w;
      const qx0 = q.left ? q.lx-q.w : q.lx, qx1 = q.left ? q.lx : q.lx+q.w;
      if (px1 < qx0 || qx1 < px0) continue;
      const d = p.ly - q.ly;
      if (Math.abs(d) < 16){ const s = (16-Math.abs(d))/2 + .1; if (d>=0){p.ly+=s;q.ly-=s;} else {p.ly-=s;q.ly+=s;} moved = true; }
    }
    if (!moved) break;
  }
  return pts;
}

let moveTimer = 0;
function placeDots(animate){
  const pts = radarLayout();
  svg.classList.toggle("noanim", !animate || reduce);
  if (animate && !reduce){ svg.classList.add("moving"); clearTimeout(moveTimer); moveTimer = setTimeout(() => svg.classList.remove("moving"), 850); }
  pts.forEach(p => {
    const g = svg.querySelector(`.dot[data-id="${p.m.id}"]`); if (!g) return;
    g.style.transform = `translate(${p.x}px, ${p.y}px)`;
    const dx = p.lx - p.x, dy = p.ly - p.y;
    const t = g.querySelector("text");
    t.setAttribute("x", dx); t.setAttribute("y", dy + 4);
    t.setAttribute("text-anchor", p.left ? "end" : "start");
    const pl = g.querySelector("polyline");
    pl.setAttribute("points", Math.abs(dy) > 3 ? `${p.left?-6:6},0 ${dx + (p.left?4:-4)},${dy}` : "0,0 0,0");
  });
  if (!animate) requestAnimationFrame(() => svg.classList.remove("noanim"));
}

/* ---------- 切り替えボタン ---------- */
function setMode(next, animate){
  mode = next;
  try { localStorage.setItem("teku-mode", mode); } catch {}
  document.querySelectorAll("[data-mode-switch]").forEach(sw => {
    sw.dataset.mode = mode;
    sw.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-checked", b.dataset.mode === mode));
  });
  $("modeNote").textContent = mode === "car"
    ? "車の時間は、東京駅から登山口の駐車場までの目安です（渋滞なし）。縦走は駐車場に戻りにくいので、往復・周回のルートがおすすめです。"
    : "電車の時間は、東京駅から登山口までの電車とバスの目安です。乗り継ぎによって変わります。";
  if (svg.querySelector(".dot")) placeDots(animate);
  if (WX.ready) renderSky();
  showInfo(currentInfo);
  if (animate) render();
}
document.querySelectorAll("[data-mode-switch]").forEach(sw => sw.addEventListener("click", e => {
  const b = e.target.closest("[data-mode]");
  if (b && b.dataset.mode !== mode) setMode(b.dataset.mode, true);
}));

const info = $("radarInfo");
let currentInfo = MOUNTAINS[0].id;
function showInfo(id){
  currentInfo = id;
  const m = byId[id];
  svg.querySelectorAll(".dot").forEach(d=>d.classList.toggle("on", d.dataset.id===id));
  const counts = TYPES.map(t => [t, m.courses.filter(c=>c.type===t).length]).filter(([,n])=>n);
  const memoLine = m.memo && (m.memo.tip || m.memo.good);
  info.innerHTML = `<div class="ri-pref">${esc(m.region||"")} ・ ${esc(m.pref)} ・ ${lvText(m.minLv,m.maxLv)}</div>
    <h3>${esc(m.name)}${m.logs.length?`<span class="done-badge">✓ 登った</span>`:""}</h3>
    <div class="ri-elev">${m.elev.toLocaleString()}M ・ ${mode==="car"?"🚗":"🚃"} 東京駅から ${fmtH(accessOf(m))} ・ ${m.courses.length}コース</div>
    ${mode==="car" && m.car ? `<dl class="ri-car">
        ${m.car.via ? `<dt>道</dt><dd>${esc(m.car.via)}</dd>` : ""}
        ${m.car.parking ? `<dt>駐車場</dt><dd>${esc(m.car.parking)}</dd>` : ""}
        ${m.car.note ? `<dt>ひとこと</dt><dd>${esc(m.car.note)}</dd>` : ""}
      </dl>` : ""}
    ${wxOf(m.id) ? `<div class="c-wx" style="margin-top:12px"><span>${esc(WX.days.find(d=>d.key===WX.sel).label)}の天気（目安） <b>${wxOf(m.id).icon} ${esc(wxOf(m.id).text)}</b></span></div>` : ""}
    ${memoLine ? `<div class="ri-memo">${mascotImg() || "✎"}<span>${esc(memoLine)}</span></div>` : `<p>${esc(m.desc)}</p>`}
    <div class="ri-courses">${counts.map(([t,n])=>`<span class="tb" data-t="${t}">${t} ${n}</span>`).join("")}</div>
    <a class="btn" href="#m-${m.id}" data-jump="${m.id}">ルートを見る →</a>`;
}
svg.addEventListener("click", e => { const d = e.target.closest(".dot"); if (d) showInfo(d.dataset.id); });
svg.addEventListener("keydown", e => { const d = e.target.closest(".dot"); if (d && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); showInfo(d.dataset.id); }});
info.addEventListener("click", e => {
  const a = e.target.closest("[data-jump]"); if (!a) return;
  e.preventDefault(); jumpTo(a.dataset.jump);
});

/* ============================================================
   晴れそうな山の候補（Open-Meteo の一般向け予報。目安）
   ============================================================ */
function wxOf(id){ return WX.ready && WX.data[id] ? WX.data[id][WX.sel] : null; }
function applyWxRadar(){
  svg.querySelectorAll(".dot").forEach(g => {
    const w = wxOf(g.dataset.id);
    g.classList.toggle("wx-sun", !!w && w.cat === "sun");
    g.classList.toggle("wx-bad", !!w && (w.cat === "rain" || w.cat === "wind"));
  });
}
const WX_CAT = {
  sun:  {icon:"☀", title:"晴れ間が多そう"},
  cloud:{icon:"☁", title:"くもりがち"},
  wind: {icon:"💨", title:"風が強そう"},
  rain: {icon:"☂", title:"雨が心配"},
};
const jstKey = d => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Tokyo"}).format(d);
function buildDays(){
  const days = [], WD = ["日","月","火","水","木","金","土"];
  for (let i=0; i<7; i++){
    const d = new Date(Date.now() + i*864e5), key = jstKey(d);
    const [y,mo,da] = key.split("-").map(Number);
    const wd = new Date(y, mo-1, da).getDay();
    const label = i===0 ? "今日" : i===1 ? "明日" : (wd===6 ? "土曜" : wd===0 ? "日曜" : "");
    if (label && !days.some(x=>x.key===key)) days.push({key, label, sub:`${mo}/${da}（${WD[wd]}）`});
  }
  return days;
}
function summarize(h, dayKey){
  const idx = h.time.map((t,i)=>[t,i]).filter(([t]) => t.startsWith(dayKey) && +t.slice(11,13) >= 6 && +t.slice(11,13) <= 15).map(([,i])=>i);
  if (!idx.length) return null;
  const avg = a => a.reduce((s,v)=>s+(v||0),0) / a.length;
  const pick = k => idx.map(i => h[k] ? h[k][i] : 0);
  const pp = avg(pick("precipitation_probability")), ppMax = Math.max(...pick("precipitation_probability"));
  const cc = avg(pick("cloud_cover")), gust = Math.max(...pick("wind_gusts_10m"));
  const rain = pick("precipitation").reduce((s,v)=>s+(v||0),0);
  const thunder = pick("weather_code").some(c => c >= 95);
  let cat;
  if (thunder || pp >= 50 || rain >= 3) cat = "rain";
  else if (gust >= 15) cat = "wind";
  else if (cc < 50 && ppMax < 30) cat = "sun";
  else cat = "cloud";
  const score = pp*1.2 + cc*0.5 + Math.max(0, gust-8)*4 + (thunder?50:0) + rain*5;
  const text = `${WX_CAT[cat].title}・雨${Math.round(pp)}%・風${Math.round(gust)}m/s${thunder?"・雷":""}`;
  return {cat, icon:WX_CAT[cat].icon, text, pp, gust, score};
}
async function loadWeather(){
  WX.days = buildDays(); WX.sel = WX.days[0].key;
  const list = MOUNTAINS.filter(m => (TEKU.geo||{})[m.id]);
  let raw = null;
  try { const c = JSON.parse(sessionStorage.getItem("teku-wx")||"null"); if (c && Date.now()-c.t < 30*60e3 && c.n === list.length) raw = c.raw; } catch {}
  if (!raw){
    const p = new URLSearchParams({
      latitude: list.map(m=>TEKU.geo[m.id][0]).join(","),
      longitude: list.map(m=>TEKU.geo[m.id][1]).join(","),
      elevation: list.map(m=>m.elev).join(","),
      hourly: "weather_code,precipitation_probability,precipitation,cloud_cover,wind_gusts_10m",
      timezone: "Asia/Tokyo", forecast_days: "7", wind_speed_unit: "ms",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
    if (!res.ok) throw new Error(res.status);
    raw = await res.json();
    if (!Array.isArray(raw)) raw = [raw];
    try { sessionStorage.setItem("teku-wx", JSON.stringify({t:Date.now(), n:list.length, raw})); } catch {}
  }
  list.forEach((m,i) => {
    const h = raw[i] && raw[i].hourly; if (!h) return;
    WX.data[m.id] = Object.fromEntries(WX.days.map(d => [d.key, summarize(h, d.key)]).filter(([,v]) => v));
  });
  WX.ready = true;
}
function renderSky(){
  $("skyDays").innerHTML = WX.days.map(d => `<button type="button" data-day="${d.key}" aria-pressed="${d.key===WX.sel}"><b>${esc(d.label)}</b>${esc(d.sub)}</button>`).join("");
  const rows = MOUNTAINS.map(m => ({m, w: wxOf(m.id)})).filter(x => x.w).sort((a,b) => a.w.score - b.w.score);
  const group = (cats, title, cls) => {
    const items = rows.filter(x => cats.includes(x.w.cat));
    return `<div class="sky-g ${cls}"><h3>${title}<span class="n">${items.length}</span></h3>${items.length ? `<ul>${items.map(({m,w}) =>
      `<li><button type="button" data-goto="${m.id}"><span>${w.icon} ${esc(m.name)}</span><span class="wx">雨${Math.round(w.pp)}%・風${Math.round(w.gust)}m/s</span><span class="tm">${mode==="car"?"🚗":"🚃"}${fmtH(accessOf(m))}</span></button></li>`).join("")}</ul>` : `<p class="none">なし</p>`}</div>`;
  };
  $("skyBody").innerHTML = `<div class="sky-groups">
    ${group(["sun"], "☀ 晴れ間が多そう", "is-sun")}
    ${group(["cloud"], "☁ くもりがち", "")}
    ${group(["rain","wind"], "☂ 雨や風が心配", "")}
  </div>`;
}
$("skyLinks").innerHTML = `<span class="sub" style="margin:0">行く前は、山専門の天気予報で確認</span>` +
  (CFG.weatherLinks||[]).map(l => `<a class="mp" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ↗</a>`).join("");
$("skyDays").addEventListener("click", e => {
  const b = e.target.closest("[data-day]"); if (!b) return;
  WX.sel = b.dataset.day; renderSky(); applyWxRadar(); showInfo(currentInfo);
});
$("skyBody").addEventListener("click", e => { const b = e.target.closest("[data-goto]"); if (b) jumpTo(b.dataset.goto); });
loadWeather()
  .then(() => { renderSky(); applyWxRadar(); showInfo(currentInfo); render(); })
  .catch(() => { $("skyBody").innerHTML = `<p class="sky-loading">天気を読み込めませんでした。時間をおいて開き直してください。</p>`; });

/* ============================================================
   ご意見募集（Supabase に送る。読むことはできない設定）
   ============================================================ */
const vForm = $("voiceForm"), vMsg = $("vMessage"), vStatus = $("vStatus"), vSend = $("vSend");
$("vMountain").insertAdjacentHTML("beforeend",
  MOUNTAINS.map(m => `<option value="${esc(m.name)}">${esc(m.name)}（${esc(m.pref)}）</option>`).join("") +
  `<option value="その他の山">その他の山</option>`);
const updCount = () => { $("vCount").textContent = `${vMsg.value.length} / 2000`; };
vMsg.addEventListener("input", updCount);

function openVoice(mid){
  const m = byId[mid];
  if (m) $("vMountain").value = m.name;
  $("voice").scrollIntoView({behavior: reduce?"auto":"smooth", block:"start"});
  setTimeout(() => vMsg.focus({preventScroll:true}), reduce ? 0 : 600);
}

vForm.addEventListener("submit", async e => {
  e.preventDefault();
  const fd = new FormData(vForm);
  const message = String(fd.get("message")||"").trim();
  vStatus.className = "v-status";
  if (fd.get("website")) { vStatus.textContent = "送りました。ありがとうございます！"; vStatus.classList.add("ok"); return; } // 機械の送信は捨てる
  if (message.length < 2){ vStatus.textContent = "ご意見を書いてから送ってください。"; vStatus.classList.add("ng"); vMsg.focus(); return; }
  let last = 0; try { last = +localStorage.getItem("teku-voice-at") || 0; } catch {}
  if (Date.now() - last < 30000){ vStatus.textContent = "少し時間をおいてから、もう一度送ってください。"; vStatus.classList.add("ng"); return; }
  const fb = CFG.feedback || {};
  if (!fb.url || !fb.key){ vStatus.textContent = "いまは送れません。"; vStatus.classList.add("ng"); return; }

  vSend.disabled = true; vSend.textContent = "送っています…";
  try {
    const res = await fetch(`${fb.url}/rest/v1/feedback`, {
      method: "POST",
      headers: {"apikey": fb.key, "Content-Type": "application/json", "Prefer": "return=minimal"},
      body: JSON.stringify({
        category: fd.get("category") || "その他",
        message: message.slice(0, 2000),
        nickname: String(fd.get("nickname")||"").trim().slice(0, 40) || null,
        mountain: fd.get("mountain") || null,
        page: (location.pathname + location.hash).slice(0, 200),
      }),
    });
    if (!res.ok) throw new Error(res.status);
    try { localStorage.setItem("teku-voice-at", String(Date.now())); } catch {}
    vForm.reset(); updCount();
    vStatus.textContent = "送りました。ありがとうございます！ てくてく読ませてもらいます。";
    vStatus.classList.add("ok");
  } catch(err){
    vStatus.textContent = "うまく送れませんでした。時間をおいて、もう一度試してください。";
    vStatus.classList.add("ng");
  } finally {
    vSend.disabled = false; vSend.textContent = "送る →";
  }
});

/* ---------- はじめに描く ---------- */
render();
renderTrav();
drawRadar();
setMode(mode, false);
loadLogs();

})();
