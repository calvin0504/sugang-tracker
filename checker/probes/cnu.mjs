// 충남대: 수강편람조회 공개 페이지(checkMenu.jsp 게이트웨이)에서 2026년/2학기로
// 조회했을 때 "총 N 건" > 0 인지로 판정한다.
// (기존 OutLinkController.do 직접 GET은 빈 페이지 — POST 게이트웨이라서)
// 2026-08: 사이트 기본 학기가 하기방학특별학기→2학기로 바뀌며 "당시 기본값 텍스트 클릭"
// 폴백이 깨짐 → 콤보 현재값을 화면에서 읽어, 이미 2학기면 조작 없이 조회만 한다.
const URL = 'https://cnuit.cnu.ac.kr/checkMenu.jsp?p0=M69r16057e79Y231';

export default async function probe(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // 게이트웨이 리다이렉트 중 document.body가 null인 순간이 있어 가드 필수
  await page.waitForFunction(
    () => document.body && document.body.innerText.includes('수강편람조회'),
    { timeout: 45000 },
  );
  await page.waitForTimeout(4000);

  const year = await page.locator('input[title="년도"]').first().inputValue().catch(() => null);
  if (year && year !== '2026') {
    return { status: 'error', error: `년도 기본값이 ${year} — 프로브는 2026을 가정, 구조 확인 필요` };
  }

  // "학기" 라벨 다음 줄이 콤보의 현재 표시값 (eXBuilder 콤보는 input이 아니라 innerText로 읽음)
  const currentTerm = await page.evaluate(() => {
    const lines = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const i = lines.indexOf('학기');
    return i >= 0 ? lines[i + 1] : null;
  });

  if (currentTerm !== '2학기') {
    if (!currentTerm) {
      return { status: 'error', error: '학기 콤보 현재값을 찾지 못함 — 페이지 구조 변경 확인 필요' };
    }
    // 현재값 텍스트를 클릭해 콤보를 열고 2학기 선택
    await page.locator(`text="${currentTerm}"`).first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    await page.locator('div,li,span').filter({ hasText: /^2학기$/ }).last().click({ timeout: 5000 });
    await page.waitForTimeout(800);
  }

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
