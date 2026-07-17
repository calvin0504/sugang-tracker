// 광운대: KLAS 외부공개 대학원 강의계획서 조회 API로 판정 (세션 불필요).
// 대학원(selectGdhlitem) 미지정 시 서버가 아닌 UI단에서 검색이 차단되므로
// 일반대학원(code=1)을 지정해 2026-2 강의 목록 건수를 직접 확인한다.
const URL = 'https://klas.kw.ac.kr/ext/out/ststd/LectrePlanDaList.do';

export default async function probe() {
  let res;
  try {
    res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({
        selectSubj: '', selectGrcode: 'N000002', selectYearHakgi: '2026,2',
        selectYear: '2026', selecthakgi: '2', selectYearSub: '', selectHakgiSub: '',
        isSearch: '', list: [], GdhlList: [], randomNum: '', numText: '',
        selectYearList: [], selectRadioSub: 'all', selectTextsub: '',
        selectProfsrSub: '', selectGdhlitem: '1', selectGdhlList: [],
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return { status: 'error', error: 'LectrePlanDaList.do 접속 실패' };
  }
  if (!res.ok) return { status: 'not_detected', detail: `API HTTP ${res.status}` };
  const rows = await res.json().catch(() => null);
  const count = Array.isArray(rows)
    ? rows.filter((r) => String(r.year) === '2026' && String(r.hakgi) === '2').length
    : 0;
  if (count > 0) {
    return { status: 'detected', detail: `2026-2 일반대학원 강의 ${count.toLocaleString()}건 조회됨` };
  }
  return { status: 'not_detected', detail: '2026-2 강의 0건 (등재 대기)' };
}
