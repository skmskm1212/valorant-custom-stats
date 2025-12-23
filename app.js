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
