// 국민대 대학원 시간표 수집 — GitHub Actions 실행용 포트.
// 원본: SchoolCourse/scrap_source/scrap_kookmin.js (비공개 저장소라 러너에서 체크아웃 불가).
// 원본은 puppeteer로 페이지를 열지만 실제 수집은 공개 API 호출뿐이라 fetch만으로 동작한다.
// 학교 방화벽이 로컬 IP를 차단해 Actions 러너에서 실행하고, 산출물은 out/에 커밋해 로컬로 가져간다.
// 산출물 xlsx 컬럼 구성은 원본과 동일하게 유지한다.

// 학교 서버 인증서 문제 대비 (원본의 rejectUnauthorized:false와 동일한 효과)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import Excel from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 디버그용 오버라이드: KMU_YEAR/KMU_SEM (예: 26-1 대조 실행으로 payload 정상 여부 확인)
const currentYear = Number(process.env.KMU_YEAR || 2026);
const currentSemester = Number(process.env.KMU_SEM || 2); // 1 | 2

const BASE = 'https://sugang.kookmin.ac.kr';
const REFERER = `${BASE}/front/enrollment/course-catalog`;

const engToKorDay = {
  MONDAY: '월',
  TUESDAY: '화',
  WEDNESDAY: '수',
  THURSDAY: '목',
  FRIDAY: '금',
  SATURDAY: '토',
  SUNDAY: '일',
};

console.log('[START] KMU crawl (actions port)');

// ===================== 1) 공통코드 조회 =====================
console.log('[1/3] commoncodes/all 요청');
const codesRes = await fetch(`${BASE}/api/subject/public/commoncodes/all`, {
  headers: { accept: 'application/json, text/plain, */*', Referer: REFERER },
  signal: AbortSignal.timeout(30000),
});
if (!codesRes.ok) {
  console.error(`commoncodes/all HTTP ${codesRes.status}`);
  process.exit(1);
}
const jsonData = await codesRes.json();

const gradCampusList = (jsonData.collegeList || []).filter(
  (item) => String(item.upperDeptCd) === '30000',
);
const allMajorList = jsonData.departmentList || [];
console.log('[INFO] gradCampusList =', gradCampusList.length);
console.log('[INFO] allMajorList =', allMajorList.length);
if (gradCampusList.length === 0) {
  console.error('대학원 캠퍼스 목록이 비어 있습니다 — 응답 구조 확인 필요');
  process.exit(1);
}

// ===================== 2) 엑셀 준비 =====================
const workbook = new Excel.Workbook();
const worksheet = workbook.addWorksheet('KMU');
worksheet.columns = [
  { key: 'campusCode', header: 'campusCode' },
  { key: 'campusName', header: 'campusName' },
  { key: 'majorCode', header: 'majorCode' },
  { key: 'majorName', header: 'majorName' },
  { key: 'type', header: 'type' },
  { key: 'subjectCode', header: 'subjectCode' },
  { key: 'subjectName', header: 'subjectName' },
  { key: 'credit', header: 'credit' },
  { key: 'profName', header: 'profName' },
  { key: 'time', header: 'time' },
  { key: 'lang', header: 'lang' },
  { key: 'room', header: 'room' },
  { key: 'bunban', header: 'bunban' },
];

const smtCd = ['10', '20'][currentSemester - 1];
const redandantCourseCh = new Set();

const categoryMap = {
  30: '전공',
  '02': '전공선택',
  31: '스튜디오',
  '01': '전공필수',
  15: '공통필수',
  16: '공통선택',
  18: '선수과목',
  '08': '교직',
  '06': '일반선택',
  17: '교직선택',
};

// ===================== 3) 캠퍼스(단과대) 루프 =====================
console.log('[2/3] campus loop 시작');
let totalRows = 0;

for (const campus of gradCampusList) {
  if (!campus || !campus.deptCd) continue;
  if (String(campus.deptNm || '').includes('폐지')) continue;

  console.log(`[Campus] ${campus.deptNm} (${campus.deptCd})`);

  const postData = JSON.stringify({
    syy: String(currentYear),
    smtCd,
    stuno: null,
    locale: 'ko',
    searchType: '05',
    subjtCd: null,
    subjtNm: null,
    professorNm: null,
    professorNo: null,
    daywCd: null,
    lessnLestmCd: null,
    cmpsjCdt: null,
    cmpsjDivCd: null,
    cltrDomnCd: null,
    dghtDivCd: null,
    univCd: campus.univCd,
    deprtCd: campus.deptCd,
    bchdmCntcSubjtYn: null,
    srclnLctreLangDivCd: null,
    studentUnivDeptCd: null,
    scheduleSeq: null,
    grade: null,
    estblCrseDivCd: null,
    apntPriorSubjtYn: null,
    offset: 0,
    limit: 500,
    scheduleDivCd: null,
  });

  let response;
  try {
    response = await fetch(`${BASE}/api/subject/public/lectures/conditions/validation/ko`, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'ko,en;q=0.9,en-US;q=0.8',
        'content-type': 'application/json;charset=UTF-8',
        Referer: REFERER,
      },
      body: postData,
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    console.log('[WARN] fetch error:', err?.message || err);
    continue;
  }

  if (!response.ok) {
    console.log('[WARN] response not ok. status =', response.status);
    console.log('[WARN] body head =', (await response.text().catch(() => '')).slice(0, 800));
    continue;
  }

  let parsed;
  try {
    parsed = await response.json();
  } catch {
    console.log('[WARN] JSON.parse 실패');
    continue;
  }

  const results = parsed?.lectureRoms?.results || [];
  console.log('[INFO] results =', results.length);
  if (results.length === 0 && !globalThis.__dumped) {
    globalThis.__dumped = true;
    console.log('[DEBUG] body head =', JSON.stringify(parsed).slice(0, 600));
  }
  if (results.length === 500) {
    console.log('[WARN] 500건 상한 도달 — 이 단과대는 누락 가능성 있음');
  }

  for (const datum of results) {
    if (!datum) continue;
    if (redandantCourseCh.has(datum.id)) continue;
    redandantCourseCh.add(datum.id);

    const credit = datum?.credits?.credit ?? '';

    let lang = '한국어';
    if (datum.langCode === '01') lang = '영어';
    else if (datum.langCode === '03') lang = '중국어';

    const categoryType = categoryMap[datum.categoryCode] ?? (datum.categoryCode ?? '');

    // 시간/강의실 파싱 (원본 로직 그대로)
    let time = '';
    let room = '';
    const roomSet = new Set();
    const rawTime = datum?.schedule?.lectureTimes || [];
    let prevDay = '';
    let startHour, startMin, endHour, endMin;
    let dayChangeFlag = 1;

    for (let i = 0; i < rawTime.length; i++) {
      const rt = rawTime[i];
      if (!rt) continue;
      roomSet.add(rt.classRoomName);

      const dayKor = engToKorDay[rt.dayOfWeek] || rt.dayOfWeek || '';
      if (dayChangeFlag === 0 && dayKor !== prevDay) dayChangeFlag = 1;

      if (dayChangeFlag !== 0) {
        if (prevDay) {
          if (time.length > 0) time += ',';
          time += `${prevDay} ${startHour}:${startMin}-${endHour}:${endMin}`;
        }
        prevDay = dayKor;
        const sh = rt?.start?.hour ?? '';
        const sm = rt?.start?.minute ?? '';
        startHour = Number(sh) < 10 ? '0' + sh : String(sh);
        startMin = Number(sm) < 10 ? '0' + sm : String(sm);
        dayChangeFlag = 0;
      }

      const eh = rt?.end?.hour ?? '';
      const em = rt?.end?.minute ?? '';
      endHour = Number(eh) < 10 ? '0' + eh : String(eh);
      endMin = Number(em) < 10 ? '0' + em : String(em);

      if (i === rawTime.length - 1) {
        if (time.length > 0) time += ',';
        time += `${prevDay} ${startHour}:${startMin}-${endHour}:${endMin}`;
      }
    }

    for (const r of roomSet) {
      if (r == null || String(r) === 'null') continue;
      if (room.length > 0) room += ',';
      room += r;
    }

    const currentMajorCd = datum.assignedDepartmentCode;
    const currentMajorInfo = allMajorList.find((el) => el.deptCd == currentMajorCd);
    let currentMajorNm = '';
    if (currentMajorInfo) {
      if (currentMajorCd == currentMajorInfo.univCd) {
        currentMajorNm = '공통';
      } else {
        const splitMajorNm = (currentMajorInfo.deptNm || '').split(' ');
        currentMajorNm = splitMajorNm.length < 2 ? splitMajorNm[0] : splitMajorNm.slice(1).join(' ');
      }
    }

    const currentCampusCd = datum.standardDeptCode;
    const currentCampusInfo = gradCampusList.find((el) => el.deptCd == currentCampusCd);

    worksheet.addRow({
      campusCode: currentCampusCd,
      campusName: currentCampusInfo?.deptNm ?? '',
      majorCode: currentMajorCd ?? '',
      majorName: currentMajorNm,
      type: categoryType,
      subjectCode: datum.subjectId ?? '',
      subjectName: datum.subjectNm ?? '',
      credit,
      profName: datum.professorName ?? '',
      time,
      lang,
      room,
      bunban: datum.classSequence ?? '',
    });
    totalRows++;
  }
}

console.log('[3/3] 저장 시작. totalRows =', totalRows);
if (totalRows === 0) {
  console.error('수집 결과 0행 — 저장하지 않고 실패 처리');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `kookmin(${currentYear}-${currentSemester}).xlsx`);
await workbook.xlsx.writeFile(outPath);
console.log('✅ saved:', outPath);
