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
      <td class="nick">${escapeHtml(s.nick)}</td>
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

main();


