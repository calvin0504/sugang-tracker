// 대시보드: docs/data/schools.json(마스터) + docs/data/status.json(체커 결과)
// + docs/data/scrapers.json(수집기 매핑) + docs/data/fetch.json(수집 결과)을 읽어 렌더링.
const state = { schools: [], status: {}, scrapers: {}, fetchLog: {}, filter: 'all', query: '' };

const STATUS_META = {
  detected: { label: '편람 감지', order: 0 },
  not_detected: { label: '미감지', order: 1 },
  error: { label: '오류', order: 2 },
  manual: { label: '수동 확인', order: 3 },
  unchecked: { label: '미체크', order: 4 },
};

function statusOf(school) {
  if (school.check?.type === 'manual' || !school.catalogUrl) return 'manual';
  return state.status[school.id]?.status ?? 'unchecked';
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dday(periodText) {
  const m = periodText?.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (!m) return null;
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((start - today) / 86400000);
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-Day';
  return null;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// 시간표 수집 상태: fetched / fetch_failed / waiting(감지됐고 준비됨) / not_ready / none
function fetchStateOf(school) {
  const spec = state.scrapers[school.id];
  const log = state.fetchLog[school.id];
  if (log?.ok) return 'fetched';
  if (log && !log.ok) return 'fetch_failed';
  if (!spec?.entry) return 'none';
  if (spec.ready262 === false) return 'not_ready';
  if (statusOf(school) === 'detected') return 'waiting';
  return 'idle';
}

function counts() {
  const c = {
    all: state.schools.length,
    detected: 0, not_detected: 0, error: 0, manual: 0, unchecked: 0,
    confirmed: 0, fetched: 0, withScraper: 0,
  };
  for (const s of state.schools) {
    c[statusOf(s)]++;
    if (s.period262) c.confirmed++;
    if (state.scrapers[s.id]?.entry) c.withScraper++;
    if (fetchStateOf(s) === 'fetched') c.fetched++;
  }
  return c;
}

function renderTiles() {
  const c = counts();
  const tiles = [
    { key: 'detected', num: c.detected, label: '🟢 편람 감지' },
    { key: 'not_detected', num: c.not_detected, label: '⚪ 미감지' },
    { key: 'error', num: c.error, label: '🔴 오류' },
    { key: 'manual', num: c.manual, label: '🟡 수동 확인' },
    { key: 'all', num: `${c.confirmed}/${c.all}`, label: '📅 26-2 일정 확정' },
    { key: 'all', num: `${c.fetched}/${c.withScraper}`, label: '📥 시간표 수집' },
  ];
  document.getElementById('tiles').innerHTML = tiles
    .map(
      (t) => `<button class="tile ${state.filter === t.key ? 'active' : ''}" data-filter="${t.key}">
        <div class="num">${t.num}</div><div class="label">${t.label}</div>
      </button>`,
    )
    .join('');
}

function renderChips() {
  const c = counts();
  const chips = [
    { key: 'all', label: `전체 ${c.all}` },
    { key: 'detected', label: `감지 ${c.detected}` },
    { key: 'not_detected', label: `미감지 ${c.not_detected}` },
    { key: 'error', label: `오류 ${c.error}` },
    { key: 'manual', label: `수동 ${c.manual}` },
    { key: 'unchecked', label: `미체크 ${c.unchecked}` },
  ];
  document.getElementById('chips').innerHTML = chips
    .map(
      (ch) => `<button class="chip ${state.filter === ch.key ? 'active' : ''}" data-filter="${ch.key}">${ch.label}</button>`,
    )
    .join('');
}

function renderRows() {
  const q = state.query.toLowerCase();
  const visible = state.schools.filter((s) => {
    if (state.filter !== 'all' && statusOf(s) !== state.filter) return false;
    if (q && !`${s.name} ${s.code}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const rows = visible.map((s, i) => {
    const st = statusOf(s);
    const info = state.status[s.id];
    const meta = STATUS_META[st];
    const why = st === 'error' ? info?.error : st === 'detected' ? info?.detail : '';
    const d = dday(s.period262);
    const fetchCell = renderFetchCell(s);
    return `<tr>
      <td class="idx">${i + 1}</td>
      <td>
        <span class="school-name">${esc(s.name)}<span class="school-code">${esc(s.code)}</span></span>
        ${s.notes ? `<div class="school-note" title="${esc(s.notes)}">${esc(s.notes)}</div>` : ''}
      </td>
      <td class="period">${esc(s.ref261) || '<span class="tbd">-</span>'}</td>
      <td class="period262">${
        s.period262
          ? `${esc(s.period262)}${d ? `<span class="dday">${d}</span>` : ''}`
          : '<span class="tbd">미확정</span>'
      }</td>
      <td>
        <span class="badge ${st}" title="${esc(why ?? '')}">
          <span class="dot" aria-hidden="true"></span>${meta.label}
          ${why ? `<span class="why">${esc(why)}</span>` : ''}
        </span>
      </td>
      <td>${fetchCell}</td>
      <td class="checked-at">${fmtTime(info?.lastChecked) || '-'}</td>
      <td>${s.catalogUrl ? `<a class="link-btn" href="${esc(s.catalogUrl)}" target="_blank" rel="noopener">편람 ↗</a>` : '-'}</td>
    </tr>`;
  });

  document.getElementById('rows').innerHTML =
    rows.join('') || '<tr class="empty-row"><td colspan="8">조건에 맞는 학교가 없습니다</td></tr>';
}

function renderFetchCell(school) {
  const st = fetchStateOf(school);
  const spec = state.scrapers[school.id];
  const log = state.fetchLog[school.id];
  switch (st) {
    case 'fetched': {
      const files = (log.outputs ?? []).map((o) => `${o.path} (${(o.bytes / 1024).toFixed(0)}KB)`).join(', ');
      return `<span class="fetch fetched" title="${esc(files)}">📥 수집됨 <span class="fetch-time">${fmtTime(log.fetchedAt)}</span></span>`;
    }
    case 'fetch_failed':
      return `<span class="fetch failed" title="exit ${esc(log.exitCode)} — 로그는 fetch.json 참고">⚠ 수집 실패</span>`;
    case 'waiting':
      return `<span class="fetch waiting" title="npm run fetch 로 수집 실행">⏳ 수집 대기</span>`;
    case 'not_ready':
      return `<span class="fetch not-ready" title="${esc(spec?.blockers262 ?? '')}">🔧 수집기 준비 필요</span>`;
    case 'none':
      return '<span class="fetch none">-</span>';
    default:
      return `<span class="fetch idle" title="편람 감지되면 수집 대상이 됩니다">대기</span>`;
  }
}

function renderLastUpdated() {
  const times = Object.values(state.status)
    .map((s) => s.lastChecked)
    .filter(Boolean)
    .sort();
  const latest = times.at(-1);
  document.getElementById('last-updated').textContent = latest
    ? `마지막 체크 ${fmtTime(latest)} KST`
    : '아직 체크 이력 없음';
}

function render() {
  renderTiles();
  renderChips();
  renderRows();
  renderLastUpdated();
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  state.filter = btn.dataset.filter;
  render();
});

document.getElementById('search').addEventListener('input', (e) => {
  state.query = e.target.value.trim();
  renderRows();
});

async function load() {
  const bust = `?t=${Date.now()}`;
  const [schools, status, scrapers, fetchLog] = await Promise.all([
    fetch(`data/schools.json${bust}`).then((r) => r.json()),
    fetch(`data/status.json${bust}`).then((r) => r.json()).catch(() => ({})),
    fetch(`data/scrapers.json${bust}`).then((r) => r.json()).catch(() => ({})),
    fetch(`data/fetch.json${bust}`).then((r) => r.json()).catch(() => ({})),
  ]);
  state.schools = schools;
  state.status = status;
  state.scrapers = scrapers;
  state.fetchLog = fetchLog;
  render();
}

load().catch((err) => {
  document.getElementById('rows').innerHTML =
    `<tr class="empty-row"><td colspan="8">데이터 로드 실패: ${esc(err.message)} — 로컬에서는 npm run dashboard 로 서버를 띄워 열어주세요</td></tr>`;
});
