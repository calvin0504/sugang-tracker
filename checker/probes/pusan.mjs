// 부산대: 수강편람 페이지는 조회 폼만 렌더링돼 키워드 감지 불가 —
// 조회 액션(resultViewBySesdb.do)에 2026/2학기(0020)+대학원(0002)을 직접 POST해
// 응답 크기·행 수로 판정한다. 실측: 데이터 있는 학기는 900KB+/2,600행+, 빈 학기는 소형.
const API = 'https://his.pusan.ac.kr/courseCatalog/style-guide/resultViewBySesdb.do';

async function query(findTerm) {
  const body = new URLSearchParams({
    findYear: '2026', findTerm, findUnivType: '0002', findDeptType: '',
    findDeptCd: '', findGradCd: '', findUnivCd: '', findMajorCd: '',
  }).toString();
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://his.pusan.ac.kr/style-guide/19813/subview.do',
    },
    body,
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return (html.match(/<tr/g) ?? []).length;
}

export default async function probe() {
  const signal = await query('0020');
  if (signal > 50) {
    return { status: 'detected', detail: `2026-2 대학원 편람 ${signal.toLocaleString()}행 조회됨` };
  }
  const control = await query('0010');
  if (control <= 50) {
    return { status: 'error', error: `컨트롤(2026-1)도 ${control}행 — 조회 방식 변경 의심` };
  }
  return { status: 'not_detected', detail: `2026-2 조회 ${signal}행 (컨트롤 2026-1은 ${control}행 정상)` };
}
