// 건국대: 종합강의시간표 페이지는 조회 폼만 렌더링돼 키워드 감지 불가 —
// 공개 조회 API(GcouVistTotalTimetableInq/find.do)에 2026/2학기(B01012)를 던져
// 행 수로 판정한다. 학과 미지정 시 전체가 반환된다.
// 신호가 0건이면 2026-1(B01011)을 컨트롤로 조회해 API 변경을 error로 드러낸다.
const API = 'https://kuis.konkuk.ac.kr/GcouVistTotalTimetableInq/find.do';

async function countRows(shtm) {
  const body = new URLSearchParams({
    '@d1#argLtYy': '2026', '@d1#argLtShtm': shtm, '@d1#argGrsc': '', '@d1#argSust': '',
    '@d1#argCampFg': '', '@d1#argProgramNm': '종합강의시간표조회',
    '@d#': '@d1#', '@d1#': 'dmParam', '@d1#tp': 'dm',
  }).toString();
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      Referer: 'https://kuis.konkuk.ac.kr/ext/gcouVistTotalTimetable.do',
    },
    body,
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const list = Object.values(json).find(Array.isArray) ?? [];
  return list.length;
}

export default async function probe() {
  const signal = await countRows('B01012');
  if (signal > 0) {
    return { status: 'detected', detail: `2026-2 종합시간표 ${signal.toLocaleString()}과목 조회됨` };
  }
  const control = await countRows('B01011');
  if (control === 0) {
    return { status: 'error', error: '컨트롤(2026-1)도 0건 — API/응답 포맷 변경 의심' };
  }
  return { status: 'not_detected', detail: `2026-2 조회 0건 (컨트롤 2026-1은 ${control}건 정상)` };
}
