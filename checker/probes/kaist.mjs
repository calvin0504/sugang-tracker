// KAIST: OTL(otl.kaist.ac.kr) 공개 API로 2026 가을학기 강의 존재 여부 확인.
// semester 코드: 1=봄, 3=가을. 미공개 학기는 빈 배열을 반환하므로 배열 유무가 곧 공개 신호.
// (erp.kaist.ac.kr 편람 페이지는 세션 필요 SPA라 크롤링 불가 — OTL이 공식 데이터를 동기화함)
const API = 'https://otl.kaist.ac.kr/api/lectures?year=2026&semester=3&limit=1';

export default async function probe() {
  const res = await fetch(API, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    return { status: 'error', error: `OTL API HTTP ${res.status}` };
  }
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    return { status: 'detected', detail: 'OTL API에 2026 가을학기 강의 등재됨' };
  }
  return { status: 'not_detected', detail: 'OTL API 2026 가을학기 빈 배열' };
}
