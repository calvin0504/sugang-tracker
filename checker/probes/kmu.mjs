// 계명대: Nexacro(EDWARD) 페이지라 키워드 감지 불가, 조회 API는 세션 토큰(IBMID)
// 필요라 직접 HTTP 재현도 불가 — UI의 조회 버튼([id*=btn_search])을 눌러
// findOpenLtCtntInqList 응답을 가로챈다. 폼 기본값이 시스템 기반 학기이므로
// 요청 DS_COND의 yy/tmGbn이 2026/2였는지 확인한 경우에만 판정에 사용한다.
export default async function probe(page, school) {
  let captured = null;
  page.on('response', async (res) => {
    if (!res.url().includes('findOpenLtCtntInqList')) return;
    const post = res.request().postData() ?? '';
    // SSV 데이터셋 행: N 다음에 yy, tmGbn 순 (구분자는 RS/US 혼용이라 둘 다 허용)
    const cond = /N[\x1e\x1f](\d{4})[\x1e\x1f](\d)[\x1e\x1f]/.exec(post);
    const body = await res.text().catch(() => '');
    captured = {
      yy: cond?.[1] ?? null,
      tmGbn: cond?.[2] ?? null,
      rows: (body.match(/\x1eN\x1f/g) ?? []).length,
    };
  });

  await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);
  await page.locator('[id*="btn_search"]').first().click({ timeout: 10000 });
  for (let i = 0; i < 30 && !captured; i += 1) await page.waitForTimeout(1000);

  if (!captured) {
    return { status: 'error', error: '조회 클릭 후 목록 응답을 받지 못함 (UI 변경 의심)' };
  }
  if (captured.yy !== '2026' || captured.tmGbn !== '2') {
    return {
      status: 'not_detected',
      detail: `기본 학기가 아직 ${captured.yy}/${captured.tmGbn}학기 (2026/2 대기)`,
    };
  }
  if (captured.rows > 0) {
    return { status: 'detected', detail: `2026-2 개설강좌 ${captured.rows.toLocaleString()}건 조회됨` };
  }
  return { status: 'not_detected', detail: '기본 학기는 2026-2이나 개설강좌 0건' };
}
