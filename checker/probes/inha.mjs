// 인하대: ASP.NET WebForms 그리드 페이지라 키워드 감지 불가(폼+그리드만) —
// 학기 셀렉트(#ddlYearterm)를 20262로 맞추고 조회(#ibtnSearch)해 본문 크기로 판정한다.
// 실측: 결과 있는 학기 ~39,000자, 빈 폼 ~2,400자.
const LEN_THRESHOLD = 10000;

export default async function probe(page, school) {
  await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  const options = await page.evaluate(
    () => [...(document.querySelector('#ddlYearterm')?.options ?? [])].map((o) => o.value),
  );
  if (!options.includes('20262')) {
    return { status: 'not_detected', detail: '학기 콤보에 20262(2026-2) 옵션 미등재' };
  }

  async function query(term) {
    await page.selectOption('#ddlYearterm', term);
    await page.waitForTimeout(2000);
    await page.click('#ibtnSearch');
    await page.waitForTimeout(8000);
    return page.evaluate(() => document.body.innerText.length);
  }

  const signal = await query('20262');
  if (signal > LEN_THRESHOLD) {
    return { status: 'detected', detail: `2026-2 시간표 그리드 렌더링 확인 (본문 ${signal.toLocaleString()}자)` };
  }
  const control = await query('20261');
  if (control <= LEN_THRESHOLD) {
    return { status: 'error', error: `컨트롤(2026-1)도 ${control}자 — UI/흐름 변경 의심` };
  }
  return { status: 'not_detected', detail: `2026-2 조회 결과 없음 (${signal}자, 컨트롤은 ${control}자 정상)` };
}
