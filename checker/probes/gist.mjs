// GIST: 편람 페이지는 조회 폼만 렌더링돼 키워드 감지가 구조적으로 불가 —
// zeus 공개 조회 API(ulsOpenListQ/select.do)를 2026/2학기(USR03.20)로 직접 호출해
// 행 수로 판정한다. zeus 서버가 비표준 HTTP 헤더를 보내 Node fetch(undici)가
// 거부하므로 브라우저 컨텍스트에서 same-origin fetch 한다.
// 신호가 0건이면 항상 데이터가 있어야 할 2026-1을 컨트롤로 조회해
// 쿼리 자체가 깨진 경우(응답 포맷 변경 등)를 미탐 대신 error로 드러낸다.
const PAGE_URL = 'https://zeus.gist.ac.kr/sys/lecture/lecture_open.do';

const SEM_CODE = { 1: 'USR03.10', 2: 'USR03.20' };

export default async function probe(page) {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  const query = (semCode) =>
    page.evaluate(async (shtm) => {
      const RS = '\x1e';
      const body =
        ['SSV:utf-8', 'WMONID=mVl1vuYVyL2', 'univ_clsf_cd=USR01.GRSC', 'yy=2026',
          `shtm_cd=${shtm}`, 'sust_mj_cd=', 'cptn_div_cd=', 'curs_rech_div_cd=',
          'cors_detl_div_cd=', 'sbjt_nm=', 'lang_div=kor', 'user_div=lec',
          'cncllt_yn=N', 'lt_lang=', 'pg_key=', 'page_open_time=', 'page_open_time_on=',
        ].join(RS) + RS;
      try {
        const res = await fetch('/uls/ulsOpenListQ/select.do', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body,
        });
        const text = await res.text();
        return { rows: (text.match(/\x1eN\x1f/g) ?? []).length };
      } catch (err) {
        return { rows: 0, error: String(err).slice(0, 150) };
      }
    }, semCode);

  const signal = await query(SEM_CODE[2]);
  if (signal.error) {
    return { status: 'error', error: `zeus API 호출 실패: ${signal.error}` };
  }
  if (signal.rows > 0) {
    return { status: 'detected', detail: `2026-2 대학원 개설강좌 ${signal.rows}건 조회됨` };
  }
  const control = await query(SEM_CODE[1]);
  if (control.rows === 0) {
    return { status: 'error', error: '컨트롤(2026-1)도 0건 — 쿼리/응답 포맷 변경 의심' };
  }
  return { status: 'not_detected', detail: `2026-2 조회 0건 (컨트롤 2026-1은 ${control.rows}건 정상)` };
}
