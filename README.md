# 26-2 수강신청 트래커

2026학년도 2학기 수강편람이 각 학교 사이트에 올라왔는지 주기적으로 감지하고,
감지되면 SchoolCourse 스크레이퍼로 시간표를 수집하는 파이프라인 + 대시보드.

```
GitHub Actions (cron, 매시)
  └─ Playwright로 각 학교 편람 페이지 체크  ← checker/check.mjs
      └─ docs/data/status.json 에 결과 커밋 (+Discord 알림)
          └─ 대시보드(docs/)가 GitHub Pages로 서빙되며 이 데이터를 표시

로컬 PC (감지 알림을 받으면)
  └─ npm run fetch  ← checker/fetch.mjs
      └─ "편람 감지" 상태인 학교의 SchoolCourse 스크레이퍼를 실행
          └─ SchoolCourse/data_26_2/*.xlsx 생성 + docs/data/fetch.json 기록
```

수집(스크레이퍼 실행)을 CI가 아니라 로컬에서 돌리는 이유: 한국 대학 사이트
상당수가 해외 IP를 차단하고, 일부 스크레이퍼는 GUI 창(봇 챌린지·headless:false)이
필요하며, SchoolCourse가 별도 git 저장소이기 때문.

## 구조

| 경로 | 역할 |
|---|---|
| `docs/data/schools.json` | **마스터 데이터** — 학교 목록, 26-1 참고 기간, 편람 링크, 감지 설정 |
| `docs/data/status.json` | 체커가 갱신하는 감지 결과 (직접 수정하지 않음) |
| `docs/data/scrapers.json` | 학교 id → SchoolCourse 스크레이퍼 매핑 + 26-2 준비 상태 |
| `docs/data/fetch.json` | 수집 러너가 갱신하는 시간표 수집 결과 (직접 수정하지 않음) |
| `checker/check.mjs` | Playwright 기반 편람 오픈 감지 스크립트 |
| `checker/fetch.mjs` | 감지된 학교의 스크레이퍼를 실행하는 수집 러너 |
| `docs/` | 정적 대시보드 (GitHub Pages 루트) |
| `.github/workflows/check.yml` | 매시 자동 체크 + 결과 커밋 |
| `SchoolCourse/` | 시간표 스크레이퍼 저장소 (별도 git repo, bagstrap/SchoolCourse) |

## 로컬 실행

```bash
npm install
npx playwright install chromium   # 최초 1회
(cd SchoolCourse && npm install)  # 최초 1회 — 스크레이퍼 의존성(puppeteer 등)
pip install selenium pandas       # Python 스크레이퍼(경희대·GIST·부산대) 쓸 때만

npm run check                     # 전체 학교 편람 감지
CHECK_ONLY=korea,gist npm run check   # 일부만 (schools.json의 id, 콤마 구분)

npm run fetch                     # 감지된 학교의 시간표 수집 (미수집분만)
npm run fetch -- --dry            # 실행 없이 대상만 확인
npm run fetch -- yonsei sejong    # 지정 학교 강제 수집 (감지 여부 무관)
npm run fetch -- --force          # 이미 수집한 학교도 재수집

npm run dashboard                 # http://localhost:8173 에서 대시보드 확인
```

### 시간표 수집 흐름

1. 체커가 편람을 감지하면 대시보드에 **⏳ 수집 대기**로 표시되고 Discord 알림이 온다.
2. 로컬에서 `npm run fetch` 실행 → 감지됐고 `ready262: true`인 학교의 스크레이퍼가
   순차 실행되어 `SchoolCourse/data_26_2/학교(2026-2).xlsx`가 생긴다.
3. 결과는 `docs/data/fetch.json`에 기록되고 대시보드에 **📥 수집됨 / ⚠ 수집 실패**로 반영된다.
4. 학교별 준비 상태·블로커는 `docs/data/scrapers.json` 참고:
   - `mode: "auto"` — 그대로 실행 가능 (일부는 GUI 창이 뜸)
   - `mode: "semi"` — 실행 전 손이 감 (KAIST=세션 쿠키 갱신, 고려대=쿠키 만료 시 갱신, 항공대=본인 계정, 서강대=학기 선택 로직 복원)
   - `mode: "manual"` — 수동 다운로드 + 변환/병합 스크립트 (서울대·충남대·동국대·계명대·KDI, 과기대 대학원)
   - `mode: "none"` — 스크레이퍼 없음 (DGIST·시립대·충북대·광운대·명지대·동아대)

주의: 대부분의 스크레이퍼는 **사이트의 현재(기본) 학기**를 그대로 긁는다.
편람 감지 = 사이트가 2026-2를 서빙하기 시작했다는 뜻이므로 감지 후 실행이 안전하고,
수집 후에는 엑셀의 행 수·학기 컬럼을 한 번 확인하는 것을 권장.

## 배포 (GitHub)

1. GitHub에 repo 생성 후 push
2. **Settings → Pages** → Source: `Deploy from a branch`, Branch: `main` / `/docs`
3. (선택) 상태 변화 알림: **Settings → Secrets and variables → Actions** 에
   `DISCORD_WEBHOOK_URL` 시크릿 추가 → 편람 감지 시 Discord로 알림
4. Actions 탭에서 `check-sugang` 워크플로가 매시 5분에 도는지 확인
   (`workflow_dispatch`로 수동 실행도 가능)

## 감지 로직과 튜닝

기본 로직: 편람 페이지(iframe 포함 전체 프레임)의 본문 텍스트에
`2026학년도 2학기`, `2026-2학기`, `2026년 2학기` 등의 키워드가 하나라도 있으면
**감지(detected)** 로 판단한다.

학교마다 표기가 달라 오탐/미탐이 생기면 `docs/data/schools.json` 의 `check` 를 조정:

```jsonc
"check": {
  "type": "keyword",          // "manual" 이면 자동 체크 제외
  "any": ["2026학년도 2학기"], // 이 학교 전용 키워드 (생략 시 기본 목록)
  "waitMs": 12000             // SPA 렌더링 대기 (SAP/Nexacro/WebSquare는 길게)
}
```

- 상태 종류: `detected`(감지) / `not_detected`(미감지) / `error`(접속·렌더링 실패) /
  수동 확인(`check.type: "manual"` — 로그인 필요하거나 링크 없는 학교)
- 26-2 일정이 **확정되면** `schools.json` 의 `period262` 에 직접 기입 →
  대시보드에 D-day와 함께 표시된다.

## 주의

- ✅ 등 26-1 작업 상태는 이월하지 않았다. 26-2는 전 학교 미확인에서 시작.
- 동아대는 포털 로그인이 필요해 자동 체크에서 제외(수동 확인).
- 사이트 개편 시 키워드·대기시간을 다시 맞춰야 할 수 있다.
