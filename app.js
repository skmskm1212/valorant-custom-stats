async function main() {
  const statusEl = document.getElementById("status");
  const matchCountEl = document.getElementById("matchCount");
  const rawEl = document.getElementById("raw");

  try {
    // GitHub Pages에서는 파일 경로가 그대로 URL이 됨
    const res = await fetch("./public/data/matches.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);

    const matches = await res.json();
    if (!Array.isArray(matches)) throw new Error("matches.json must be an array");

    statusEl.textContent = "로드 완료";
    matchCountEl.textContent = String(matches.length);
    rawEl.textContent = JSON.stringify(matches.slice(0, 2), null, 2); // 앞 2개만 표시
  } catch (e) {
    statusEl.textContent = `오류: ${e.message}`;
  }
}

main();
