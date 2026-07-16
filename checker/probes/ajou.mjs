// 아주대: mhaksa AngularJS SPA라 키워드 감지 불가, API(cvt.do)는 페이지 세션 필요 —
// 페이지를 연 뒤 same-origin fetch로 대학원 수업계획서 조회 API를 호출해 행 수로 판정한다.
// 학기 코드: U0002001=1학기, U0002003=2학기.
export default async function probe(page, school) {
  await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(10000);

  const result = await page.evaluate(async () => {
    async function q(shtm) {
      const res = await fetch('/nt/cvt.do', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        body: JSON.stringify({
          url: '/uni/gun/gcou/lssn/findGcouLecturePlanDocumentReg.action',
          param: { strSubmattFg: '', strYy: '2026', strShtmCd: shtm, strSustCd: '', strMjCd: '', strStdFg: '' },
        }),
      });
      const json = await res.json().catch(() => null);
      return json?.DatasetList?.DS_COUR120?.length ?? 0;
    }
    const signal = await q('U0002003');
    return { signal, control: signal > 0 ? null : await q('U0002001') };
  });

  if (result.signal > 0) {
    return { status: 'detected', detail: `2026-2 대학원 수업계획 ${result.signal.toLocaleString()}건 조회됨` };
  }
  if (result.control === 0) {
    return { status: 'error', error: '컨트롤(2026-1)도 0건 — API 변경 의심' };
  }
  return {
    status: 'not_detected',
    detail: `2026-2 조회 0건 (컨트롤 2026-1은 ${result.control}건 정상)`,
  };
}
