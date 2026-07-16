// 이화여대: 유레카 Nexacro(XPLATFORM) 페이지라 키워드 감지 불가, 조회 API는
// 페이지 세션 상태와 결합돼 직접 HTTP 재현 시 항상 빈 데이터셋 — 폼을 JS로 구동한다.
// 페이지 기본 검색조건이 서버가 내려주는 현재 학기(현재 2026/20=2학기)이므로,
// 대학원 콤보(cbbUnivCd)만 채워 조회를 발사하고 dsGrid 행 수로 판정한다.
// 이 엔드포인트는 과거 학기를 서빙하지 않아 2026-1 컨트롤 조회가 불가 —
// 대신 "요청이 실제로 2026/20 조건으로 나갔는지"를 페이로드에서 검증한다.
export default async function probe(page, school) {
  let captured = null;
  page.on('response', async (res) => {
    const post = res.request().postData() ?? '';
    if (!res.url().includes('cmmController.do') || !post.includes('selectGridEtc')) return;
    // 행 포맷: ␞N␟<GROUP_CD>␟<SCHEDULE_CD>␟<ENG>␟<ADMIN>␟<YEAR_TERM_CD>␟<YEAR>␟<TERM_CD>␟…
    const cols = post.match(/Dataset:srch[\s\S]*?\x1eN\x1f(.*)$/)?.[1]?.split('\x1f') ?? [];
    const body = await res.text().catch(() => '');
    captured = { year: cols[5], term: cols[6], rows: (body.match(/\x1eN\x1f/g) ?? []).length };
  });

  await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);

  const driven = await page.evaluate(() => {
    let form = application.mainframe.VFrameSet.WorkFrame.frames[0]?.form;
    for (let d = 0; d < 6 && form && !(form.div_search && form.srch); d += 1) {
      const next = Object.keys(form).find(
        (k) => form[k]?._is_form && form[k] !== form && !k.startsWith('_'),
      );
      form = next ? form[next] : null;
    }
    if (!form) return { ok: false };
    // 대학원 콤보는 필수 검증 항목 — 서버가 내려준 목록의 첫 코드(일반대학원=31)를 쓴다
    const univ = String(form.univCd?.getColumn(0, 'UNIV_CD') ?? '31');
    form.div_search.cbbUnivCd.set_value(univ);
    form.srch.setColumn(0, 'UNIV_CD', univ);
    form.div_search_btnSearch_onclick();
    return { ok: true, univ };
  });
  if (!driven.ok) {
    return { status: 'error', error: 'Nexacro 폼을 찾지 못함 (페이지 구조 변경 의심)' };
  }
  for (let i = 0; i < 25 && !captured; i += 1) await page.waitForTimeout(1000);

  if (!captured) {
    return { status: 'error', error: '조회 XHR(selectGridEtc)이 발사되지 않음 (UI 변경 의심)' };
  }
  if (captured.year !== '2026' || captured.term !== '20') {
    return {
      status: 'not_detected',
      detail: `페이지 기본 학기가 아직 ${captured.year}/${captured.term} (2026/20 대기)`,
    };
  }
  if (captured.rows > 0) {
    return { status: 'detected', detail: `2026-2 대학원 개설강좌 ${captured.rows.toLocaleString()}건 조회됨` };
  }
  return { status: 'not_detected', detail: '2026-2 조건 조회 정상 발사, 개설강좌 0건' };
}
