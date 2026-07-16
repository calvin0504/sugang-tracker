// 학교 페이지의 <select> 옵션(값/라벨)을 덤프한다 — 프로브 제작용.
// 사용법: node checker/tools/dump-selects.mjs <schoolId>
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const schools = JSON.parse(await readFile(new URL('../../docs/data/schools.json', import.meta.url), 'utf8'));
const school = schools.find((s) => s.id === process.argv[2]);
if (!school) { console.error('unknown id'); process.exit(1); }

const browser = await chromium.launch();
const page = await (await browser.newContext({ locale: 'ko-KR', ignoreHTTPSErrors: true })).newPage();
await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(school.check?.waitMs ?? 7000);

for (const frame of page.frames()) {
  const selects = await frame
    .evaluate(() =>
      [...document.querySelectorAll('select')].map((s) => ({
        id: s.id || s.name,
        options: [...s.options].slice(0, 15).map((o) => `${o.value}=${o.text.trim()}`),
      })),
    )
    .catch(() => []);
  for (const s of selects) console.log(`[${s.id}]`, s.options.join(' | '));
}
await browser.close();
