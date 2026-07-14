// 국민대: 수강신청 서버가 운영기간 외에는 방화벽으로 닫힘 (26-1은 4월 말 폐쇄, 26-2는 8월 초 재개 예상).
// 공개 공통코드 API가 응답하기 시작하는 것 자체가 재개 신호이고, 응답에 2026-2 코드가 있으면 감지.
const API = 'https://sugang.kookmin.ac.kr/api/subject/public/commoncodes/all';

export default async function probe() {
  let res;
  try {
    res = await fetch(API, { signal: AbortSignal.timeout(15000) });
  } catch {
    return {
      status: 'not_detected',
      detail: '수강신청 서버 미개방(타임아웃) — 8월 초 재개 예상, 서버 응답 시작이 임박 신호',
    };
  }
  const text = await res.text();
  if (text.includes('20262') || (text.includes('2026') && text.includes('2학기'))) {
    return { status: 'detected', detail: '공통코드 API에 2026-2 항목 존재' };
  }
  return { status: 'not_detected', detail: `서버 응답 재개(HTTP ${res.status}) — 2026-2 코드는 미등재` };
}
