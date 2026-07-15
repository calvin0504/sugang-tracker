// 중앙대: WebSquare 페이지는 조회 폼만 렌더링돼 키워드 감지가 구조적으로 불가 —
// 공개 XML API(sUskSif001/selectSbjt.do)에 2026/2학기 + 과목명 '학' 검색을 던져
// 행 수로 판정한다. (검색어가 필수라 흔한 글자로 전수 근사. 연도 필터 유효성은
// 2027 조회 시 0건으로 검증됨.)
// 신호가 0건이면 2026-1을 컨트롤로 조회해 API 변경으로 인한 미탐을 error로 드러낸다.
const API = 'https://cautis.cau.ac.kr/TIS/std/usk/sUskSif001/selectSbjt.do';

async function countRows(year, shtm) {
  const body =
    '<map><campfg value=""/><course value=""/><sust value=""/><search_gb value="nm"/>' +
    `<year value="${year}"/><shtm value="${shtm}"/><kornm value="학"/></map>`;
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
    body,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return (text.match(/<map id='\d+'/g) ?? []).length;
}

export default async function probe() {
  const signal = await countRows(2026, 2);
  if (signal > 0) {
    return { status: 'detected', detail: `2026-2 과목명 '학' 검색 ${signal.toLocaleString()}건` };
  }
  const control = await countRows(2026, 1);
  if (control === 0) {
    return { status: 'error', error: '컨트롤(2026-1)도 0건 — API/응답 포맷 변경 의심' };
  }
  return { status: 'not_detected', detail: `2026-2 조회 0건 (컨트롤 2026-1은 ${control}건 정상)` };
}
