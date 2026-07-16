// 홍익대: 대학원 시간표 JSP는 조회 폼만 있어 키워드 감지 불가 —
// 폼과 동일한 POST(yy/hakgi/campus/col/major)를 서버에 보내 결과 테이블의
// <td> 수로 판정한다. 실측: 데이터 있는 학기(26-1/26-2)는 td 200개,
// 없는 학기(2027-2)는 td 32개(빈 폼 프레임) — 60개를 문턱으로 쓴다.
// col=1(대학원)·major=887은 26-1에도 존재한 안정 조합.
const URL = 'https://cn.hongik.ac.kr/grad/ex/timetable.jsp';
const TD_THRESHOLD = 60;

async function countTds(hakgi) {
  const body = new URLSearchParams({ yy: '2026', hakgi, campus: '1', col: '1', major: '887' });
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: URL },
    body: body.toString(),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // euc-kr 페이지지만 <td> 태그 수만 세므로 디코딩 품질은 무관
  const html = await res.text();
  return (html.match(/<td/g) ?? []).length;
}

export default async function probe() {
  const signal = await countTds('2');
  if (signal >= TD_THRESHOLD) {
    return { status: 'detected', detail: `2026-2 대학원 시간표 렌더링 확인 (td ${signal}개)` };
  }
  const control = await countTds('1');
  if (control < TD_THRESHOLD) {
    return { status: 'error', error: `컨트롤(2026-1)도 td ${control}개 — 폼/코드 변경 의심` };
  }
  return {
    status: 'not_detected',
    detail: `2026-2 시간표 없음 (td ${signal}개, 컨트롤 2026-1은 ${control}개 정상)`,
  };
}
