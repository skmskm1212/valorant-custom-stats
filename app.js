// app.js - 정적 웹 변환기 (서버 없이 동작)

const $ = (id) => document.getElementById(id);

function cleanLines(raw) {
  return String(raw || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePercent(s) {
  const n = Number(String(s).replace("%", "").trim());
  return Number.isFinite(n) ? n / 100 : null;
}

function parseKDA(s) {
  const parts = String(s).split("/").map((x) => x.trim());
  if (parts.length !== 3) return null;
  const k = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  const a = parseInt(parts[2], 10);
  if (![k, d, a].every(Number.isFinite)) return null;
  return { k, d, a };
}

function parseKdaRatio(s) {
  const left = String(s).split(":")[0]?.trim();
  const n = Number(left);
  return Number.isFinite(n) ? n : null;
}

/**
 * tail 줄 순서:
 * ADR, DDΔ, HS%, KAST(버림), KD, FK, FD, MK(버림), PL, DF
 */
function parseTail(line) {
  const t = String(line).split(/\s+/).filter(Boolean);
  if (t.length < 10) return null;

  const adr = parseInt(t[0], 10);
  const dd = parseInt(t[1], 10);
  const hs = parsePercent(t[2]);
  const kd = Number(t[4]);
  const fk = parseInt(t[5], 10);
  const fd = parseInt(t[6], 10);
  const pl = parseInt(t[8], 10);
  const df = parseInt(t[9], 10);

  return {
    adr: Number.isFinite(adr) ? adr : null,
    ddDelta: Number.isFinite(dd) ? dd : null,
    hs,
    kd: Number.isFinite(kd) ? kd : null,
    fk: Number.isFinite(fk) ? fk : null,
    fd: Number.isFinite(fd) ? fd : null,
    pl: Number.isFinite(pl) ? pl : null,
    df: Number.isFinite(df) ? df : null,
  };
}

function isHeader(line) {
  return (
    line.includes("아군") ||
    line.includes("적군") ||
    line.includes("승리") ||
    line.includes("패배")
  );
}

function looksLikeBlockStart(lines, i) {
  // 요원 다음 줄이 닉#태그 형태인지로 블록 시작 판별
  return (lines[i + 1] ?? "").includes("#");
}

function parsePlayers(rawText) {
  const lines = cleanLines(rawText);

  let team = null;   // ALLY/ENEMY
  let result = null; // WIN/LOSE
  const players = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 헤더 인식
    if (isHeader(line)) {
      if (line.includes("아군")) team = "ALLY";
      if (line.includes("적군")) team = "ENEMY";
      if (line.includes("승리")) result = "WIN";
      if (line.includes("패배")) result = "LOSE";
      continue;
    }

    // 한 사람 블록
    if (team && result && looksLikeBlockStart(lines, i)) {
      const agent = lines[i];
      const playerId = lines[i + 1];

      const rankDetail = lines[i + 2] ?? "";
      const rankTier = lines[i + 3] ?? "";
      // i+4 = OP Score (버림)
      const place = lines[i + 5] ?? null;
      const kdaLine = lines[i + 6] ?? "";
      const kdaRatioLine = lines[i + 7] ?? "";
      const acsLine = lines[i + 8] ?? "";
      const tailLine = lines[i + 9] ?? "";

      const kda = parseKDA(kdaLine);
      if (!kda) continue;

      const kdaRatio = parseKdaRatio(kdaRatioLine);
      const acs = Number(String(acsLine).trim());
      const tail = parseTail(tailLine);

      const isUnranked =
        rankTier.includes("언랭크") || rankDetail.includes("언랭크");

      players.push({
        team,
        result,
        agent,
        playerId,
        rank: isUnranked ? "언랭크" : (rankTier || null),
        rankDetail: rankDetail || null,
        place: place || null,
        k: kda.k,
        d: kda.d,
        a: kda.a,
        kdaRatio,
        acs: Number.isFinite(acs) ? acs : null,
        adr: tail?.adr ?? null,
        ddDelta: tail?.ddDelta ?? null,
        hs: tail?.hs ?? null,
        kd: tail?.kd ?? null,
        fk: tail?.fk ?? null,
        fd: tail?.fd ?? null,
        pl: tail?.pl ?? null,
        df: tail?.df ?? null,
      });

      i += 9;
    }
  }

  return players;
}

function toIntOrNull(v) {
  const n = parseInt(String(v || "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function buildMatchObject() {
  const rawText = $("rawText").value;

  const players = parsePlayers(rawText);

  const matchId = $("matchId").value.trim() || "REPLACE_ME";
  const playedAt = $("playedAt").value.trim() || null;
  const map = $("map").value.trim() || null;
  const mode = $("mode").value.trim() || "custom";
  const ally = toIntOrNull($("scoreAlly").value);
  const enemy = toIntOrNull($("scoreEnemy").value);

  return {
    id: matchId,
    playedAt,
    map,
    mode,
    score: { ally, enemy },
    players,
  };
}

function setStatus(msg) {
  $("status").textContent = msg;
}

function makeAppendSnippet(matchObj) {
  // matches.json 배열 마지막에 붙일 때 보통 ", { ... }" 형태가 필요함
  return ",\n" + JSON.stringify(matchObj, null, 2);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

function init() {
  $("btnConvert").addEventListener("click", () => {
    try {
      const matchObj = buildMatchObject();

      const json = JSON.stringify(matchObj, null, 2);
      $("outJson").value = json;
      $("outAppend").value = makeAppendSnippet(matchObj);

      const cnt = matchObj.players.length;
      const allyCnt = matchObj.players.filter(p => p.team === "ALLY").length;
      const enemyCnt = matchObj.players.filter(p => p.team === "ENEMY").length;

      setStatus(
        `완료\n- players: ${cnt} (ALLY ${allyCnt}, ENEMY ${enemyCnt})\n- id: ${matchObj.id}\n\noutJson을 matches.json에 추가해서 커밋하면 반영됨`
      );
    } catch (e) {
      setStatus("실패: " + (e?.message || String(e)));
    }
  });

  $("btnClear").addEventListener("click", () => {
    $("rawText").value = "";
    $("outJson").value = "";
    $("outAppend").value = "";
    setStatus("초기화됨");
  });

  $("btnCopy").addEventListener("click", async () => {
    const text = $("outJson").value.trim();
    if (!text) return setStatus("복사할 JSON이 없음");
    try {
      await copyToClipboard(text);
      setStatus("복사 완료");
    } catch (e) {
      setStatus("복사 실패: " + (e?.message || String(e)));
    }
  });

  $("btnDownload").addEventListener("click", () => {
    const text = $("outJson").value.trim();
    if (!text) return setStatus("다운로드할 JSON이 없음");
    const id = $("matchId").value.trim() || "output";
    downloadText(`${id}.json`, text);
    setStatus("다운로드 완료");
  });

  setStatus("대기중");
}

init();
