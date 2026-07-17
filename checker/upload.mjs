// 수집된 xlsx → DB 서버 업로드 러너 (변경 감지 포함).
//
// fetch.json에서 수집 성공(ok)한 학교의 산출물을 읽어 "내용 해시"를 계산하고,
// 마지막 전송 기록(docs/data/upload.json)과 비교해 신규/변경된 학교만 서버로 보낸다.
// 해시는 파일 바이트가 아니라 시트 셀 값 기준 — exceljs가 저장 때마다 zip 메타데이터를
// 바꾸므로 파일 해시로는 재수집=재전송이 돼버린다.
//
// 사용법:
//   node checker/upload.mjs            # 변경 감지 → 전송 (UPLOAD_API_URL/KEY 필요)
//   node checker/upload.mjs --dry      # 전송 없이 변경된 학교만 출력
//   node checker/upload.mjs --dry snu  # 지정 학교만
//
// 서버 API 스펙(엔드포인트/인증/multipart 필드)은 sendOne()에 채운다 — 스펙 확정 전까지
// 전송 시도는 명확한 에러로 중단된다.
import { createHash } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRAPERS_PATH = path.join(ROOT, 'docs', 'data', 'scrapers.json');
const FETCH_PATH = path.join(ROOT, 'docs', 'data', 'fetch.json');
const UPLOAD_PATH = path.join(ROOT, 'docs', 'data', 'upload.json');
const SCHOOLCOURSE_DIR = path.join(ROOT, 'SchoolCourse');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry');
const pickedIds = argv.filter((a) => !a.startsWith('--'));

const ExcelJS = createRequire(path.join(SCHOOLCOURSE_DIR, 'package.json'))('exceljs');

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// 시트 셀 값 기준 내용 해시 + 행수 (zip 메타데이터 변화에 불변)
async function contentHash(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const ws = workbook.worksheets[0];
  const hash = createHash('sha256');
  let rows = 0;
  ws.eachRow({ includeEmpty: false }, (row) => {
    rows += 1;
    hash.update(JSON.stringify(row.values ?? []));
    hash.update('\n');
  });
  return { hash: hash.digest('hex'), rows };
}

// ===== 서버 API 전송 — 스펙 확정 시 여기만 채우면 됨 =====
async function sendOne(id, filePath, meta) {
  const url = process.env.UPLOAD_API_URL;
  const key = process.env.UPLOAD_API_KEY;
  if (!url) {
    throw new Error(
      'UPLOAD_API_URL 미설정 — 서버 API 스펙(엔드포인트/인증/필드) 확정 후 sendOne()을 완성하세요',
    );
  }
  const form = new FormData();
  // TODO(스펙 확정 필요): 파일 필드명·파라미터 이름을 실제 API에 맞출 것
  form.append('file', new Blob([await readFile(filePath)]), path.basename(filePath));
  form.append('school', id);
  form.append('year', '2026');
  form.append('semester', '2');
  const res = await fetch(url, {
    method: 'POST',
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json().catch(() => ({}));
}

const scrapers = await readJson(SCRAPERS_PATH, {});
const fetchLog = await readJson(FETCH_PATH, {});
const uploadLog = await readJson(UPLOAD_PATH, {});

const targets = Object.keys(scrapers).filter((id) => {
  if (pickedIds.length > 0) return pickedIds.includes(id);
  return fetchLog[id]?.ok === true;
});
if (targets.length === 0) {
  console.log('대상 없음 (fetch.json에 수집 성공 기록이 있는 학교가 없음)');
  process.exit(0);
}

let changed = 0;
let failed = 0;
for (const id of targets) {
  const outputs = scrapers[id]?.expectedOutputs ?? [];
  for (const rel of outputs) {
    if (!rel.endsWith('.xlsx')) continue; // 중간 산출물(.xls 원본 등)은 전송 대상 아님
    const file = path.join(SCHOOLCOURSE_DIR, rel);
    try {
      await stat(file);
    } catch {
      console.log(`✘ [${id}] 파일 없음: ${rel}`);
      failed += 1;
      continue;
    }
    const { hash, rows } = await contentHash(file);
    const prev = uploadLog[id];
    if (prev?.hash === hash) {
      console.log(`= [${id}] 변경 없음 (${rows.toLocaleString()}행, 마지막 전송 ${prev.sentAt ?? '기록만'})`);
      continue;
    }
    const diffNote = prev
      ? `변경 감지: ${prev.rows?.toLocaleString() ?? '?'}행 → ${rows.toLocaleString()}행`
      : `신규 (미전송, ${rows.toLocaleString()}행)`;
    changed += 1;
    if (dryRun) {
      console.log(`→ [${id}] ${diffNote} (dry — 전송 생략)`);
      continue;
    }
    try {
      await sendOne(id, file, { rows });
      uploadLog[id] = { hash, rows, file: rel, sentAt: new Date().toISOString() };
      await writeFile(UPLOAD_PATH, `${JSON.stringify(uploadLog, null, 2)}\n`);
      console.log(`✔ [${id}] 전송 완료 — ${diffNote}`);
    } catch (e) {
      failed += 1;
      console.log(`✘ [${id}] 전송 실패: ${e.message}`);
    }
  }
}
console.log(`\n완료: 변경 ${changed} / 실패 ${failed} / 검사 ${targets.length}곳${dryRun ? ' (dry-run)' : ''}`);
process.exit(failed > 0 ? 1 : 0);
