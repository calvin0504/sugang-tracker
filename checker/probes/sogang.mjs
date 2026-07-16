// 서강대: SAP WebDynpro(zcmw9016)라 키워드 감지 불가(조회 폼만 렌더링) —
// 콤보를 키보드로 구동해 학기=2학기, 소속구분=대학(첫 항목)을 선택하고 검색한다.
// 결과 그리드가 렌더링되면 본문에 "학년도 2학기" 과목 행이 대량으로 실린다.
// 신호가 없으면 1학기를 컨트롤로 같은 흐름을 검증한다.
export default async function probe(page, school) {
  await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);

  async function selectCombo(combo, wanted) {
    await combo.click({ force: true });
    await page.waitForTimeout(1200);
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(600);
      if (!wanted || (await combo.inputValue()) === wanted) break;
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
    return combo.inputValue();
  }

  async function search(semester) {
    const combos = await page.locator('input[role=combobox], input[aria-haspopup]').all();
    const values = await Promise.all(combos.map((c) => c.inputValue().catch(() => '')));
    const semCombo = combos[values.findIndex((v) => /학기$/.test(v))];
    const orgCombo = combos[values.findIndex((v) => v === '')];
    if (!semCombo || !orgCombo) throw new Error('학기/소속 콤보를 찾지 못함');
    const sem = await selectCombo(semCombo, semester);
    if (sem !== semester) throw new Error(`학기 콤보 선택 실패 (${sem})`);
    await selectCombo(orgCombo, null); // 첫 항목 = 대학
    await page.getByText('검색', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(12000);
    const text = await page.evaluate(() => document.body.innerText);
    return { empty: text.includes('결과가 없습니다'), len: text.length };
  }

  const signal = await search('2학기');
  if (!signal.empty && signal.len > 5000) {
    return { status: 'detected', detail: `2026-2 개설교과목 그리드 렌더링 확인 (본문 ${signal.len.toLocaleString()}자)` };
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);
  const control = await search('1학기');
  if (control.empty) {
    return { status: 'error', error: '컨트롤(1학기)도 결과 없음 — UI/흐름 변경 의심' };
  }
  return { status: 'not_detected', detail: '2026-2 검색 결과 없음 (컨트롤 1학기는 정상)' };
}
