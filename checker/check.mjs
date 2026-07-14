// 수강편람 오픈 감지 체커.
// 각 학교의 편람 페이지를 Playwright로 열어 "2026-2 학기" 신호 키워드를 찾고,
// 결과를 docs/data/status.json 에 기록한다. 상태가 바뀐 학교는 Discord 웹훅으로 알린다.
//
// 사용법:
//   node checker/check.mjs                  # 전체 체크
//   CHECK_ONLY=korea,gist node checker/check.mjs   # 일부 학교만 (id 콤마 구분)
// 환경변수:
//   DISCORD_WEBHOOK_URL  (선택) 상태 변화 알림을 보낼 웹훅
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const SCHOOLS_PATH = new URL('../docs/data/schools.json', import.meta.url);
const STATUS_PATH = new URL('../docs/data/status.json', import.meta.url);

// 사이트에 이 중 하나라도 나타나면 "2학기 편람이 올라왔다"고 판단한다.
// 학교별 표기가 다르므로 오탐/미탐 시 schools.json 의 check.any 로 개별 조정할 것.
const DEFAULT_KEYWORDS = [
  '2026학년도 2학기',
  '2026학년도 제2학기',
  '2026-2학기',
  '2026-2 학기',
  '2026년 2학기',
  '2026-02학기',
  '2026/2학기',
];

const DEFAULT_WAIT_MS = 7000;
const NAV_TIMEOUT_MS = 45000;
const CONCURRENCY = 4;

const nowIso = () => new Date().toISOString();

async function collectPageText(page) {
  // SAP WebDynpro·WebSquare 등은 iframe 안에 내용이 있어 모든 프레임을 훑는다.
  let text = '';
  for (const frame of page.frames()) {
    try {
      text += await frame.evaluate(() => document.body?.innerText ?? '');
      text += '\n';
    } catch {
      // cross-origin 프레임 등은 건너뛴다
    }
  }
  return text;
}

async function checkSchool(context, school) {
  const { check = {}, catalogUrl } = school;
  const keywords = check.any?.length ? check.any : DEFAULT_KEYWORDS;
  const page = await context.newPage();
  try {
    await page.goto(catalogUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(check.waitMs ?? DEFAULT_WAIT_MS);

    const text = await collectPageText(page);
    const hit = keywords.find((k) => text.includes(k));
    if (hit) {
      return { status: 'detected', detail: `키워드 "${hit}" 발견` };
    }
    if (text.trim().length < 30) {
      // 본문이 사실상 비어 있으면 렌더링 실패로 간주 (미감지로 오판하지 않도록)
      return { status: 'error', error: '페이지 본문이 비어 있음 (렌더링 실패 가능성)' };
    }
    return { status: 'not_detected', detail: `본문 ${text.length.toLocaleString()}자 검사, 키워드 없음` };
  } catch (err) {
    return { status: 'error', error: String(err.message ?? err).slice(0, 200) };
  } finally {
    await page.close().catch(() => {});
  }
}

async function runPool(items, worker, size) {
  const results = [];
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (index < items.length) {
        const i = index++;
        results[i] = await worker(items[i]);
      }
    }),
  );
  return results;
}

async function notifyDiscord(changes) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook || changes.length === 0) return;
  const lines = changes.map(
    (c) => `**${c.name}**: ${c.from ?? '(첫 체크)'} → **${c.to}**${c.detail ? ` — ${c.detail}` : ''}\n${c.url}`,
  );
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `🔔 26-2 편람 상태 변화\n${lines.join('\n')}\n\n감지된 학교는 로컬에서 \`npm run fetch\` 로 시간표를 수집하세요.`,
    }),
  });
  if (!res.ok) console.error(`Discord 알림 실패: HTTP ${res.status}`);
}

const schools = JSON.parse(await readFile(SCHOOLS_PATH, 'utf8'));
let prevStatus = {};
try {
  prevStatus = JSON.parse(await readFile(STATUS_PATH, 'utf8'));
} catch {
  // 첫 실행이면 빈 상태에서 시작
}

const only = process.env.CHECK_ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
const targets = schools.filter(
  (s) => s.check?.type !== 'manual' && s.catalogUrl && (!only || only.includes(s.id)),
);

console.log(`체크 대상 ${targets.length}개 학교 (수동 확인 ${schools.length - targets.length}개 제외/미포함)`);

const browser = await chromium.launch();
const context = await browser.newContext({
  locale: 'ko-KR',
  ignoreHTTPSErrors: true,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});

const results = await runPool(
  targets,
  async (school) => {
    const result = await checkSchool(context, school);
    console.log(`[${result.status.padEnd(12)}] ${school.name} ${result.detail ?? result.error ?? ''}`);
    return { school, result };
  },
  CONCURRENCY,
);

await browser.close();

const nextStatus = { ...prevStatus };
const changes = [];
for (const { school, result } of results) {
  const prev = prevStatus[school.id];
  const entry = {
    status: result.status,
    lastChecked: nowIso(),
    detail: result.detail ?? null,
    error: result.error ?? null,
    firstDetectedAt: prev?.firstDetectedAt ?? null,
  };
  if (result.status === 'detected' && !entry.firstDetectedAt) {
    entry.firstDetectedAt = nowIso();
  }
  if (prev?.status !== result.status) {
    changes.push({
      name: school.name,
      from: prev?.status,
      to: result.status,
      detail: result.detail ?? result.error,
      url: school.catalogUrl,
    });
  }
  nextStatus[school.id] = entry;
}

await writeFile(STATUS_PATH, `${JSON.stringify(nextStatus, null, 2)}\n`);
console.log(`\n완료: ${results.length}개 체크, 상태 변화 ${changes.length}건`);

try {
  await notifyDiscord(changes.filter((c) => c.to === 'detected' || c.from === 'detected'));
} catch (err) {
  console.error('Discord 알림 중 오류:', err.message);
}
