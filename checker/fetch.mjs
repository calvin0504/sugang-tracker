// 시간표 수집 러너.
// status.json에서 "편람 감지(detected)" 상태인 학교를 골라 SchoolCourse의 해당
// 스크레이퍼를 실행하고, 결과를 docs/data/fetch.json 에 기록한다.
// 스크레이퍼 매핑과 26-2 준비 상태는 checker/scrapers.json 이 정의한다.
//
// 사용법:
//   node checker/fetch.mjs               # 감지됐고 준비된(ready262) 학교 중 미수집분 실행
//   node checker/fetch.mjs yonsei sejong # 지정 학교만 (감지 여부 무관하게 강제 실행)
//   node checker/fetch.mjs --dry         # 실행하지 않고 대상만 출력
//   node checker/fetch.mjs --force       # 이미 수집 성공한 학교도 다시 실행
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRAPERS_PATH = path.join(ROOT, 'docs', 'data', 'scrapers.json');
const STATUS_PATH = path.join(ROOT, 'docs', 'data', 'status.json');
const FETCH_PATH = path.join(ROOT, 'docs', 'data', 'fetch.json');
const SCHOOLCOURSE_DIR = path.join(ROOT, 'SchoolCourse');

const DEFAULT_TIMEOUT_MIN = 30;

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry');
const force = argv.includes('--force');
const pickedIds = argv.filter((a) => !a.startsWith('--'));

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const scrapers = await readJson(SCRAPERS_PATH, null);
if (!scrapers) {
  console.error('docs/data/scrapers.json 이 없습니다.');
  process.exit(1);
}
const status = await readJson(STATUS_PATH, {});
const fetchLog = await readJson(FETCH_PATH, {});

function selectTargets() {
  if (pickedIds.length > 0) {
    const unknown = pickedIds.filter((id) => !scrapers[id]?.entry);
    if (unknown.length > 0) {
      console.error(`scrapers.json 에 없거나 실행 커맨드(entry)가 없는 id: ${unknown.join(', ')}`);
      process.exit(1);
    }
    return pickedIds;
  }
  return Object.keys(scrapers).filter((id) => {
    const s = scrapers[id];
    if (!s.entry || s.ready262 === false) return false;
    if (status[id]?.status !== 'detected') return false;
    if (!force && fetchLog[id]?.ok) return false;
    return true;
  });
}

// pollDone: 산출물이 모두 완성됐는지 확인하는 콜백. 일부 스크레이퍼는 저장 후
// 브라우저를 닫지 않고 매달려 있으므로, 산출물이 완성되면 프로세스를 끊고 성공 처리한다.
function runCommand(command, cwd, logPrefix, timeoutMin, pollDone) {
  return new Promise((resolve) => {
    const started = Date.now();
    const timeoutMs = (timeoutMin ?? DEFAULT_TIMEOUT_MIN) * 60 * 1000;
    // Windows/리눅스 공통으로 셸 경유 실행 (엔트리가 "node …" / "python …" 문자열이므로)
    const child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    let earlyExit = false;
    let polling = false;
    const keepTail = (chunk) => {
      tail = (tail + chunk.toString()).slice(-4000);
      process.stdout.write(`${logPrefix} ${chunk}`.slice(0, 500));
    };
    child.stdout.on('data', keepTail);
    child.stderr.on('data', keepTail);
    const timer = setTimeout(() => {
      console.error(`${logPrefix} 타임아웃(${timeoutMin ?? DEFAULT_TIMEOUT_MIN}분) — 프로세스 종료`);
      child.kill('SIGKILL');
    }, timeoutMs);
    const watcher = pollDone
      ? setInterval(async () => {
          if (polling) return;
          polling = true;
          try {
            if (await pollDone()) {
              earlyExit = true;
              console.log(`${logPrefix} 산출물 완성 확인 — 프로세스 정리`);
              child.kill('SIGKILL');
            }
          } finally {
            polling = false;
          }
        }, 30000)
      : null;
    child.on('close', (code) => {
      clearTimeout(timer);
      if (watcher) clearInterval(watcher);
      resolve({ exitCode: code, earlyExit, logTail: tail, durationMs: Date.now() - started });
    });
  });
}

async function verifyOutputs(spec, startedAt) {
  const results = [];
  for (const rel of spec.expectedOutputs ?? []) {
    const file = path.join(SCHOOLCOURSE_DIR, rel);
    try {
      const info = await stat(file);
      results.push({
        path: rel,
        bytes: info.size,
        // 실행 시작 이후에 갱신된 파일만 "이번 실행 산출물"로 인정
        fresh: info.mtimeMs >= startedAt - 5000 && info.size > 0,
      });
    } catch {
      results.push({ path: rel, bytes: 0, fresh: false });
    }
  }
  return results;
}

const targets = selectTargets();
if (targets.length === 0) {
  console.log('실행할 대상이 없습니다. (감지된 학교 중 준비(ready262)·미수집 조건을 만족하는 곳 없음)');
  process.exit(0);
}

console.log(`수집 대상 ${targets.length}곳: ${targets.join(', ')}${dryRun ? ' (dry-run)' : ''}`);
if (dryRun) {
  for (const id of targets) {
    const s = scrapers[id];
    console.log(`  ${id}: ${s.entry}  → ${s.expectedOutputs?.join(', ') ?? '(출력 검증 없음)'}`);
  }
  process.exit(0);
}

// 대부분의 스크레이퍼가 출력 폴더를 만들지 않으므로 미리 생성해 둔다.
await mkdir(path.join(SCHOOLCOURSE_DIR, 'data_26_2'), { recursive: true });

let failed = 0;
for (const id of targets) {
  const spec = scrapers[id];
  const startedAt = Date.now();
  const cwd = path.join(SCHOOLCOURSE_DIR, spec.cwd ?? '.');
  console.log(`\n▶ [${id}] ${spec.entry} (cwd: ${path.relative(ROOT, cwd) || '.'})`);

  // 산출물이 존재 + 이번 실행 이후 갱신 + 크기가 두 번 연속 동일하면 "완성"으로 본다.
  let lastSizes = null;
  const pollDone =
    (spec.expectedOutputs ?? []).length === 0
      ? null
      : async () => {
          const outs = await verifyOutputs(spec, startedAt);
          if (!outs.every((o) => o.fresh)) {
            lastSizes = null;
            return false;
          }
          const sizes = outs.map((o) => o.bytes).join(',');
          const stable = sizes === lastSizes;
          lastSizes = sizes;
          return stable;
        };

  const run = await runCommand(spec.entry, cwd, `  [${id}]`, spec.timeoutMin, pollDone);
  const outputs = await verifyOutputs(spec, startedAt);
  const outputsOk = (spec.expectedOutputs ?? []).length === 0 || outputs.every((o) => o.fresh);
  // 정상 종료(exit 0) 또는 산출물 완성으로 조기 종료한 경우 성공
  const ok = outputsOk && (run.exitCode === 0 || run.earlyExit);
  if (!ok) failed += 1;

  fetchLog[id] = {
    ok,
    fetchedAt: new Date().toISOString(),
    exitCode: run.exitCode,
    earlyExit: run.earlyExit ?? false,
    durationMs: run.durationMs,
    outputs,
    logTail: ok ? null : run.logTail.slice(-1500),
  };
  await writeFile(FETCH_PATH, `${JSON.stringify(fetchLog, null, 2)}\n`);
  console.log(
    ok
      ? `✔ [${id}] 완료 (${Math.round(run.durationMs / 1000)}초, ${outputs.map((o) => `${o.path} ${(o.bytes / 1024).toFixed(0)}KB`).join(', ') || '출력 검증 생략'})`
      : `✘ [${id}] 실패 — exit ${run.exitCode}, 산출물 ${outputsOk ? '정상' : '누락/미갱신'}`,
  );
}

console.log(`\n완료: 성공 ${targets.length - failed} / 실패 ${failed}`);
process.exit(failed > 0 ? 1 : 0);
