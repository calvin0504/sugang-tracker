// DGIST: 개설강좌 페이지는 조회 전엔 빈 화면이라 키워드 감지 불가(이전 keyword 체크는 항상 미감지).
// list.do 공개 API로 2026 가을학기(CMN17.20) 대학원(CMN12.02) 강좌 건수를 직접 판정한다.
// 서버 TLS가 낡아 Node fetch는 ECONNRESET — 반드시 페이지 컨텍스트에서 fetch 해야 한다.
const PAGE_URL = 'https://welcome.dgist.ac.kr/ucs/ucsqProfRespSbjtInq/index.do';

export default async function probe(page) {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const out = await page.evaluate(async () => {
    const body = new URLSearchParams({
      pageNum: '1', pageSize: '1', commonProgramId: 'UcsqProfRespSbjtInq',
      searchLang: 'ko', searchOrgnClsfDcd: 'CMN12.02', searchOrgnClsfDcd1: 'CMN12.02',
      searchOrgnClsfDcd2: 'CMN12.02', langPssbFlag: 'N', selectYearTerm: '2026CMN17.20',
      searchCuriShyy: '2011', _search: 'false', rows: '1', page: '1', sidx: '', sord: 'asc',
    }).toString();
    const r = await fetch('/ucs/ucsqProfRespSbjtInq/list.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
    });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const j = await r.json().catch(() => null);
    return { records: Number(j?.records ?? 0) };
  });
  if (out.error) return { status: 'error', error: `list.do ${out.error}` };
  if (out.records > 0) {
    return { status: 'detected', detail: `2026 가을학기 대학원 강좌 ${out.records.toLocaleString()}건 조회됨` };
  }
  return { status: 'not_detected', detail: '2026 가을학기 강좌 0건' };
}
