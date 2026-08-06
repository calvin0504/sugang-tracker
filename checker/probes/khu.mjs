// 경희대: sugang.khu.ac.kr 랜딩은 iframe 속 조회 폼이라 키워드가 구조적으로 안 뜸(조용한 미탐)
// → coreMain 프레임에서 "종합시간표 조회" 메뉴를 열고 2026/2학기 + 첫 대학원 캠퍼스로
// 실제 조회해 행 수 > 0 인지로 판정한다. (수집기 refactor_src/scrap_kyunghee.py와 동일 플로우)
export default async function probe(page) {
  await page.goto('https://sugang.khu.ac.kr/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);

  const core = page.frames().find((f) => f.name() === 'coreMain');
  if (!core) {
    return { status: 'error', error: 'coreMain 프레임 없음 — 페이지 구조 변경 여부 확인 필요' };
  }

  await core.locator('li', { hasText: '종합시간표 조회' }).first().click({ timeout: 15000 });
  await page.waitForTimeout(3000);

  const year = await core.$eval('#p_year', (el) => el.value).catch(() => null);
  if (year && year !== '2026') {
    return { status: 'error', error: `연도 기본값이 ${year} — 프로브는 2026을 가정, 구조 확인 필요` };
  }

  await core.selectOption('#p_term', '20'); // 2학기
  await page.waitForTimeout(2500);

  const options = await core.$$eval('#p_daehak option', (os) =>
    os.map((o) => ({ value: o.value, text: o.textContent.trim() })),
  );
  const grad = options.find((o) => o.text.includes('대학원'));
  if (!grad) {
    return { status: 'not_detected', detail: '2학기 캠퍼스 목록에 대학원 없음' };
  }

  await core.selectOption('#p_daehak', grad.value);
  await page.waitForTimeout(2000);
  await core.click('.btn-search');
  await page.waitForTimeout(4000);

  const rows = await core.$$eval('#gridLecture tr[role="row"][id]', (rs) => rs.length);
  if (rows > 0) {
    return { status: 'detected', detail: `2026-2 ${grad.text} 조회 ${rows}행` };
  }
  return { status: 'not_detected', detail: `2026-2 ${grad.text} 조회 0행 (등재 대기)` };
}
