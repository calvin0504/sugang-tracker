// 한국외대: 강의시간표 JSP는 조회 폼만 렌더링돼 키워드 감지 불가 —
// 내부 API(/hufs, getDataLssnLista)에 대학원(B)/AI융합학과(BADH1) 조건으로
// 2026/2학기(sessn=3)를 직접 POST해 dataCount로 판정한다.
// sessn 코드: 1=1학기, 2=여름, 3=2학기, 4=겨울.
const API = 'https://wis.hufs.ac.kr/hufs';

async function countCourses(sessn) {
  const params = {
    mName: 'getDataLssnLista', cName: 'hufs.stu1.STU1_C009', org_sect: 'B',
    ledg_year: '2026', ledg_sessn: sessn, campus: 'H1', crs_strct_cd: 'BADH1',
    gubun: '1', subjt_nm: '', won: '', cyber: '', emp_nm: '',
    d1: 'N', d2: 'N', d3: 'N', d4: 'N', d5: 'N', d6: 'N',
    t1: 'N', t2: 'N', t3: 'N', t4: 'N', t5: 'N', t6: 'N',
    t7: 'N', t8: 'N', t9: 'N', t10: 'N', t11: 'N', t12: 'N',
  };
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://wis.hufs.ac.kr/src08/jsp/lecture/LECTURE2020L.jsp',
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = JSON.parse(decodeURIComponent(await res.text()));
  return Number(json?.dataCount ?? 0);
}

export default async function probe() {
  const signal = await countCourses('3');
  if (signal > 0) {
    return { status: 'detected', detail: `2026-2 대학원(AI융합학과 표본) ${signal}과목 조회됨` };
  }
  const control = await countCourses('1');
  if (control === 0) {
    return { status: 'error', error: '컨트롤(2026-1)도 0건 — API/학과코드 변경 의심' };
  }
  return { status: 'not_detected', detail: `2026-2 조회 0건 (컨트롤 2026-1은 ${control}건 정상)` };
}
