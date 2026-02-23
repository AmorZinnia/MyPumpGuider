/* Pump Chart Vault
   - LocalStorage persistence
   - Custom Song/Chart import
   - Private chart notes
   - YouTube thumbnail helper + external site opener
   - "Lucky" shuffle results + random open
   - Export / Import JSON
   - Title Tracker (Advanced Lv.1~10, Expert Lv.1~10)
   - Rating points mapping: Points per Rank table (Lv.10~28)
*/

const STORAGE_KEY = "pump_chart_vault_v1";
const SETTINGS_KEY = "pump_chart_vault_settings_v1";

const RANKS = ["A","A+","AA","AA+","AAA","AAA+","S","S+","SS","SS+","SSS","SSS+"];

const POINTS_TABLE = {
  10:[80,90,100,105,110,115,120,126,132,138,144,150],
  11:[88,99,110,116,121,127,132,139,145,152,158,165],
  12:[104,117,130,137,143,150,156,164,172,179,187,195],
  13:[128,144,160,168,176,184,192,202,211,221,230,240],
  14:[160,180,200,210,220,230,240,252,264,276,288,300],
  15:[200,225,250,263,275,288,300,315,330,345,360,375],
  16:[248,279,310,326,341,357,372,391,409,428,446,465],
  17:[304,342,380,399,418,437,456,479,502,524,547,570],
  18:[368,414,460,483,506,529,552,580,607,635,662,690],
  19:[440,495,550,578,605,633,660,693,726,759,792,825],
  20:[520,585,650,683,715,748,780,819,858,897,936,975],
  21:[608,684,760,798,836,874,912,958,1003,1049,1094,1140],
  22:[704,792,880,924,968,1012,1056,1109,1162,1214,1267,1320],
  23:[808,909,1010,1061,1111,1162,1212,1273,1333,1394,1454,1515],
  24:[920,1035,1150,1208,1265,1323,1380,1449,1518,1587,1656,1725],
  25:[1040,1170,1300,1365,1430,1495,1560,1638,1716,1794,1872,1950],
  26:[1168,1314,1460,1533,1606,1679,1752,1840,1927,2015,2102,2190],
  27:[1304,1467,1630,1712,1793,1875,1956,2054,2152,2249,2347,2445],
  28:[1448,1629,1810,1901,1991,2082,2172,2281,2389,2498,2606,2715]
};

const TITLE_REQUIREMENTS = [
  { group:"Advanced", name:"Advanced Lv.1",  level:20, need:13000 },
  { group:"Advanced", name:"Advanced Lv.2",  level:20, need:26000 },
  { group:"Advanced", name:"Advanced Lv.3",  level:20, need:39000 },
  { group:"Advanced", name:"Advanced Lv.4",  level:21, need:15000 },
  { group:"Advanced", name:"Advanced Lv.5",  level:21, need:30000 },
  { group:"Advanced", name:"Advanced Lv.6",  level:21, need:45000 },
  { group:"Advanced", name:"Advanced Lv.7",  level:22, need:17500 },
  { group:"Advanced", name:"Advanced Lv.8",  level:22, need:35000 },
  { group:"Advanced", name:"Advanced Lv.9",  level:22, need:52500 },
  { group:"Advanced", name:"Advanced Lv.10", level:22, need:70000 },

  { group:"Expert",   name:"Expert Lv.1",    level:23, need:40000 },
  { group:"Expert",   name:"Expert Lv.2",    level:23, need:80000 },
  { group:"Expert",   name:"Expert Lv.3",    level:24, need:30000 },
  { group:"Expert",   name:"Expert Lv.4",    level:24, need:60000 },
  { group:"Expert",   name:"Expert Lv.5",    level:25, need:20000 },
  { group:"Expert",   name:"Expert Lv.6",    level:25, need:40000 },
  { group:"Expert",   name:"Expert Lv.7",    level:26, need:13000 },
  { group:"Expert",   name:"Expert Lv.8",    level:26, need:26000 },
  { group:"Expert",   name:"Expert Lv.9",    level:27, need:3500  },
  { group:"Expert",   name:"Expert Lv.10",   level:27, need:7000  }
];

function nowISO(){ return new Date().toISOString(); }
function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
function clampNum(v, min, max){
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}
function safeText(s){ return String(s ?? "").trim(); }
function toLower(s){ return safeText(s).toLowerCase(); }
function round2(n){ return Math.round(n * 100) / 100; }
function escapeHtml(str){
  return safeText(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function parseChartLevelNumber(levelText){
  // accepts "S23", "D21", "23"
  const s = safeText(levelText);
  const m = s.match(/(\d{1,2})/);
  if (!m) return null;
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return null;
  return num;
}

function getPoints(levelNum, rank){
  const lv = Number(levelNum);
  if (!POINTS_TABLE[lv]) return null;
  const idx = RANKS.indexOf(rank);
  if (idx < 0) return null;
  return POINTS_TABLE[lv][idx];
}

function getYouTubeId(url){
  const u = safeText(url);
  if (!u) return null;
  const m1 = u.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m1) return m1[1];
  const m2 = u.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m2) return m2[1];
  const m3 = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (m3) return m3[1];
  return null;
}

function deriveYouTubeThumb(url){
  const id = getYouTubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

const defaultState = () => ({
  version: 1,
  updatedAt: nowISO(),
  songs: [
    // sample blank
  ]
});

const defaultSettings = () => ({
  showArtwork: true,
  compact: false
});

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return defaultState();
    if (!Array.isArray(obj.songs)) obj.songs = [];
    return obj;
  }catch{
    return defaultState();
  }
}
function saveState(){
  state.updatedAt = nowISO();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const obj = JSON.parse(raw);
    return { ...defaultSettings(), ...(obj || {}) };
  }catch{
    return defaultSettings();
  }
}
function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let state = loadState();
let settings = loadSettings();

function setRoute(route){
  document.querySelectorAll(".navBtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.route === route);
  });
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  const page = document.getElementById(`page-${route}`);
  if (page) page.classList.add("active");
  if (route === "home") renderHomeResults([]);
  if (route === "library") renderLibrary();
  if (route === "tracker") renderTracker();
  if (route === "settings") renderSettings();
}

function openModal(title, bodyHtml, footerButtons){
  const bd = document.getElementById("modalBackdrop");
  const mt = document.getElementById("modalTitle");
  const mb = document.getElementById("modalBody");
  const mf = document.getElementById("modalFooter");

  mt.textContent = title;
  mb.innerHTML = bodyHtml;
  mf.innerHTML = "";

  (footerButtons || []).forEach(btn=>{
    const el = document.createElement("button");
    el.className = `btn ${btn.variant || ""}`.trim();
    el.textContent = btn.text;
    el.addEventListener("click", btn.onClick);
    mf.appendChild(el);
  });

  bd.hidden = false;
}
function closeModal(){
  document.getElementById("modalBackdrop").hidden = true;
  document.getElementById("modalBody").innerHTML = "";
  document.getElementById("modalFooter").innerHTML = "";
}

function getAllCharts(){
  const rows = [];
  for (const song of state.songs){
    const charts = Array.isArray(song.charts) ? song.charts : [];
    for (const ch of charts){
      rows.push({ song, chart: ch });
    }
  }
  return rows;
}

function matchesFilters({song, chart}, q, filters){
  const query = toLower(q);
  const pack = [
    song.name, song.artist, song.category, song.bpm,
    chart.diff, chart.levelText, chart.dist, chart.config, chart.tags,
    chart.note, chart.privateEval
  ].map(x=>toLower(x)).join(" | ");

  if (query && !pack.includes(query)) return false;

  const lvNum = parseChartLevelNumber(chart.levelText);
  const minLv = filters.levelMin;
  const maxLv = filters.levelMax;
  if (minLv != null && (lvNum == null || lvNum < minLv)) return false;
  if (maxLv != null && (lvNum == null || lvNum > maxLv)) return false;

  const bpm = Number(song.bpm);
  if (filters.bpmMin != null && (!Number.isFinite(bpm) || bpm < filters.bpmMin)) return false;
  if (filters.bpmMax != null && (!Number.isFinite(bpm) || bpm > filters.bpmMax)) return false;

  if (filters.diff && safeText(chart.diff) !== filters.diff) return false;

  if (filters.dist && safeText(chart.dist) !== filters.dist) return false;

  if (filters.config){
    const c = toLower(chart.config);
    if (!c.includes(toLower(filters.config))) return false;
  }

  if (filters.category){
    const c = toLower(song.category);
    if (!c.includes(toLower(filters.category))) return false;
  }

  return true;
}

function collectHomeFilters(){
  const levelMin = clampNum(document.getElementById("fLevelMin").value, 0, 99);
  const levelMax = clampNum(document.getElementById("fLevelMax").value, 0, 99);
  const bpmMin = clampNum(document.getElementById("fBpmMin").value, 0, 999);
  const bpmMax = clampNum(document.getElementById("fBpmMax").value, 0, 999);
  const diff = safeText(document.getElementById("fDiff").value);
  const dist = safeText(document.getElementById("fDist").value);
  const config = safeText(document.getElementById("fConfig").value);
  const category = safeText(document.getElementById("fCategory").value);

  return {
    levelMin: levelMin ?? null,
    levelMax: levelMax ?? null,
    bpmMin: bpmMin ?? null,
    bpmMax: bpmMax ?? null,
    diff: diff || "",
    dist: dist || "",
    config: config || "",
    category: category || ""
  };
}

function renderHomeResults(rows){
  const box = document.getElementById("homeResults");
  const meta = document.getElementById("homeResultMeta");
  meta.textContent = `${rows.length} 条`;
  box.innerHTML = "";

  if (!rows.length){
    box.innerHTML = `<div class="hint">还没有结果。你可以去“曲库”新增歌曲与谱面。</div>`;
    return;
  }

  for (const r of rows){
    box.appendChild(renderChartRow(r.song, r.chart));
  }
}

function renderChartRow(song, chart){
  const item = document.createElement("div");
  item.className = `item ${settings.compact ? "compact" : ""}`.trim();

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  if (settings.showArtwork && song.artworkUrl){
    const img = document.createElement("img");
    img.src = song.artworkUrl;
    img.alt = song.name || "artwork";
    thumb.innerHTML = "";
    thumb.appendChild(img);
  }else{
    thumb.textContent = "PV";
  }

  const main = document.createElement("div");
  main.className = "itemMain";

  const title = document.createElement("div");
  title.className = "itemTitle";
  title.innerHTML = `
    <span>${escapeHtml(song.name || "(未命名歌曲)")}</span>
    <span class="badge hot">${escapeHtml(chart.diff || "S")}${escapeHtml(chart.levelText || "")}</span>
    ${chart.blood?.enabled ? `<span class="badge red">已带血</span>` : ``}
    ${song.category ? `<span class="badge">${escapeHtml(song.category)}</span>` : ``}
  `;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `
    <div>曲师：${escapeHtml(song.artist || "-")} · BPM：${escapeHtml(song.bpm || "-")} · 分布：${escapeHtml(chart.dist || "-")}</div>
    <div>配置：${escapeHtml(chart.config || "-")} ${chart.tags ? `· 标签：${escapeHtml(chart.tags)}` : ""}</div>
    ${chart.privateEval ? `<div>评价：${escapeHtml(chart.privateEval)}</div>` : ""}
  `;

  main.appendChild(title);
  main.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "actions";

  const btnOpen = document.createElement("button");
  btnOpen.className = "btn primary";
  btnOpen.textContent = "谱面详情";
  btnOpen.addEventListener("click", ()=>openChartDetail(song.id, chart.id));

  const btnYT = document.createElement("button");
  btnYT.className = "btn";
  btnYT.textContent = "YouTube";
  btnYT.disabled = !chart.youtubeUrl;
  btnYT.addEventListener("click", ()=>{
    if (chart.youtubeUrl) window.open(chart.youtubeUrl, "_blank");
  });

  const btnBlood = document.createElement("button");
  btnBlood.className = "btn";
  btnBlood.textContent = chart.blood?.enabled ? "取消带血" : "标记带血";
  btnBlood.addEventListener("click", ()=>{
    toggleBlood(song.id, chart.id);
  });

  actions.appendChild(btnOpen);
  actions.appendChild(btnYT);
  actions.appendChild(btnBlood);

  item.appendChild(thumb);
  item.appendChild(main);
  item.appendChild(actions);

  return item;
}

function renderLibrary(){
  const list = document.getElementById("libraryList");
  const q = toLower(document.getElementById("libSearch").value);

  const songs = [...state.songs];
  const sortKey = document.getElementById("libSort").value;

  const filtered = songs.filter(s=>{
    const pack = [s.name,s.artist,s.category,s.bpm].map(toLower).join(" | ");
    const charts = (s.charts||[]).map(c=>[c.diff,c.levelText,c.dist,c.config,c.tags,c.note,c.privateEval].map(toLower).join(" | ")).join(" || ");
    return !q || (pack + " || " + charts).includes(q);
  });

  filtered.sort((a,b)=>{
    if (sortKey === "name_asc") return safeText(a.name).localeCompare(safeText(b.name));
    if (sortKey === "bpm_asc") return (Number(a.bpm)||0) - (Number(b.bpm)||0);
    if (sortKey === "bpm_desc") return (Number(b.bpm)||0) - (Number(a.bpm)||0);
    return safeText(b.updatedAt).localeCompare(safeText(a.updatedAt));
  });

  list.innerHTML = "";
  if (!filtered.length){
    list.innerHTML = `<div class="hint">曲库为空。点“新增歌曲”开始。</div>`;
    return;
  }

  for (const song of filtered){
    list.appendChild(renderSongBlock(song));
  }
}

function renderSongBlock(song){
  const wrap = document.createElement("div");
  wrap.className = "panel";

  const header = document.createElement("div");
  header.className = "row";
  header.style.justifyContent = "space-between";

  const left = document.createElement("div");
  left.innerHTML = `
    <div class="itemTitle">
      <span>${escapeHtml(song.name || "(未命名歌曲)")}</span>
      ${song.category ? `<span class="badge">${escapeHtml(song.category)}</span>` : ""}
      ${song.bpm ? `<span class="badge">BPM ${escapeHtml(song.bpm)}</span>` : ""}
    </div>
    <div class="meta">曲师：${escapeHtml(song.artist || "-")} · 谱面数：${(song.charts||[]).length}</div>
  `;

  const right = document.createElement("div");
  right.className = "row";

  const btnEdit = document.createElement("button");
  btnEdit.className = "btn primary";
  btnEdit.textContent = "编辑歌曲";
  btnEdit.addEventListener("click", ()=>openSongEditor(song.id));

  const btnAdd = document.createElement("button");
  btnAdd.className = "btn";
  btnAdd.textContent = "新增谱面";
  btnAdd.addEventListener("click", ()=>openChartEditor(song.id, null));

  const btnDel = document.createElement("button");
  btnDel.className = "btn danger";
  btnDel.textContent = "删除歌曲";
  btnDel.addEventListener("click", ()=>{
    openModal("删除确认",
      `<div class="hint">确定删除这首歌及其全部谱面吗？此操作不可撤销。</div>`,
      [
        { text:"取消", onClick: closeModal },
        { text:"删除", variant:"danger", onClick: ()=>{
            state.songs = state.songs.filter(s=>s.id !== song.id);
            saveState();
            closeModal();
            renderLibrary();
          }
        }
      ]
    );
  });

  right.appendChild(btnEdit);
  right.appendChild(btnAdd);
  right.appendChild(btnDel);

  header.appendChild(left);
  header.appendChild(right);

  const chartsBox = document.createElement("div");
  chartsBox.className = "list";
  chartsBox.style.marginTop = "10px";

  const charts = (song.charts||[]);
  if (!charts.length){
    chartsBox.innerHTML = `<div class="hint">暂无谱面。</div>`;
  }else{
    for (const ch of charts){
      chartsBox.appendChild(renderChartRow(song, ch));
    }
  }

  wrap.appendChild(header);
  wrap.appendChild(chartsBox);
  return wrap;
}

function openSongEditor(songId){
  const song = state.songs.find(s=>s.id === songId);
  if (!song) return;

  const body = `
    <div class="grid2">
      <div>
        <div class="fieldLabel">歌曲名</div>
        <input class="input" id="song_name" value="${escapeHtml(song.name||"")}" />
        <div class="fieldLabel">曲师</div>
        <input class="input" id="song_artist" value="${escapeHtml(song.artist||"")}" />
        <div class="fieldLabel">分类（例如 J-Music / K-POP）</div>
        <input class="input" id="song_category" value="${escapeHtml(song.category||"")}" />
      </div>
      <div>
        <div class="fieldLabel">BPM</div>
        <input class="input" id="song_bpm" value="${escapeHtml(song.bpm||"")}" inputmode="numeric" />
        <div class="fieldLabel">曲绘 URL（可从导入导出页提取）</div>
        <input class="input" id="song_art" value="${escapeHtml(song.artworkUrl||"")}" />
        <div class="hint">建议用 https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg 或你自己保存的图片链接。</div>
      </div>
    </div>
  `;

  openModal("编辑歌曲", body, [
    { text:"取消", onClick: closeModal },
    { text:"保存", variant:"primary", onClick: ()=>{
      song.name = safeText(document.getElementById("song_name").value);
      song.artist = safeText(document.getElementById("song_artist").value);
      song.category = safeText(document.getElementById("song_category").value);
      song.bpm = safeText(document.getElementById("song_bpm").value);
      song.artworkUrl = safeText(document.getElementById("song_art").value);
      song.updatedAt = nowISO();
      saveState();
      closeModal();
      renderLibrary();
    }}
  ]);
}

function openChartEditor(songId, chartId){
  const song = state.songs.find(s=>s.id === songId);
  if (!song) return;
  if (!Array.isArray(song.charts)) song.charts = [];

  const existing = chartId ? song.charts.find(c=>c.id === chartId) : null;
  const isNew = !existing;

  const chart = existing || {
    id: uid("chart"),
    diff: "S",
    levelText: "",
    dist: "",
    config: "",
    tags: "",
    youtubeUrl: "",
    note: "",
    privateEval: "",
    blood: { enabled:false, levelNum:null, rank:null, points:0, when:null }
  };

  const body = `
    <div class="grid2">
      <div>
        <div class="fieldLabel">难度（S/D/SP/DP/COOP/OTHER）</div>
        <select class="input" id="ch_diff">
          ${["S","D","SP","DP","COOP","OTHER"].map(x=>`<option value="${x}" ${chart.diff===x?"selected":""}>${x}</option>`).join("")}
        </select>

        <div class="fieldLabel">等级（例如 S23 / D21）</div>
        <input class="input" id="ch_level" value="${escapeHtml(chart.levelText||"")}" />

        <div class="fieldLabel">难度分布（最上/上/中上/中/中下/下/最下/特殊）</div>
        <select class="input" id="ch_dist">
          <option value="">-</option>
          ${["最上","上","中上","中","中下","下","最下","特殊"].map(x=>`<option value="${x}" ${chart.dist===x?"selected":""}>${x}</option>`).join("")}
        </select>

        <div class="fieldLabel">谱面配置分类（例如 卡点 / 跑步）</div>
        <input class="input" id="ch_config" value="${escapeHtml(chart.config||"")}" />

        <div class="fieldLabel">标签（可选，逗号分隔）</div>
        <input class="input" id="ch_tags" value="${escapeHtml(chart.tags||"")}" />
      </div>

      <div>
        <div class="fieldLabel">YouTube 等级谱面视频链接</div>
        <input class="input" id="ch_yt" value="${escapeHtml(chart.youtubeUrl||"")}" />

        <div class="fieldLabel">私人谱面评价（会显示在谱面界面）</div>
        <textarea class="textarea" id="ch_eval" placeholder="你自己的评价…">${escapeHtml(chart.privateEval||"")}</textarea>

        <div class="fieldLabel">备注（任意）</div>
        <textarea class="textarea" id="ch_note" placeholder="比如哪里容易掉、练习方法、分段、关键配置点…">${escapeHtml(chart.note||"")}</textarea>
      </div>
    </div>
  `;

  openModal(isNew ? "新增谱面" : "编辑谱面", body, [
    { text:"取消", onClick: closeModal },
    { text:"保存", variant:"primary", onClick: ()=>{
      chart.diff = safeText(document.getElementById("ch_diff").value);
      chart.levelText = safeText(document.getElementById("ch_level").value);
      chart.dist = safeText(document.getElementById("ch_dist").value);
      chart.config = safeText(document.getElementById("ch_config").value);
      chart.tags = safeText(document.getElementById("ch_tags").value);
      chart.youtubeUrl = safeText(document.getElementById("ch_yt").value);
      chart.privateEval = safeText(document.getElementById("ch_eval").value);
      chart.note = safeText(document.getElementById("ch_note").value);

      if (isNew) song.charts.push(chart);
      song.updatedAt = nowISO();

      saveState();
      closeModal();
      renderLibrary();
    }}
  ]);
}

function openChartDetail(songId, chartId){
  const song = state.songs.find(s=>s.id === songId);
  if (!song) return;
  const chart = (song.charts||[]).find(c=>c.id === chartId);
  if (!chart) return;

  const lvNum = parseChartLevelNumber(chart.levelText);
  const blood = chart.blood?.enabled ? chart.blood : null;

  const yt = chart.youtubeUrl ? `
    <div class="row">
      <button class="btn primary" id="btnOpenYT">打开 YouTube</button>
      <button class="btn" id="btnCopyThumb2">推导缩略图并复制</button>
    </div>
  ` : `<div class="hint">未设置 YouTube 链接。</div>`;

  const body = `
    <div class="grid2">
      <div>
        <div class="itemTitle">
          <span>${escapeHtml(song.name || "(未命名歌曲)")}</span>
          <span class="badge hot">${escapeHtml(chart.diff || "S")}${escapeHtml(chart.levelText || "")}</span>
          ${blood ? `<span class="badge red">已带血</span>` : ``}
        </div>
        <div class="meta">
          <div>曲师：${escapeHtml(song.artist || "-")} · 分类：${escapeHtml(song.category || "-")} · BPM：${escapeHtml(song.bpm || "-")}</div>
          <div>分布：${escapeHtml(chart.dist || "-")} · 配置：${escapeHtml(chart.config || "-")}</div>
          <div>等级数字解析：${lvNum == null ? "-" : lvNum}</div>
        </div>

        <div class="divider"></div>

        <div class="panel">
          <div class="panelTitle">私人谱面评价</div>
          <div class="hint">${escapeHtml(chart.privateEval || "（空）")}</div>
        </div>

        <div class="panel" style="margin-top:10px;">
          <div class="panelTitle">备注</div>
          <div class="hint">${escapeHtml(chart.note || "（空）")}</div>
        </div>
      </div>

      <div>
        <div class="panel">
          <div class="panelTitle">曲绘</div>
          <div class="row">
            <input class="input" id="artUrlHere" value="${escapeHtml(song.artworkUrl || "")}" placeholder="曲绘 URL" />
            <button class="btn" id="btnSaveArtHere">保存</button>
          </div>
          <div class="hint">你可以在“导入导出”页用 YouTube 链接推导缩略图 URL，然后贴到这里。</div>
        </div>

        <div class="panel" style="margin-top:10px;">
          <div class="panelTitle">YouTube</div>
          ${yt}
        </div>

        <div class="panel" style="margin-top:10px;">
          <div class="panelTitle">带血</div>
          <div class="row">
            <button class="btn primary" id="btnToggleBlood">${blood ? "取消已带血" : "标记已带血"}</button>
            <div class="pill">${blood ? `Lv.${blood.levelNum} · ${blood.rank} · ${blood.points} pts` : "未带血"}</div>
          </div>
          <div class="hint">标记带血会用于称号追踪器估算。</div>
        </div>
      </div>
    </div>
  `;

  openModal("谱面详情", body, [
    { text:"关闭", onClick: closeModal },
    { text:"编辑谱面", variant:"primary", onClick: ()=>{
      closeModal();
      openChartEditor(songId, chartId);
    }},
    { text:"删除谱面", variant:"danger", onClick: ()=>{
      openModal("删除确认",
        `<div class="hint">确定删除这个谱面吗？</div>`,
        [
          { text:"取消", onClick: closeModal },
          { text:"删除", variant:"danger", onClick: ()=>{
            song.charts = (song.charts||[]).filter(c=>c.id !== chartId);
            song.updatedAt = nowISO();
            saveState();
            closeModal();
            closeModal();
            renderLibrary();
          }}
        ]
      );
    }}
  ]);

  setTimeout(()=>{
    const btnOpenYT = document.getElementById("btnOpenYT");
    if (btnOpenYT){
      btnOpenYT.addEventListener("click", ()=>window.open(chart.youtubeUrl, "_blank"));
    }

    const btnCopyThumb2 = document.getElementById("btnCopyThumb2");
    if (btnCopyThumb2){
      btnCopyThumb2.addEventListener("click", async ()=>{
        const url = deriveYouTubeThumb(chart.youtubeUrl);
        if (!url){
          alert("无法解析 YouTube 链接。");
          return;
        }
        await navigator.clipboard.writeText(url);
        alert("已复制缩略图 URL。");
      });
    }

    const btnSaveArtHere = document.getElementById("btnSaveArtHere");
    if (btnSaveArtHere){
      btnSaveArtHere.addEventListener("click", ()=>{
        song.artworkUrl = safeText(document.getElementById("artUrlHere").value);
        song.updatedAt = nowISO();
        saveState();
        alert("已保存曲绘 URL。");
      });
    }

    const btnToggleBlood = document.getElementById("btnToggleBlood");
    btnToggleBlood.addEventListener("click", ()=>{
      closeModal();
      toggleBlood(songId, chartId);
    });
  }, 0);
}

function toggleBlood(songId, chartId){
  const song = state.songs.find(s=>s.id === songId);
  if (!song) return;
  const chart = (song.charts||[]).find(c=>c.id === chartId);
  if (!chart) return;

  if (!chart.blood) chart.blood = { enabled:false, levelNum:null, rank:null, points:0, when:null };

  if (chart.blood.enabled){
    chart.blood = { enabled:false, levelNum:null, rank:null, points:0, when:null };
    song.updatedAt = nowISO();
    saveState();
    renderLibrary();
    renderTracker();
    return;
  }

  const body = `
    <div class="grid2">
      <div>
        <div class="fieldLabel">等级数字（10～28，对应你的 Points per Rank 表）</div>
        <input class="input" id="blood_lv" placeholder="例如 23" inputmode="numeric" value="${escapeHtml(String(parseChartLevelNumber(chart.levelText)||""))}" />
        <div class="hint">你谱面写的是 ${escapeHtml(chart.levelText||"-")}，系统会自动提取数字作为默认值，但你也可以手动改。</div>
      </div>
      <div>
        <div class="fieldLabel">Rank</div>
        <select class="input" id="blood_rank">
          ${RANKS.map(r=>`<option value="${r}">${r}</option>`).join("")}
        </select>
        <div class="hint">选完会用表格计算 Points。</div>
      </div>
    </div>
  `;

  openModal("标记已带血", body, [
    { text:"取消", onClick: closeModal },
    { text:"确认", variant:"primary", onClick: ()=>{
      const lv = clampNum(document.getElementById("blood_lv").value, 10, 28);
      const rank = safeText(document.getElementById("blood_rank").value);
      if (lv == null){
        alert("等级数字必须是 10～28。");
        return;
      }
      const pts = getPoints(lv, rank);
      if (pts == null){
        alert("无法计算 Points，请检查等级与 Rank。");
        return;
      }

      chart.blood = {
        enabled: true,
        levelNum: lv,
        rank,
        points: pts,
        when: nowISO()
      };

      song.updatedAt = nowISO();
      saveState();
      closeModal();
      renderLibrary();
      renderTracker();
    }}
  ]);
}

function renderTracker(){
  const rows = getAllCharts().filter(({chart})=>chart.blood?.enabled);
  const count = rows.length;
  const sum = rows.reduce((a,r)=>a + (Number(r.chart.blood.points)||0), 0);
  const avg = count ? (sum / count) : 0;

  document.getElementById("bloodCount").textContent = String(count);
  document.getElementById("bloodSum").textContent = String(round2(sum));
  document.getElementById("bloodAvg").textContent = String(round2(avg));

  renderTrackerTable(avg, sum);
  renderBloodList(rows);

  const btn = document.getElementById("btnOpenBloodList");
  btn.onclick = ()=> {
    document.getElementById("bloodList").scrollIntoView({ behavior:"smooth", block:"start" });
  };
  document.getElementById("btnRecalcTracker").onclick = ()=>renderTracker();
}

function renderTrackerTable(avgPoints, sumPoints){
  const box = document.getElementById("trackerTable");
  box.innerHTML = "";

  for (const req of TITLE_REQUIREMENTS){
    const need = req.need;
    let totalNeed = null;
    let remainNeed = null;

    if (avgPoints > 0){
      totalNeed = need / avgPoints;
      const currentCount = sumPoints / avgPoints;
      remainNeed = totalNeed - currentCount;
    }

    const row = document.createElement("div");
    row.className = "trRow";

    const c1 = document.createElement("div");
    c1.className = "trName";
    c1.textContent = req.name;

    const c2 = document.createElement("div");
    c2.className = "trNeed";
    c2.textContent = `Lv.${req.level} Rating ≥ ${need}`;

    const c3 = document.createElement("div");
    c3.className = "trCalc";
    if (avgPoints <= 0){
      c3.textContent = "需要先至少标记 1 张已带血谱面";
    }else{
      c3.textContent = `预计需要带血总量：${round2(totalNeed)} 张`;
    }

    const c4 = document.createElement("div");
    c4.className = "trHint";
    if (avgPoints <= 0){
      c4.textContent = "当前无法估算，因为平均得分为 0。";
    }else{
      const remain = Math.max(0, remainNeed);
      c4.textContent = `按你当前平均分，还差：${round2(remain)} 张（估算）`;
    }

    row.appendChild(c1);
    row.appendChild(c2);
    row.appendChild(c3);
    row.appendChild(c4);
    box.appendChild(row);
  }
}

function renderBloodList(rows){
  const box = document.getElementById("bloodList");
  const meta = document.getElementById("bloodMeta");
  meta.textContent = `${rows.length} 条`;
  box.innerHTML = "";

  if (!rows.length){
    box.innerHTML = `<div class="hint">还没有已带血谱面。</div>`;
    return;
  }

  rows.sort((a,b)=>safeText(b.chart.blood.when).localeCompare(safeText(a.chart.blood.when)));

  for (const r of rows){
    box.appendChild(renderChartRow(r.song, r.chart));
  }
}

function renderSettings(){
  const show = document.getElementById("setShowArtwork");
  const compact = document.getElementById("setCompact");
  show.checked = !!settings.showArtwork;
  compact.checked = !!settings.compact;

  show.onchange = ()=>{
    settings.showArtwork = show.checked;
    saveSettings();
    renderLibrary();
  };
  compact.onchange = ()=>{
    settings.compact = compact.checked;
    saveSettings();
    renderLibrary();
  };
}

function doSearch(){
  const q = document.getElementById("homeSearch").value;
  const filters = collectHomeFilters();
  const rows = getAllCharts().filter(r=>matchesFilters(r, q, filters));
  renderHomeResults(rows);
  return rows;
}

function doLucky(){
  const q = ""; // lucky ignores search string
  const filters = collectHomeFilters();
  let rows = getAllCharts().filter(r=>matchesFilters(r, q, filters));

  // shuffle
  rows = rows.map(x=>({x, k:Math.random()})).sort((a,b)=>a.k-b.k).map(o=>o.x);
  renderHomeResults(rows);

  if (rows.length){
    // random open first
    const pick = rows[0];
    openChartDetail(pick.song.id, pick.chart.id);
  }
}

function addSongFlow(){
  const body = `
    <div class="grid2">
      <div>
        <div class="fieldLabel">歌曲名</div>
        <input class="input" id="ns_name" placeholder="Song title" />
        <div class="fieldLabel">曲师</div>
        <input class="input" id="ns_artist" placeholder="Artist" />
        <div class="fieldLabel">分类（例如 J-Music / K-POP）</div>
        <input class="input" id="ns_category" placeholder="Category" />
      </div>
      <div>
        <div class="fieldLabel">BPM</div>
        <input class="input" id="ns_bpm" placeholder="例如 160" inputmode="numeric" />
        <div class="fieldLabel">曲绘 URL（可空）</div>
        <input class="input" id="ns_art" placeholder="Artwork URL" />
        <div class="hint">你也可以以后在谱面详情页保存曲绘。</div>
      </div>
    </div>
  `;
  openModal("新增歌曲", body, [
    { text:"取消", onClick: closeModal },
    { text:"创建", variant:"primary", onClick: ()=>{
      const name = safeText(document.getElementById("ns_name").value);
      const song = {
        id: uid("song"),
        name,
        artist: safeText(document.getElementById("ns_artist").value),
        category: safeText(document.getElementById("ns_category").value),
        bpm: safeText(document.getElementById("ns_bpm").value),
        artworkUrl: safeText(document.getElementById("ns_art").value),
        charts: [],
        createdAt: nowISO(),
        updatedAt: nowISO()
      };
      state.songs.push(song);
      saveState();
      closeModal();
      renderLibrary();
    }}
  ]);
}

function addChartFlowPickSong(){
  if (!state.songs.length){
    alert("曲库为空，请先新增歌曲。");
    return;
  }
  const options = state.songs.map(s=>`<option value="${s.id}">${escapeHtml(s.name || "(未命名歌曲)")}</option>`).join("");
  const body = `
    <div class="fieldLabel">选择一首歌</div>
    <select class="input" id="pick_song">${options}</select>
    <div class="hint">选完会进入新增谱面。</div>
  `;
  openModal("给某首歌新增谱面", body, [
    { text:"取消", onClick: closeModal },
    { text:"下一步", variant:"primary", onClick: ()=>{
      const id = document.getElementById("pick_song").value;
      closeModal();
      openChartEditor(id, null);
    }}
  ]);
}

async function exportJsonFile(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pump_chart_vault_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyJson(){
  await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
  alert("已复制 JSON。");
}

async function importFromText(text){
  let obj;
  try{
    obj = JSON.parse(text);
  }catch{
    alert("JSON 解析失败。");
    return;
  }
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.songs)){
    alert("JSON 格式不对，需要包含 songs 数组。");
    return;
  }
  // light normalize
  obj.version = 1;
  obj.updatedAt = nowISO();
  obj.songs = obj.songs.map(s=>{
    const song = {
      id: s.id || uid("song"),
      name: safeText(s.name),
      artist: safeText(s.artist),
      category: safeText(s.category),
      bpm: safeText(s.bpm),
      artworkUrl: safeText(s.artworkUrl),
      createdAt: s.createdAt || nowISO(),
      updatedAt: s.updatedAt || nowISO(),
      charts: Array.isArray(s.charts) ? s.charts.map(c=>({
        id: c.id || uid("chart"),
        diff: safeText(c.diff) || "S",
        levelText: safeText(c.levelText),
        dist: safeText(c.dist),
        config: safeText(c.config),
        tags: safeText(c.tags),
        youtubeUrl: safeText(c.youtubeUrl),
        note: safeText(c.note),
        privateEval: safeText(c.privateEval),
        blood: c.blood && typeof c.blood === "object" ? {
          enabled: !!c.blood.enabled,
          levelNum: c.blood.levelNum ?? null,
          rank: safeText(c.blood.rank) || null,
          points: Number(c.blood.points)||0,
          when: c.blood.when || null
        } : { enabled:false, levelNum:null, rank:null, points:0, when:null }
      })) : []
    };
    return song;
  });

  state = obj;
  saveState();
  alert("导入成功。");
  renderLibrary();
  renderTracker();
}

function bindUI(){
  document.querySelectorAll(".navBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>setRoute(btn.dataset.route));
  });

  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", (e)=>{
    if (e.target.id === "modalBackdrop") closeModal();
  });

  document.getElementById("btnSearch").addEventListener("click", doSearch);
  document.getElementById("homeSearch").addEventListener("keydown", (e)=>{
    if (e.key === "Enter") doSearch();
  });

  document.getElementById("btnLucky").addEventListener("click", doLucky);

  document.getElementById("btnAddSong").addEventListener("click", addSongFlow);
  document.getElementById("btnAddChart").addEventListener("click", addChartFlowPickSong);

  document.getElementById("libSearch").addEventListener("input", renderLibrary);
  document.getElementById("libSort").addEventListener("change", renderLibrary);

  document.getElementById("btnExportJson").addEventListener("click", exportJsonFile);
  document.getElementById("btnCopyJson").addEventListener("click", copyJson);

  document.getElementById("btnImportText").addEventListener("click", ()=>{
    importFromText(document.getElementById("importText").value);
  });

  document.getElementById("btnImportFile").addEventListener("click", async ()=>{
    const f = document.getElementById("importFile").files?.[0];
    if (!f){ alert("请选择一个 JSON 文件。"); return; }
    const text = await f.text();
    importFromText(text);
  });

  document.getElementById("btnResetAll").addEventListener("click", ()=>{
    openModal("清空确认",
      `<div class="hint">确定清空所有数据吗？清空后无法恢复。建议先导出 JSON 备份。</div>`,
      [
        { text:"取消", onClick: closeModal },
        { text:"清空", variant:"danger", onClick: ()=>{
          state = defaultState();
          saveState();
          closeModal();
          renderLibrary();
          renderTracker();
        }}
      ]
    );
  });

  document.getElementById("btnOpenThumbSite").addEventListener("click", ()=>{
    window.open("https://www.youtubethumbnaildownloader.com/", "_blank");
  });

  document.getElementById("btnDeriveThumb").addEventListener("click", ()=>{
    const url = document.getElementById("ytUrl").value;
    const thumb = deriveYouTubeThumb(url);
    if (!thumb){
      alert("无法解析 YouTube 链接。");
      return;
    }
    document.getElementById("thumbOut").value = thumb;
  });

  document.getElementById("btnCopyThumb").addEventListener("click", async ()=>{
    const t = document.getElementById("thumbOut").value;
    if (!t){ alert("没有可复制的缩略图 URL。"); return; }
    await navigator.clipboard.writeText(t);
    alert("已复制。");
  });
}

function boot(){
  bindUI();
  setRoute("home");
  renderLibrary();
  renderTracker();
  renderSettings();
}

boot();
