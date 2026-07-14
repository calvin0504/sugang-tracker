// 고려대: 공개 과목조회(sugang.korea.ac.kr/p/v/lectList)의 데이터 API를 직접 호출.
// 반드시 lectList GET으로 세션 쿠키를 먼저 받아야 함 (없으면 공개된 학기도 500).
// 미공개 학기는 code 500 + "수업정보 조회 기간이 아닙니다." 로 응답한다.
// 코드표: pTerm 2R=2학기, pGradCd 0309=대학원, pCampus 1=서울.
const LIST_URL = 'https://sugang.korea.ac.kr/p/v/lectList?lang=ko';
const DATA_URL = 'https://sugang.korea.ac.kr/d/v/lectHakbu';

export default async function probe() {
  const first = await fetch(LIST_URL, { signal: AbortSignal.timeout(30000) });
  const cookies = (first.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .join('; ');

  const body = new URLSearchParams({
    pYear: '2026', pTerm: '2R', pCampus: '1', pGradCd: '0309', pCourDiv: '00',
    pCol: '0140', pDept: '0142', pCredit: '', pDay: '', pStartTime: '', pEndTime: '',
    pProf: '', pCourCd: '', pCourCls: '', pCourNm: '', strYear: '2026', strTerm: '1S',
  });
  const res = await fetch(`${DATA_URL}?fake=${Date.now()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: LIST_URL,
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: cookies,
    },
    body: body.toString(),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => null);
  if (!json) {
    return { status: 'error', error: `lectHakbu 응답 파싱 실패 (HTTP ${res.status})` };
  }
  if (String(json.code) === '200' && (json.rows?.length ?? 0) > 0) {
    return { status: 'detected', detail: `대학원 2026-2 과목 조회됨 (${json.rows.length}건 샘플)` };
  }
  return { status: 'not_detected', detail: json.message ?? `code ${json.code}` };
}
