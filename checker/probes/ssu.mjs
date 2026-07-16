// 숭실대: SAP WebDynpro(zcmw2100)라 키워드 감지 불가(조회 폼만 렌더링) —
// '다음학기' 버튼으로 2026-2로 이동한 뒤(학기 이동 시 그리드가 초기화됨),
// 과목검색 탭에서 '연구'(2자 이상 필수)를 검색해 결과 그리드로 판정한다.
// 빈 그리드는 ~1,700자 + "데이터가 없습니다", 결과가 있으면 본문이 크게 늘어난다.
export default async function probe(page, school) {
  await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);

  const semNow = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll('input')]
          .map((i) => i.value)
          .find((v) => /^(1학기|여름학기|2학기|겨울학기)$/.test(v)) ?? null,
    );

  async function moveTo(target, button) {
    for (let i = 0; i < 3; i += 1) {
      if ((await semNow()) === target) return true;
      await page.getByText(button, { exact: true }).first().click({ force: true });
      await page.waitForTimeout(7000);
    }
    return (await semNow()) === target;
  }

  async function subjectSearch() {
    await page.getByText('과목검색', { exact: true }).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(4000);
    await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input[type=text]')].filter(
        (i) => i.offsetParent && !i.readOnly,
      );
      const field = inputs[inputs.length - 1];
      field.value = '연구';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.getByText('검색', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(10000);
    const text = await page.evaluate(() => document.body.innerText);
    return { empty: text.includes('데이터가 없습니다'), len: text.length };
  }

  if (!(await moveTo('2학기', '다음학기'))) {
    return { status: 'error', error: `2학기로 이동 실패 (현재: ${await semNow()})` };
  }
  const signal = await subjectSearch();
  if (!signal.empty && signal.len > 2500) {
    return { status: 'detected', detail: `2026-2 '연구' 검색 결과 렌더링 확인 (본문 ${signal.len.toLocaleString()}자)` };
  }
  if (!(await moveTo('1학기', '이전학기'))) {
    return { status: 'error', error: '컨트롤(1학기) 이동 실패' };
  }
  const control = await subjectSearch();
  if (control.empty) {
    return { status: 'error', error: '컨트롤(1학기)도 결과 없음 — UI/흐름 변경 의심' };
  }
  return { status: 'not_detected', detail: '2026-2 검색 결과 없음 (컨트롤 1학기는 정상)' };
}
