// 서울대: 수강스누 강좌검색은 로그인 불필요 공개. 페이지 기본 학기가 2026-2인지 확인하고
// 검색 실행 결과 건수(>0)로 판정한다. 수집(scrap_snu.js)도 같은 흐름(검색→엑셀저장).
const PAGE_URL = 'https://sugang.snu.ac.kr/sugang/cc/cc100.action';

export default async function probe(page) {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  const header = await page.evaluate(() => (document.body?.innerText ?? '').slice(0, 300));
  if (!header.includes('2026 - 2학기')) {
    return { status: 'not_detected', detail: `기본 학기가 아직 2026-2가 아님 (${header.slice(0, 40)}...)` };
  }
  await page.locator('a, button').filter({ hasText: /검색/ }).first().click({ timeout: 10000 });
  await page
    .waitForFunction(() => /[\d,]+건의 교과목/.test(document.body ? document.body.innerText : ''), {
      timeout: 60000,
    })
    .catch(() => {});
  const count = await page.evaluate(
    () => document.body?.innerText.match(/([\d,]+)건의 교과목/)?.[1] ?? null,
  );
  if (count && Number(count.replace(/,/g, '')) > 0) {
    return { status: 'detected', detail: `2026-2 강좌검색 ${count}건 조회됨` };
  }
  return { status: 'not_detected', detail: '기본 학기는 2026-2이나 검색 결과 0건/미표시' };
}
