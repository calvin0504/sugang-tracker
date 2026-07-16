// 동국대: nextsupport 학사정보 시스템은 세션 토큰(_runningNana) 핸드셰이크가 필요해
// 직접 HTTP 재현이 어려움 — UI를 구동해 조회 버튼을 누르고 doList.do 응답을 가로챈다.
// 페이지 기본 조회조건이 기반 학기(BASE_YY/BASE_SEM_CD)라서, 요청 페이로드가
// 실제로 2026/2학기(CM160.20)였는지 확인한 경우에만 판정에 사용한다.
export default async function probe(page, school) {
  let captured = null;
  page.on('response', async (res) => {
    if (!res.url().includes('EdcLesn010/doList.do')) return;
    const post = res.request().postData() ?? '';
    const yy = /OPEN_YY(?:%3D|=)?[^&]*?(\d{4})/.exec(decodeURIComponent(post))?.[1];
    const sem = /OPEN_SEM_CD[^&]*?(CM160\.\d+)/.exec(decodeURIComponent(post))?.[1];
    const body = await res.text().catch(() => '');
    let rows = 0;
    try {
      rows = JSON.parse(body)?.dsMain?.length ?? 0;
    } catch {}
    captured = { yy, sem, rows };
  });

  await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await page.locator('text=조회').first().click({ timeout: 10000 });
  // doList 응답(수 MB)까지 대기
  for (let i = 0; i < 30 && !captured; i += 1) await page.waitForTimeout(1000);

  if (!captured) {
    return { status: 'error', error: '조회 클릭 후 doList.do 응답을 받지 못함 (UI 변경 의심)' };
  }
  if (captured.yy !== '2026' || captured.sem !== 'CM160.20') {
    return {
      status: 'not_detected',
      detail: `기반 학기가 아직 ${captured.yy}/${captured.sem} (2026/CM160.20=2학기 대기)`,
    };
  }
  if (captured.rows > 0) {
    return { status: 'detected', detail: `2026-2 대학원 개설강좌 ${captured.rows.toLocaleString()}건 조회됨` };
  }
  return { status: 'not_detected', detail: '기반 학기는 2026-2이나 개설강좌 0건' };
}
