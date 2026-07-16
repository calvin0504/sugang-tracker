// 한양대: 포털 수강편람 SPA라 키워드 감지 불가, API는 URL 내 tk 토큰+세션 필요 —
// 페이지 로드 시 자동 발사되는 findSgscCurYtJojik.do 응답(현재 편람 년도/학기)을
// 가로채 판정한다. suupTerm/sgscTerm 코드: 10=1학기, 15=여름, 20=2학기, 25=겨울.
// 편람 시스템의 "현재 학기"가 2026/20으로 전환되는 것이 곧 26-2 편람 공개 신호.
export default async function probe(page, school) {
  let captured = null;
  page.on('response', async (res) => {
    if (!res.url().includes('findSgscCurYtJojik.do')) return;
    const json = await res.json().catch(() => null);
    const row = json?.DS_SGSCYT?.[0]?.list?.[0];
    if (row) captured = row;
  });

  await page.goto(school.catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 25 && !captured; i += 1) await page.waitForTimeout(1000);

  if (!captured) {
    return { status: 'error', error: 'findSgscCurYtJojik.do 응답을 받지 못함 (tk 토큰 만료/URL 변경 의심)' };
  }
  const { sgscYear, sgscTerm, suupYear, suupTerm } = captured;
  if ((sgscYear === '2026' && sgscTerm === '20') || (suupYear === '2026' && suupTerm === '20')) {
    return {
      status: 'detected',
      detail: `편람 시스템 현재 학기가 2026-2로 전환됨 (sgsc ${sgscYear}/${sgscTerm}, suup ${suupYear}/${suupTerm})`,
    };
  }
  return {
    status: 'not_detected',
    detail: `편람 현재 학기: sgsc ${sgscYear}/${sgscTerm}, suup ${suupYear}/${suupTerm} (2026/20 대기)`,
  };
}
