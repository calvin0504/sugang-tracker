// 경북대: 수업시간표 페이지(knuin)는 조회 폼만 렌더링돼 키워드 감지 불가 —
// 공개 JSON API(selectListLectPlnInqr)에 2026 + 2학기 코드(CMBS001400002)를 던져
// 행 수로 판정한다. 신호가 0건이면 1학기(CMBS001400001)를 컨트롤로 조회한다.
const API =
  'https://knuin.knu.ac.kr/public/web/stddm/lsspr/syllabus/lectPlnInqr/selectListLectPlnInqr';

const SEM_CODE = { 1: 'CMBS001400001', 2: 'CMBS001400002' };

async function countRows(semCode) {
  const search = {
    estblYear: '2026', estblSmstrSctcd: semCode, sbjetCd: '', sbjetNm: '', crgePrfssNm: '',
    sbjetRelmCd: '', sbjetSctcd: '', estblDprtnCd: '', rmtCrseYn: '', rprsnLctreLnggeSctcd: '',
    flplnCrseYn: '', pstinNtnnvRmtCrseYn: '', dgGbDstrcRmtCrseYn: '', sugrdEvltnYn: '',
    prctsExrmnYn: '', gubun: '01', isApi: 'Y', bldngSn: '', bldngCd: '', bldngNm: '',
    lssnsLcttmUntcd: '', sbjetSctcd2: '', contents: '', lctreLnggeSctcd: 'ko',
    knuFtrDesigYn: '', cltreHmntsCltreYn: '', sdgCltreYn: '', rltmCrseYn: '', riseRmtCrseYn: '',
  };
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({ search }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data.length : 0;
}

export default async function probe() {
  const signal = await countRows(SEM_CODE[2]);
  if (signal > 0) {
    return { status: 'detected', detail: `2026-2 수업시간표 ${signal.toLocaleString()}행 조회됨` };
  }
  const control = await countRows(SEM_CODE[1]);
  if (control === 0) {
    return { status: 'error', error: '컨트롤(2026-1)도 0건 — API/응답 포맷 변경 의심' };
  }
  return { status: 'not_detected', detail: `2026-2 조회 0건 (컨트롤 2026-1은 ${control}건 정상)` };
}
