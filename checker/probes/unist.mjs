// UNIST: SAP 편람 서버(zcmw5223)가 학기 사이에는 방화벽으로 닫혀 있음.
// 앱서버 3대를 순차 시도 — 하나라도 열리면 그 자체가 임박 신호이고, 열린 페이지에서 키워드 확인.
const URLS = [
  'https://uspap5.unist.ac.kr:8443/sap/bc/webdynpro/sap/zcmw5223?sap-language=ko',
  'https://uspap3.unist.ac.kr:8443/sap/bc/webdynpro/sap/zcmw5223?sap-language=ko',
  'https://uspdbsvc.unist.ac.kr:44401/sap/bc/webdynpro/sap/zcmw5223?sap-language=ko',
];

export default async function probe(page) {
  for (const url of URLS) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch {
      continue; // 이 호스트는 닫힘 — 다음 후보
    }
    await page.waitForTimeout(12000);
    let text = '';
    for (const frame of page.frames()) {
      try {
        text += await frame.evaluate(() => document.body?.innerText ?? '');
      } catch {}
    }
    const host = new URL(url).host;
    if (text.includes('2026') && (text.includes('2학기') || /fall/i.test(text))) {
      return { status: 'detected', detail: `${host} 에서 2026-2 확인` };
    }
    return { status: 'not_detected', detail: `${host} 접속됨(서버 재개!) — 2026-2 표기는 아직 없음` };
  }
  return {
    status: 'not_detected',
    detail: 'SAP 서버 3곳 모두 미개방(학기 간 셧다운) — 서버 재개 자체가 임박 신호, 8월 초 예상',
  };
}
