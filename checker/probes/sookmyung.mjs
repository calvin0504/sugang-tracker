// 숙명여대: SAP WebDynpro 페이지라 키워드 감지 불가(폼만 렌더링) —
// 페이지 기본 검색기간이 서버가 내려주는 현재 학기(현재 2026학년도/2학기)이므로,
// 기본값이 2026/2학기인지 확인한 뒤 '검색' 버튼을 눌러 결과 그리드로 판정한다.
// 데이터 없으면 "해당 테이블에 데이터가 없습니다"가 남고, 있으면 과목 행이 렌더링된다.
export default async function probe(page, school) {
  await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);

  const defaults = await page.evaluate(() => {
    const values = [...document.querySelectorAll('input')].map((i) => i.value);
    return {
      year: values.find((v) => /^\d{4}학년도$/.test(v)) ?? null,
      sem: values.find((v) => /^[12]학기$/.test(v)) ?? null,
    };
  });
  if (defaults.year !== '2026학년도' || defaults.sem !== '2학기') {
    return {
      status: 'not_detected',
      detail: `검색기간 기본값이 아직 ${defaults.year}/${defaults.sem} (2026학년도/2학기 대기)`,
    };
  }

  const before = await page.evaluate(() => document.body.innerText.length);
  await page.getByText('검색', { exact: true }).first().click({ timeout: 10000, force: true });
  await page.waitForTimeout(15000);

  const after = await page.evaluate(() => {
    const t = document.body.innerText;
    return { len: t.length, noData: t.includes('데이터가 없습니다') };
  });
  if (!after.noData && after.len > before + 500) {
    return {
      status: 'detected',
      detail: `2026-2 기본 검색에 과목 그리드 렌더링 확인 (본문 ${before}→${after.len}자)`,
    };
  }
  if (after.noData) {
    return { status: 'not_detected', detail: '2026-2 기본 검색 결과 0건 (데이터 없음 문구 유지)' };
  }
  return { status: 'error', error: `검색 후 상태 판정 불가 (본문 ${after.len}자, 없음문구 ${after.noData})` };
}
