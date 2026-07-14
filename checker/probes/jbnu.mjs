// 전북대: 구 oasis는 폐쇄(TLS 단계 거부) — JUMP 포털의 공개 수강개설정보조회 API 사용.
// date.do가 "개설강좌조회기간" 여부(strSchedule Y/N)와 기간을 알려주고,
// list.do는 기간 중 실제 과목 배열을 반환한다. 학기코드 SUSR016.020 = 2학기.
const BASE = 'https://jump.jbnu.ac.kr/SCH/SucrLessnSbjctInq';
const FORM = new URLSearchParams({
  'default.locale': 'CCMN101.KOR',
  '@d1#strYrsa': '2026',
  '@d1#strSemstrCd': 'SUSR016.020',
  '@d#': '@d1#',
  '@d1#': 'dmReqKey',
  '@d1#tp': 'dm',
}).toString();

async function call(path) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: FORM,
    signal: AbortSignal.timeout(20000),
  });
  return res.json();
}

export default async function probe() {
  const date = await call('date.do');
  const sched = date?.dmResSchedule;
  if (sched?.strSchedule === 'Y') {
    return { status: 'detected', detail: `개설강좌조회기간 개시 (${sched.strBgngYmd} ~)` };
  }
  // 게이트가 N이어도 데이터가 먼저 열리는 경우 대비 이중 확인
  const list = await call('list.do').catch(() => null);
  if ((list?.dsEstSbjList?.length ?? 0) > 0) {
    return { status: 'detected', detail: `개설강좌 ${list.dsEstSbjList.length}건 조회됨` };
  }
  return {
    status: 'not_detected',
    detail: sched?.strBgngYmd ? `조회기간 미개시 (예정: ${sched.strBgngYmd})` : '스케줄 응답 없음',
  };
}
