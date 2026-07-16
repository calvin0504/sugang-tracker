// 국민대: 수강신청 서버가 운영기간 외에는 방화벽으로 닫힘 (26-1은 4월 말 폐쇄, 26-2는 8월 초 재개 예상).
// 26-2 공통코드는 서버 재개 시점(7월 중순)부터 존재했지만 강의 데이터는 별도로 등록되므로,
// 일반대학원(30001) 강의 조회 API에 실제 26-2 강의가 잡혀야 "감지"로 판정한다.
// 참고: 학교 방화벽이 일부 IP(로컬 등)를 차단하므로 이 프로브는 Actions 러너에서만 의미가 있고,
// 수집도 fetch-courses 워크플로(actions_fetch/)로 러너에서 수행한다.
const BASE = 'https://sugang.kookmin.ac.kr';

export default async function probe() {
  let res;
  try {
    res = await fetch(`${BASE}/api/subject/public/lectures/conditions/validation/ko`, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json;charset=UTF-8',
        Referer: `${BASE}/front/enrollment/course-catalog`,
      },
      body: JSON.stringify({
        syy: '2026',
        smtCd: '20',
        locale: 'ko',
        searchType: '05',
        univCd: '30000',
        deprtCd: '30001',
        offset: 0,
        limit: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return {
      status: 'not_detected',
      detail: '수강신청 서버 미개방(타임아웃) — 8월 초 재개 예상',
    };
  }
  if (!res.ok) {
    return { status: 'not_detected', detail: `강의 조회 API HTTP ${res.status}` };
  }
  let data;
  try {
    data = await res.json();
  } catch {
    return { status: 'not_detected', detail: '강의 조회 응답 파싱 실패' };
  }
  const total = data?.lectureRoms?.totalCount ?? 0;
  if (total > 0) {
    return { status: 'detected', detail: `일반대학원 2026-2 강의 ${total}건 조회됨` };
  }
  return {
    status: 'not_detected',
    detail: '서버 개방·공통코드 있음, 26-2 강의 데이터는 미등록 (등록 시 fetch-courses 자동 수집)',
  };
}
