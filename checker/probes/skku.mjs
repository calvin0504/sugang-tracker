// 성균관대: kingoinfo Nexacro 앱은 body innerText에 학기가 안 잡히므로,
// "학사-전공과목" 메뉴 클릭 시 자동 발생하는 selectBizType01.do XHR(평문 SSV) 응답에
// 학기 콤보 목록이 실려 온다 — 여기에 2026-2(코드 202620)가 등재됐는지 확인한다.
const URL = 'https://kingoinfo.skku.edu/gaia/nxui/outdex.html?language=KO&menuId=NHSSU030840M';

export default async function probe(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => document.body && document.body.innerText.includes('학사-전공과목'),
    { timeout: 45000 },
  );

  const respPromise = page.waitForResponse((r) => r.url().includes('selectBizType01.do'), {
    timeout: 30000,
  });
  await page.locator('text=학사-전공과목').first().click();
  const resp = await respPromise;
  const text = (await resp.body()).toString('utf8');

  if (text.includes('2026학년도 2학기') || text.includes('202620')) {
    return { status: 'detected', detail: '학기 콤보에 2026학년도 2학기 등재됨' };
  }
  return { status: 'not_detected', detail: '학기 콤보에 2026-2 미등재' };
}
