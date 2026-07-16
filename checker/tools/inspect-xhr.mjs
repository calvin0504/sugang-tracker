// 특정 학교 페이지에서 조회 버튼 클릭 시 발생하는 XHR을 캡처한다.
// 사용법: node checker/tools/inspect-xhr.mjs <schoolId>
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const schools = JSON.parse(await readFile(new URL('../../docs/data/schools.json', import.meta.url), 'utf8'));
const school = schools.find((s) => s.id === process.argv[2]);
if (!school) { console.error('unknown id'); process.exit(1); }

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'ko-KR', ignoreHTTPSErrors: true });
const page = await context.newPage();

page.on('request', (req) => {
  if (['xhr', 'fetch'].includes(req.resourceType())) {
    console.log('→', req.method(), req.url().slice(0, 140));
    const data = req.postData();
    if (data) console.log('  payload:', data.slice(0, 600).replace(/[\x1e\x1f]/g, '|'));
  }
});
page.on('response', async (res) => {
  if (['xhr', 'fetch'].includes(res.request().resourceType())) {
    try {
      const body = await res.text();
      console.log('←', res.status(), res.url().slice(0, 100), `${body.length}b:`, body.slice(0, 250).replace(/[\x1e\x1f\s]+/g, ' '));
    } catch {}
  }
});

await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(school.check?.waitMs ?? 7000);

console.log('\n--- 조회 버튼 클릭 시도 ---');
for (const sel of ['text=조회', 'text=검색', 'input[value=조회]', '[title=조회]']) {
  const btn = page.locator(sel).first();
  if (await btn.count().catch(() => 0)) {
    console.log(`[클릭: ${sel}]`);
    await btn.click({ timeout: 5000 }).catch((e) => console.log('클릭 실패:', e.message.slice(0, 80)));
    break;
  }
}
await page.waitForTimeout(10000);
const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
console.log('\n본문:', text.slice(0, 500));
await browser.close();
