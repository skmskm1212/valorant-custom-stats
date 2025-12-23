const DATA_URL = "./public/data/matches.json";

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function pct(x) { return (x * 100).toFixed(1) + "%"; }
function fmt1(x) { return Number.isFinite(x) ? x.toFixed(1) : "-"; }
function fmt0(x) { return Number.isFinite(x) ? Math.round(x).toString() : "-"; }

function calcSimpleRating(s) {
  // 운영용 간단 점수(초기 버전)
  // - 승률(0~1) 가중
  // - ACS, ADR는 대략적인 스케일로 정규화 느낌만
  // - FK-FD는 영향 작게
  const winrate = s.games ? (s.wins / s.games) : 0;
  const acsN = clamp((s.avgAcs - 150) / 150, 0, 1); // 150~300 대충
  const adrN = clamp((s.avgAdr - 80) / 120, 0, 1);  // 80~200 대충
  const fkfdN = clamp(((s.avgFk - s.avgFd) + 2) / 4, 0, 1); // -2~+2 대충
  return (winrate * 0.45) + (acsN * 0.25) + (adrN * 0.20) + (fkfdN * 0.10);
}

function summarize(matches) {
  // nick -> stats
  const map = new Map();

  for (const m of matches) {
    const winner = m.winner; // "A" or "B"
    const players = Array.isArray(m.players) ? m.players : [];

    for (const p of players) {
      const nick = (p.nick || "").trim();
      if (!nick) continue;

      if (!map.has(nick)) {
        map.set(nick, {
          nick,
          games: 0,
          wins: 0,
          k: 0, d: 0, a: 0,
          acsSum: 0,
          adrSum: 0,
          hsSum: 0,
          fkSum: 0,
          fdSum: 0,
          agents: new Map(), // agent -> count
        });
      }

      const s = map.get(nick);
      s.games += 1;
      if (p.team && winner && p.team === winner) s.wins += 1;

      const k = Number(p.k ?? 0), d = Number(p.d ?? 0), a = Number(p.a ?? 0);
      s.k += k; s.d += d; s.a += a;

      s.acsSum += Number(p.acs ?? 0);
      s.adrSum += Number(p.adr ?? 0);
      s.hsSum += Number(p.hs ?? 0);
      s.fkSum += Number(p.fk ?? 0);
      s.fdSum += Number(p.fd ?? 0);

      const agent = (p.agent || "Unknown").trim();
      s.agents.set(agent, (s.agents.get(agent) || 0) + 1);
    }
  }
__matchesRef = matches;

const tabPlayers = document.getElementById("tabPlayers");
const tabAgents = document.getElementById("tabAgents");
const tabMaps = document.getElementById("tabMaps");
const panelPlayers = document.getElementById("panelPlayers");
const panelAgents = document.getElementById("panelAgents");
const panelMaps = document.getElementById("panelMaps");

function setTab(which) {
  const isPlayers = which === "players";
  const isAgents = which === "agents";
  const isMaps = which === "maps";

  tabPlayers.classList.toggle("active", isPlayers);
  tabAgents.classList.toggle("active", isAgents);
  tabMaps.classList.toggle("active", isMaps);

  panelPlayers.style.display = isPlayers ? "block" : "none";
  panelAgents.style.display = isAgents ? "block" : "none";
  panelMaps.style.display = isMaps ? "block" : "none";
}

tabPlayers.addEventListener("click", () => setTab("players"));
tabAgents.addEventListener("click", () => setTab("agents"));
tabMaps.addEventListener("click", () => setTab("maps"));

renderAgentTable(summarizeAgents(matches));
renderMapTable(summarizeMaps(matches));

  // finalize
  const out = [];
  for (const s of map.values()) {
    s.winrate = s.games ? s.wins / s.games : 0;
    s.avgAcs = s.games ? s.acsSum / s.games : 0;
    s.avgAdr = s.games ? s.adrSum / s.games : 0;
    s.avgHs = s.games ? s.hsSum / s.games : 0;
    s.avgFk = s.games ? s.fkSum / s.games : 0;
    s.avgFd = s.games ? s.fdSum / s.games : 0;
    s.kda = (s.d > 0) ? ((s.k + s.a) / s.d) : (s.k + s.a);

    // top agent
    let topAgent = "-";
    let topCnt = -1;
    for (const [ag, cnt] of s.agents.entries()) {
      if (cnt > topCnt) { topCnt = cnt; topAgent = ag; }
    }
    s.topAgent = topAgent;

    s.rating = calcSimpleRating(s);
    out.push(s);
  }
  return out;
}

function sortStats(stats, key) {
  const dir = -1; // desc
  const getter = {
    rating: s => s.rating,
    winrate: s => s.winrate,
    games: s => s.games,
    acs: s => s.avgAcs,
    adr: s => s.avgAdr,
    hs: s => s.avgHs,
    kda: s => s.kda,
    fk: s => s.avgFk,
    fd: s => s.avgFd,
  }[key] || (s => s.rating);

  return [...stats].sort((a, b) => {
    const av = getter(a), bv = getter(b);
    if (bv !== av) return dir * (bv - av);
    // tie-breakers
    if (b.games !== a.games) return b.games - a.games;
    return a.nick.localeCompare(b.nick);
  });
}

function renderTable(stats) {
  const tbody = document.querySelector("#rankTable tbody");
  tbody.innerHTML = "";

  stats.forEach((s, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="nick"><span class="link" data-nick="${escapeHtml(s.nick)}">${escapeHtml(s.nick)}</span></td>
      <td>${s.games}</td>
      <td>${s.wins}</td>
      <td>${pct(s.winrate)}</td>
      <td>${s.k} / ${s.d} / ${s.a}</td>
      <td>${fmt1(s.kda)}</td>
      <td>${fmt0(s.avgAcs)}</td>
      <td>${fmt1(s.avgAdr)}</td>
      <td>${fmt1(s.avgHs)}</td>
      <td>${fmt1(s.avgFk)}</td>
      <td>${fmt1(s.avgFd)}</td>
      <td>${escapeHtml(s.topAgent)}</td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".link[data-nick]").forEach(el => {
  el.addEventListener("click", () => showPlayerDetail(el.dataset.nick));
});

}
function summarizeAgents(matches) {
  const m = new Map(); // agent -> stats
  let totalPicks = 0;

  for (const match of matches) {
    const winner = match.winner;
    for (const p of (match.players || [])) {
      const agent = (p.agent || "Unknown").trim();
      if (!m.has(agent)) {
        m.set(agent, { agent, picks:0, wins:0, games:0, acs:0, adr:0, hs:0, fk:0, fd:0 });
      }
      const s = m.get(agent);
      s.picks += 1;
      totalPicks += 1;
      s.games += 1;
      if (p.team === winner) s.wins += 1;

      s.acs += Number(p.acs ?? 0);
      s.adr += Number(p.adr ?? 0);
      s.hs  += Number(p.hs ?? 0);
      s.fk  += Number(p.fk ?? 0);
      s.fd  += Number(p.fd ?? 0);
    }
  }

  const out = [];
  for (const s of m.values()) {
    s.pickRate = totalPicks ? s.picks / totalPicks : 0;
    s.winrate  = s.games ? s.wins / s.games : 0;
    s.avgAcs = s.games ? s.acs / s.games : 0;
    s.avgAdr = s.games ? s.adr / s.games : 0;
    s.avgHs  = s.games ? s.hs / s.games : 0;
    s.avgFk  = s.games ? s.fk / s.games : 0;
    s.avgFd  = s.games ? s.fd / s.games : 0;
    out.push(s);
  }

  out.sort((a,b)=> (b.picks - a.picks) || (b.winrate - a.winrate) || a.agent.localeCompare(b.agent));
  return out;
}

function summarizeMaps(matches) {
  const m = new Map(); // map -> stats

  for (const match of matches) {
    const mapName = (match.map || "Unknown").trim();
    if (!m.has(mapName)) {
      m.set(mapName, { map: mapName, matches:0, acs:0, adr:0, hs:0, fk:0, fd:0, wins:0, games:0 });
    }
    const s = m.get(mapName);
    s.matches += 1;

    // 맵 통계는 "전체 플레이어 평균"으로 집계(맵 난이도/스코어 경향 보려는 용도)
    const winner = match.winner;
    for (const p of (match.players || [])) {
      s.games += 1;
      if (p.team === winner) s.wins += 1;
      s.acs += Number(p.acs ?? 0);
      s.adr += Number(p.adr ?? 0);
      s.hs  += Number(p.hs ?? 0);
      s.fk  += Number(p.fk ?? 0);
      s.fd  += Number(p.fd ?? 0);
    }
  }

  const out = [];
  for (const s of m.values()) {
    s.winrate = s.games ? s.wins / s.games : 0;
    s.avgAcs = s.games ? s.acs / s.games : 0;
    s.avgAdr = s.games ? s.adr / s.games : 0;
    s.avgHs  = s.games ? s.hs / s.games : 0;
    s.avgFk  = s.games ? s.fk / s.games : 0;
    s.avgFd  = s.games ? s.fd / s.games : 0;
    out.push(s);
  }

  out.sort((a,b)=> (b.matches - a.matches) || (b.avgAcs - a.avgAcs) || a.map.localeCompare(b.map));
  return out;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function main() {
  const statusEl = document.getElementById("status");
  const matchCountEl = document.getElementById("matchCount");
  const rawEl = document.getElementById("raw");
  const sortKeyEl = document.getElementById("sortKey");
  const searchEl = document.getElementById("search");

  let matches = [];
  let stats = [];

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
    matches = await res.json();
    if (!Array.isArray(matches)) throw new Error("matches.json must be an array");

    matchCountEl.textContent = String(matches.length);
    rawEl.textContent = JSON.stringify(matches.slice(0, 1), null, 2);
const debugEl = document.getElementById("debug");

const totalPlayerRows = matches.reduce((acc, m) => {
  const arr = Array.isArray(m.players) ? m.players : [];
  return acc + arr.length;
}, 0);

const sampleKeys = (() => {
  const first = matches?.[0]?.players?.[0];
  return first ? Object.keys(first).join(", ") : "(no player)";
})();

debugEl.textContent =
  `디버그: players 행수=${totalPlayerRows}, player keys=${sampleKeys}`;

    stats = summarize(matches);
    debugEl.textContent += ` / 집계된 닉네임 수=${stats.length}`;

    statusEl.textContent = "로드 완료";

    const refresh = () => {
      const key = sortKeyEl.value;
      const q = searchEl.value.trim().toLowerCase();

      let filtered = stats;
      if (q) filtered = stats.filter(s => s.nick.toLowerCase().includes(q));

      const sorted = sortStats(filtered, key);
      renderTable(sorted);
    };

    sortKeyEl.addEventListener("change", refresh);
    searchEl.addEventListener("input", refresh);

    refresh();
  } catch (e) {
    statusEl.textContent = `오류: ${e.message}`;
  }
}
function renderAgentTable(rows) {
  const tbody = document.querySelector("#agentTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  rows.forEach((s, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${escapeHtml(s.agent)}</td>
      <td>${s.picks}</td>
      <td>${pct(s.pickRate)}</td>
      <td>${pct(s.winrate)}</td>
      <td>${fmt0(s.avgAcs)}</td>
      <td>${fmt1(s.avgAdr)}</td>
      <td>${fmt1(s.avgHs)}</td>
      <td>${fmt1(s.avgFk)}</td>
      <td>${fmt1(s.avgFd)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMapTable(rows) {
  const tbody = document.querySelector("#mapTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  rows.forEach((s, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${escapeHtml(s.map)}</td>
      <td>${s.matches}</td>
      <td>${pct(s.winrate)}</td>
      <td>${fmt0(s.avgAcs)}</td>
      <td>${fmt1(s.avgAdr)}</td>
      <td>${fmt1(s.avgHs)}</td>
      <td>${fmt1(s.avgFk)}</td>
      <td>${fmt1(s.avgFd)}</td>
    `;
    tbody.appendChild(tr);
  });
}
let __matchesRef = [];

function showPlayerDetail(nick) {
  const box = document.getElementById("playerDetail");
  if (!box) return;

  // 해당 플레이어의 모든 기록 모으기
  const rows = [];
  for (const m of __matchesRef) {
    for (const p of (m.players || [])) {
      if ((p.nick || "").trim() === nick) {
        rows.push({ match: m, p });
      }
    }
  }

  const games = rows.length;
  const wins = rows.filter(r => r.p.team === r.match.winner).length;

  const sum = (key) => rows.reduce((acc, r) => acc + Number(r.p[key] ?? 0), 0);
  const K = sum("k"), D = sum("d"), A = sum("a");

  const avg = (key) => games ? sum(key) / games : 0;

  // 요원별
  const agentMap = new Map();
  for (const r of rows) {
    const ag = (r.p.agent || "Unknown").trim();
    agentMap.set(ag, (agentMap.get(ag) || 0) + 1);
  }
  const agentList = [...agentMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);

  // 맵별
  const mapMap = new Map();
  for (const r of rows) {
    const mp = (r.match.map || "Unknown").trim();
    mapMap.set(mp, (mapMap.get(mp) || 0) + 1);
  }
  const mapList = [...mapMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);

  const kda = D > 0 ? (K + A) / D : (K + A);

  box.style.display = "block";
  box.innerHTML = `
    <h3>${escapeHtml(nick)} 상세</h3>
    <div class="detailGrid">
      <div class="card2">
        <h3>요약</h3>
        <div class="small">경기 ${games} / 승 ${wins} / 승률 ${pct(games?wins/games:0)}</div>
        <div class="small">K/D/A: ${K} / ${D} / ${A} (KDA ${fmt1(kda)})</div>
        <div class="small">ACS ${fmt0(avg("acs"))} · ADR ${fmt1(avg("adr"))} · HS ${fmt1(avg("hs"))}%</div>
        <div class="small">FK ${fmt1(avg("fk"))} · FD ${fmt1(avg("fd"))}</div>
      </div>
      <div class="card2">
        <h3>많이 한 요원</h3>
        <div class="small">${agentList.map(([ag,c])=>`${escapeHtml(ag)} (${c})`).join(" · ") || "-"}</div>
        <h3 style="margin-top:10px;">많이 한 맵</h3>
        <div class="small">${mapList.map(([mp,c])=>`${escapeHtml(mp)} (${c})`).join(" · ") || "-"}</div>
      </div>
    </div>
    <div style="margin-top:12px;">
      <h3>최근 경기</h3>
      <div class="small">
        ${rows
          .slice(-5)
          .reverse()
          .map(r => {
            const win = r.p.team === r.match.winner ? "W" : "L";
            return `${r.match.played_at?.slice(0,10) || ""} · ${escapeHtml(r.match.map)} · ${win} · ${r.p.k}/${r.p.d}/${r.p.a} · ACS ${r.p.acs}`;
          })
          .join("<br/>")}
      </div>
    </div>
  `;
}

main();



