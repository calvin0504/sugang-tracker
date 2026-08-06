// UNIST: 2026-08 SAP 시스템이 S/4HANA(s4hana.unist.ac.kr/zcmw5223_hp)로 이전됨 —
// 구 uspap5/uspap3/uspdbsvc 서버 프로브 폐기. 신규 페이지는 로그인 없이 공개이며,
// 학년도/학기 콤보 기본값이 2026학년도/2 학기면 편람 게시로 판정한다.
const URL = 'https://s4hana.unist.ac.kr/sap/bc/webdynpro/sap/zcmw5223_hp?sap-language=ko';

export default async function probe(page) {
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {
    return {
      status: 'not_detected',
      detail: 's4hana 서버 접속 실패 — 셧다운 또는 URL 재변경 여부 확인 필요',
    };
  }
  // WebDynpro 초기 렌더링 — 느린 CI 러너에서 고정 12초로는 부족했던 사례가 있어
  // 콤보 등장을 최대 45초까지 대기하고, 실패 시 본문을 담아 차단/구조변경을 구분한다
  try {
    await page.waitForSelector('input[lsdata]', { timeout: 45000 });
  } catch {
    const text = (await page.evaluate(() => document.body?.innerText ?? '').catch(() => ''))
      .replace(/\s+/g, ' ')
      .trim();
    return {
      status: 'error',
      error: `콤보 렌더링 실패(45초) — 본문 ${text.length}자: "${text.slice(0, 100)}"`,
    };
  }
  await page.waitForTimeout(3000); // 콤보 값 채워질 시간

  // 화면 콤보 input 순서: 학년도, 학기, 학위과정, 학부/대학원, 학과(부), 전공
  const values = await page.$$eval('input[lsdata]', (els) =>
    els.filter((e) => e.offsetWidth || e.offsetHeight).map((e) => e.value),
  );
  const hasYear = values.some((v) => v.includes('2026'));
  const hasSem = values.some((v) => /2\s*학기/.test(v));
  if (hasYear && hasSem) {
    return { status: 'detected', detail: `s4hana 기본 학기 2026-2 확인 (${values[0]} / ${values[1]})` };
  }
  return {
    status: 'not_detected',
    detail: `기본 학기가 2026-2 아님: ${values.filter(Boolean).slice(0, 2).join(' / ')}`,
  };
}
