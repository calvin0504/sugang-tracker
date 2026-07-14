// 충남대: 수강편람조회 공개 페이지(checkMenu.jsp 게이트웨이)에서 학기 콤보를
// 2학기로 바꿔 조회했을 때 "총 N 건" > 0 인지로 판정한다.
// (기존 OutLinkController.do 직접 GET은 빈 페이지 — POST 게이트웨이라서)
const URL = 'https://cnuit.cnu.ac.kr/checkMenu.jsp?p0=M69r16057e79Y231';

export default async function probe(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // 게이트웨이 리다이렉트 중 document.body가 null인 순간이 있어 가드 필수
  await page.waitForFunction(
    () => document.body && document.body.innerText.includes('수강편람조회'),
    { timeout: 45000 },
  );
  await page.waitForTimeout(4000);

  // 학기 콤보 열기 (eXBuilder 콤보 — input[title] 우선, 실패 시 현재 표시 텍스트 클릭)
  try {
    await page.locator('input[title="학기"]').first().click({ timeout: 5000 });
  } catch {
    await page.locator('text=하기방학특별학기').first().click({ timeout: 5000 });
  }
  await page.waitForTimeout(1200);
  await page.locator('div,li,span').filter({ hasText: /^2학기$/ }).last().click({ timeout: 5000 });
  await page.waitForTimeout(800);
  await page.locator('div,button,a,span').filter({ hasText: /^조회$/ }).first().click({ timeout: 5000 });
  // 응답이 수 MB라 렌더링까지 여유를 둔다
  await page.waitForTimeout(12000);

  const result = await page.evaluate(() => {
    const t = document.body?.innerText ?? '';
    const m = t.match(/총\s*([\d,]+)\s*건/);
    return { total: m ? m[1] : null, nodata: t.includes('조회된 데이터가 없습니다') };
  });
  const count = result.total ? Number(result.total.replace(/,/g, '')) : 0;
  if (count > 0 && !result.nodata) {
    return { status: 'detected', detail: `2026-2 조회 결과 총 ${count.toLocaleString()}건` };
  }
  return {
    status: 'not_detected',
    detail: result.total === null ? '건수 표시를 찾지 못함 (0건 추정)' : '2026-2 조회 0건',
  };
}
