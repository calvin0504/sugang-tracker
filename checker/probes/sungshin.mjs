// 성신여대: 조회 폼 페이지라 키워드 감지 불가 — 조회 API(findBCRM02010Main.do)를
// 직접 호출해 건수로 판정한다. 학기 코드는 'COMM063.10'(1학기)/'COMM063.20'(2학기)
// 형식이고, 검증 통과를 위해 교과목명 '학' 검색을 조건으로 쓴다(전 과목의 대부분 매칭).
// req-protocol/res-protocol 커스텀 헤더가 없으면 서버가 빈 결과를 반환한다.
const API = 'https://sugang.sungshin.ac.kr/findBCRM02010Main.do';

const SEM_CODE = { 1: 'COMM063.10', 2: 'COMM063.20' };

async function countRows(semCd) {
  const body = new URLSearchParams({
    yy: '2026', semCd, orgClsfCd: '', sbjMngCd: '', objCrsCd: '', dptMjrCd: '',
    sbjNoNm: '학', cpdivCd: '', cmpCd: '', sbjAreaCd: '', charSbjAreaCd: '',
  }).toString();
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'req-protocol': 'urlencoded',
      'res-protocol': 'json',
      'X-Requested-With': 'XMLHttpRequest',
      Origin: 'https://sugang.sungshin.ac.kr',
      Referer: 'https://sugang.sungshin.ac.kr/findBCRM02010.do',
    },
    body,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json.length : 0;
}

export default async function probe() {
  const signal = await countRows(SEM_CODE[2]);
  if (signal > 0) {
    return { status: 'detected', detail: `2026-2 개설강좌 ${signal.toLocaleString()}건 조회됨 (입력 진행 중일 수 있음 — 수집 전 건수 추이 확인)` };
  }
  const control = await countRows(SEM_CODE[1]);
  if (control === 0) {
    return { status: 'error', error: '컨트롤(2026-1)도 0건 — API/학기코드 변경 의심' };
  }
  return { status: 'not_detected', detail: `2026-2 조회 0건 (컨트롤 2026-1은 ${control}건 정상)` };
}
