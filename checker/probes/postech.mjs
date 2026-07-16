// POSTECH: plms 개설과목조회는 조회 폼+기본학기 목록만 렌더링돼 키워드 감지 불가 —
// GET 파라미터(year/semester)로 직접 조회해 "전체 갯수 : N"으로 판정한다.
// semester 코드: 10=1학기, 11=여름, 20=2학기, 21=겨울.
const BASE = 'https://plms.postech.ac.kr/local/ubion/course/lists.php';

async function countCourses(semester) {
  const res = await fetch(`${BASE}?year=2026&semester=${semester}&dept=&groupcode=&cc=&keyfield=&keyword=`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  // 서버가 요청 학기를 실제로 반영했는지 selected 옵션으로 확인
  if (!new RegExp(`<option value="${semester}"\\s+selected`).test(html)) {
    throw new Error('학기 파라미터가 반영되지 않음 (폼 변경 의심)');
  }
  const m = html.match(/갯수[^0-9]*([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

export default async function probe() {
  const signal = await countCourses('20');
  if (signal === null) {
    return { status: 'error', error: '"전체 갯수" 표기를 찾지 못함 (페이지 변경 의심)' };
  }
  if (signal > 0) {
    return { status: 'detected', detail: `2026-2 개설과목 ${signal.toLocaleString()}건 조회됨` };
  }
  const control = await countCourses('10');
  if (!control) {
    return { status: 'error', error: '컨트롤(2026-1)도 0건 — 조회 방식 변경 의심' };
  }
  return { status: 'not_detected', detail: `2026-2 조회 0건 (컨트롤 2026-1은 ${control}건 정상)` };
}
