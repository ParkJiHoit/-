import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../AuthContext';
import BulkImportModal from '../components/BulkImportModal';
import NotificationSettingsModal from '../components/rankTracker/NotificationSettingsModal';
import ShareReportModal from '../components/rankTracker/ShareReportModal';
import TrackerStatCards from '../components/rankTracker/TrackerStatCards';
import TrackerToolbar from '../components/rankTracker/TrackerToolbar';
import TrackerTable from '../components/rankTracker/TrackerTable';
import TrackerDetailDrawer from '../components/rankTracker/TrackerDetailDrawer';
import { X, AlertTriangle } from 'lucide-react';
import { isEffectivelyStabilized } from '../utils/stabilization';

function getKSTToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 항목 하나(키워드)에 조회실패 상태인 링크가 하나라도 있는지 — "조회실패만 보기"
// 필터와 갱신 완료 토스트 둘 다 이 기준으로 판단한다.
function hasFetchFailedLink(item) {
  if (item.mode === 'blog') {
    return (item.blog_ids || []).some(id => item.latestRanks?.[id]?.status === 'fetch_failed');
  }
  return Object.values(item.latestRanks || {}).some(r => r.status === 'fetch_failed');
}

// 갱신이 끝났는데 조회실패가 남아있으면 뜨는 클릭 가능한 토스트 — 클릭하면
// 바로 "조회실패만 보기" 필터를 켜서 어떤 항목이 실패했는지 보여준다.
function FailedToast({ count, onView, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className="mac-toast"
      onClick={onView}
      style={{
        pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        border: '1px solid rgba(255,69,58,0.35)',
      }}
    >
      <AlertTriangle size={14} style={{ color: '#FF453A', flexShrink: 0 }} />
      조회실패 {count}건 발생 · 클릭해서 보기
    </div>
  );
}

// exceljs는 8자리 ARGB(FF + 6자리 RGB) 헥스를 쓴다. 모든 데이터 셀에 옅은 회색 테두리를
// 명시적으로 넣어 인쇄/타 프로그램에서도 격자가 유지되게 하고, 헤더 아래엔 더 굵은 구분선을 둔다.
const THIN_BORDER = { style: 'thin', color: { argb: 'FFD9D9D9' } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
const HEADER_BORDER = { ...CELL_BORDER, bottom: { style: 'medium', color: { argb: 'FF1C2333' } } };
const EXPORT_FONT = '맑은 고딕';

const NOT_RANKED_COLOR = { bg: 'FFEEEEEE', font: 'FF9E9E9E' };
const FETCH_FAILED_COLOR = { bg: 'FFBCAAA4', font: 'FF3E2723' };
// 아직 등록되지 않았던 날짜(추적 시작 이전)는 진짜 미노출(X)과 헷갈리지 않도록
// 흰 배경 + 빈 값으로 비워 두어, 회색 X 셀과 시각적으로 확실히 구분되게 한다.
const NOT_YET_REGISTERED_COLOR = { bg: 'FFFFFFFF', font: 'FFD0D0D0' };

// RankCalendar 화면 배색과 맞춘 히트맵 셀 색상 — rank==null이면 미노출, status가 fetch_failed면 조회 실패로 별도 표시.
// 채도를 낮춘 초록→황→빨강 그라데이션으로 다듬었다.
const RANK_COLOR_TIERS = [
  { max: 1, bg: 'FF2E7D32', font: 'FFFFFFFF' },
  { max: 2, bg: 'FF43A047', font: 'FFFFFFFF' },
  { max: 3, bg: 'FF7CB342', font: 'FF1A3C1A' },
  { max: 5, bg: 'FFF4B942', font: 'FF5C4400' },
  { max: 7, bg: 'FFEF8354', font: 'FF5C2A00' },
  { max: Infinity, bg: 'FFD9534F', font: 'FFFFFFFF' },
];

// 등록(첫 스냅샷) 이전 날짜는 진짜 미노출과 구분해야 하므로 별도 종류로 먼저 판별한다.
function cellKind(snap, date, firstSeenDate) {
  if (firstSeenDate && date < firstSeenDate) return 'not-yet-registered';
  if (!snap) return 'not-exposed';
  if (snap.status === 'fetch_failed') return 'fetch-failed';
  if (snap.rank == null) return 'not-exposed';
  return 'ranked';
}

function heatmapCellColor(snap, date, firstSeenDate) {
  const kind = cellKind(snap, date, firstSeenDate);
  if (kind === 'not-yet-registered') return NOT_YET_REGISTERED_COLOR;
  if (kind === 'fetch-failed') return FETCH_FAILED_COLOR;
  if (kind === 'not-exposed') return NOT_RANKED_COLOR;
  return RANK_COLOR_TIERS.find(t => snap.rank <= t.max);
}

const HEATMAP_LEGEND = [
  { label: '1위', bg: 'FF2E7D32', font: 'FFFFFFFF' },
  { label: '2위', bg: 'FF43A047', font: 'FFFFFFFF' },
  { label: '3위', bg: 'FF7CB342', font: 'FF1A3C1A' },
  { label: '5위', bg: 'FFF4B942', font: 'FF5C4400' },
  { label: '7위', bg: 'FFEF8354', font: 'FF5C2A00' },
  { label: '10위', bg: 'FFD9534F', font: 'FFFFFFFF' },
  { label: '미노출', bg: 'FFEEEEEE', font: 'FF9E9E9E' },
  { label: '조회 실패', bg: 'FFBCAAA4', font: 'FF3E2723' },
  { label: '등록 전(값 없음)', bg: 'FFFFFFFF', font: 'FFD0D0D0' },
];

// 통합검색 노출 O/X 셀 색 — 순위 팔레트(초록~빨강)와 겹치면 구분이 안 가서
// 아예 다른 색 계열(파란색)을 쓴다.
function integratedCellColor(value) {
  if (value === 'O') return { bg: 'FF1A73E8', font: 'FFFFFFFF' };
  if (value === 'X') return { bg: 'FFB3C6E8', font: 'FF1A3C6E' };
  return NOT_RANKED_COLOR;
}

const INTEGRATED_LEGEND = [
  { label: 'O (통검 노출)', bg: 'FF1A73E8', font: 'FFFFFFFF' },
  { label: 'X (통검 미노출)', bg: 'FFB3C6E8', font: 'FF1A3C6E' },
];

// 한글 등 전각 문자는 2칸, 그 외는 1칸으로 계산해 열 너비를 값 길이에 맞춰 자동 산출한다.
function displayWidth(str) {
  const s = String(str ?? '');
  let width = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    const isWide = (code >= 0x1100 && code <= 0x115F) || (code >= 0x2E80 && code <= 0xA4CF) ||
      (code >= 0xAC00 && code <= 0xD7A3) || (code >= 0xF900 && code <= 0xFAFF) ||
      (code >= 0xFF00 && code <= 0xFF60) || (code >= 0xFFE0 && code <= 0xFFE6);
    width += isWide ? 2 : 1;
  }
  return width;
}

function autoColWidth(values, minWidth) {
  const max = values.reduce((m, v) => Math.max(m, displayWidth(v)), 0);
  return Math.max(max + 2, minWidth);
}

// 같은 해 안에서만 "YYYY-" 접두어를 생략한다 — 연도가 걸치면 MM-DD만으로는
// 서로 다른 해의 같은 날짜가 겹쳐 보일 수 있어 전체 날짜를 그대로 쓴다.
function formatDateLabels(dates) {
  const years = new Set(dates.map(d => d.slice(0, 4)));
  if (years.size <= 1) return dates.map(d => d.slice(5));
  return dates;
}

// 화면의 TrackerStatCards(추적 키워드/추적 링크/5위 내 노출/통검 노출 중)와 같은 지표를
// 시트별로 요약한다. 전체 순위(all) 모드는 화면과 마찬가지로 "링크" 개념이 없어 카드 구성이 다르다.
function computeGroupSummary(rows, dataRows) {
  const keywordCount = new Set(rows.map(r => r.keyword)).size;
  const isAllMode = dataRows.length > 0 && dataRows.every(dr => dr.mode === 'all');

  if (isAllMode) {
    const top5Keywords = new Set();
    for (const dr of dataRows) {
      if (dr.latestStatus === 'ranked' && dr.latestRank != null && dr.latestRank <= 5) top5Keywords.add(dr.keyword);
    }
    return { isAllMode: true, keywordCount, top5KeywordCount: top5Keywords.size };
  }

  const linkCount = dataRows.length;
  const top5LinkCount = dataRows.filter(dr => dr.latestStatus === 'ranked').length;
  const integratedCount = dataRows.filter(dr => dr.integratedLatest === true).length;
  return { isAllMode: false, keywordCount, linkCount, top5LinkCount, integratedCount };
}

function addGroupSummaryTable(worksheet, summary, totalCols) {
  const pct = (value, total) => (total ? Math.round((value / total) * 100) : null);
  const cards = summary.isAllMode
    ? [
        { label: '추적 키워드', value: `${summary.keywordCount}`, pct: null, color: 'FF8E8E93' },
        { label: '5위 내 노출', value: `${summary.top5KeywordCount}/${summary.keywordCount}`, pct: pct(summary.top5KeywordCount, summary.keywordCount), color: 'FF30D158' },
      ]
    : [
        { label: '추적 키워드', value: `${summary.keywordCount}`, pct: null, color: 'FF8E8E93' },
        { label: '추적 링크', value: `${summary.linkCount}`, pct: null, color: 'FF0A84FF' },
        { label: '5위 내 노출', value: `${summary.top5LinkCount}/${summary.linkCount}`, pct: pct(summary.top5LinkCount, summary.linkCount), color: 'FF30D158' },
        { label: '통검 노출 중', value: `${summary.integratedCount}/${summary.linkCount}`, pct: pct(summary.integratedCount, summary.linkCount), color: 'FF5E5CE6' },
      ];

  const cardSpan = Math.max(1, Math.floor(totalCols / cards.length));
  const labelRow = worksheet.addRow([]);
  const valueRow = worksheet.addRow([]);
  labelRow.height = 18;
  valueRow.height = 28;

  cards.forEach((card, i) => {
    const startCol = i * cardSpan + 1;
    const endCol = i === cards.length - 1 ? totalCols : startCol + cardSpan - 1;

    worksheet.mergeCells(labelRow.number, startCol, labelRow.number, endCol);
    const labelCell = labelRow.getCell(startCol);
    labelCell.value = card.label;
    labelCell.font = { name: EXPORT_FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.color } };
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells(valueRow.number, startCol, valueRow.number, endCol);
    const valueCell = valueRow.getCell(startCol);
    valueCell.value = card.pct != null ? `${card.value}  (${card.pct}%)` : card.value;
    valueCell.font = { name: EXPORT_FONT, size: 14, bold: true, color: { argb: card.color } };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valueCell.border = CELL_BORDER;
    labelCell.border = CELL_BORDER;
  });

  worksheet.addRow([]);
}

function buildHeatmapSheet(workbook, sheetName, groupName, rows) {
  const dates = [...new Set(rows.map(r => r.date))].sort();
  const dateLabels = formatDateLabels(dates);

  const rowMap = new Map();
  for (const r of rows) {
    const key = `${r.keyword} ${r.blogId}`;
    if (!rowMap.has(key)) {
      rowMap.set(key, { keyword: r.keyword, searchVolume: r.searchVolume, blogId: r.blogId, mode: r.mode, registeredAt: r.registeredAt, firstSeenDate: r.firstSeenDate, cells: {} });
    }
    rowMap.get(key).cells[r.date] = { rank: r.rank, status: r.status, integratedExposed: r.integratedExposed, postDate: r.postDate };
  }
  const dataRows = [...rowMap.values()];

  // 통합검색노출/등록일은 날짜별 이력이 아니라 가장 최근에 확인된 값 하나만 보여준다
  // (통합검색노출은 blog 모드만 해당 — all 모드는 특정 블로그에 매이지 않아 체크 대상이 아니다).
  // 포스팅 자체의 발행일을 한 번도 확인 못했으면(블로그탭 10위 안에 든 적 없음) 트래커에
  // 등록한 날짜로 대체하고 '*'를 붙여 실제 발행일과 구분한다.
  let hasFallbackDate = false;
  for (const dr of dataRows) {
    let integratedLatest = null;
    let postDate = null;
    let latestFound = false;
    for (let i = dates.length - 1; i >= 0; i--) {
      const c = dr.cells[dates[i]];
      if (!c) continue;
      // 그룹 요약 표(추적/노출 현황)는 웹 화면의 TrackerStatCards와 동일하게 "가장 최근 스냅샷"
      // 기준으로 집계해야 하므로, 날짜 역순으로 훑다가 처음 만나는 값을 최신 상태로 취급한다.
      if (!latestFound) { dr.latestRank = c.rank; dr.latestStatus = c.status; latestFound = true; }
      if (dr.mode === 'blog' && integratedLatest == null && c.integratedExposed != null) integratedLatest = c.integratedExposed;
      if (postDate == null && c.postDate) postDate = c.postDate;
    }
    dr.integratedLatest = integratedLatest;
    dr.postDateIsFallback = !postDate && !!dr.registeredAt;
    dr.postDate = postDate || dr.registeredAt || null;
    if (dr.postDateIsFallback) hasFallbackDate = true;
  }

  // 1순위 월간 검색량 내림차순(미조회 키워드는 맨 뒤), 2순위 등록일(발행일) 오래된순
  dataRows.sort((a, b) => {
    const av = a.searchVolume ?? -1;
    const bv = b.searchVolume ?? -1;
    if (av !== bv) return bv - av;
    const ad = a.postDate || '9999-99-99';
    const bd = b.postDate || '9999-99-99';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.keyword.localeCompare(b.keyword) || a.blogId.localeCompare(b.blogId);
  });

  const worksheet = workbook.addWorksheet(sheetName);
  const infoColCount = 5;
  const header = ['등록일', '키워드', '월간 검색량', '블로그', '통검 노출', ...dateLabels];
  const totalCols = header.length;

  // 시트가 이미 그룹 단위로 나뉘어 있어 "그룹" 열은 따로 두지 않고, 표 위에 제목 행으로 표시한다.
  const titleRow = worksheet.addRow([`그룹: ${groupName}`]);
  worksheet.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
  titleRow.height = 22;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: EXPORT_FONT, size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A3550' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const summary = computeGroupSummary(rows, dataRows);
  addGroupSummaryTable(worksheet, summary, totalCols);

  const headerRow = worksheet.addRow(header);
  headerRow.eachCell((cell) => {
    cell.font = { name: EXPORT_FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C2333' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = HEADER_BORDER;
  });

  dataRows.forEach((dr) => {
    const values = [
      dr.postDate ? (dr.postDateIsFallback ? `${dr.postDate}*` : dr.postDate) : '',
      dr.keyword,
      dr.searchVolume ?? '',
      dr.blogId,
      dr.integratedLatest == null ? '' : (dr.integratedLatest ? 'O' : 'X'),
      ...dates.map(d => {
        const c = dr.cells[d];
        const kind = cellKind(c, d, dr.firstSeenDate);
        if (kind === 'not-yet-registered') return '';
        if (kind === 'fetch-failed') return '실패';
        if (kind === 'not-exposed') return 'X';
        return c.rank;
      }),
    ];
    const row = worksheet.addRow(values);
    row.eachCell((cell, colNumber) => {
      cell.font = { name: EXPORT_FONT, size: 10, color: { argb: 'FF1A1A1A' } };
      cell.alignment = { horizontal: colNumber === 3 ? 'center' : 'left', vertical: 'middle' };
      cell.border = CELL_BORDER;
    });

    const integratedCell = row.getCell(5);
    const iColor = integratedCellColor(dr.integratedLatest == null ? '' : (dr.integratedLatest ? 'O' : 'X'));
    integratedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: iColor.bg } };
    integratedCell.font = { name: EXPORT_FONT, size: 10, bold: true, color: { argb: iColor.font } };
    integratedCell.alignment = { horizontal: 'center', vertical: 'middle' };

    dates.forEach((d, i) => {
      const cell = row.getCell(infoColCount + 1 + i);
      const color = heatmapCellColor(dr.cells[d], d, dr.firstSeenDate);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg } };
      cell.font = { name: EXPORT_FONT, size: 10, bold: true, color: { argb: color.font } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  worksheet.addRow([]);
  const legendHeaderRow = worksheet.addRow(['순위 컬러']);
  legendHeaderRow.getCell(1).font = { name: EXPORT_FONT, bold: true };
  HEATMAP_LEGEND.forEach((l) => {
    const row = worksheet.addRow(['', l.label]);
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: l.bg } };
    row.getCell(2).font = { name: EXPORT_FONT, color: { argb: l.font } };
  });
  worksheet.addRow([]);
  const integratedLegendHeaderRow = worksheet.addRow(['통검 노출 컬러']);
  integratedLegendHeaderRow.getCell(1).font = { name: EXPORT_FONT, bold: true };
  INTEGRATED_LEGEND.forEach((l) => {
    const row = worksheet.addRow(['', l.label]);
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: l.bg } };
    row.getCell(2).font = { name: EXPORT_FONT, color: { argb: l.font } };
  });
  if (hasFallbackDate) {
    worksheet.addRow([]);
    worksheet.addRow(['* 포스팅 발행일 미확인 — 트래커 등록일로 대체 표시']);
  }

  worksheet.columns = [
    { width: 12 },
    { width: autoColWidth([header[1], ...dataRows.map(dr => dr.keyword)], 16) },
    { width: 12 },
    { width: 18 },
    { width: 12 },
    ...dateLabels.map(d => ({ width: autoColWidth([d], 8) })),
  ];

  worksheet.views = [{ state: 'frozen', xSplit: infoColCount, ySplit: headerRow.number }];
  worksheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: totalCols },
  };

  return worksheet;
}

// 엑셀 A1 스타일 열 문자(A, B, ..., Z, AA, ...)를 1-based 열 번호로 변환한다.
function colLetterToNumber(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

// exceljs의 worksheet.autoFilter는 범위 전체에 일괄로 드롭다운 버튼을 붙일 뿐, 컬럼별로
// 버튼을 숨기는 API가 없다(내부적으로 <autoFilter ref="..."/> 한 줄만 씀). 하지만 OOXML
// 포맷 자체는 <filterColumn colId="n" hiddenButton="1"/>로 컬럼별 버튼 숨김을 지원하므로,
// exceljs가 만든 .xlsx(zip)를 열어 각 시트 XML의 autoFilter 태그에 이 속성을 주입한다.
// 정보열 순서는 항상 고정(0=등록일, 1=키워드, 2=월간 검색량, 3=블로그, 4=통검 노출, 5+=날짜)
// 이므로, 숫자/날짜처럼 드롭다운이 쓸모없는 열(월간 검색량, 블로그, 날짜열)만 숨긴다.
async function hideNumericAutoFilterButtons(buffer) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const sheetPaths = Object.keys(zip.files).filter(p => /^xl\/worksheets\/sheet\d+\.xml$/.test(p));
  for (const path of sheetPaths) {
    const xml = await zip.file(path).async('string');
    const patched = xml.replace(
      /<autoFilter ref="([A-Z]+)\d+:([A-Z]+)\d+"\/>/,
      (match, fromCol, toCol) => {
        const totalCols = colLetterToNumber(toCol) - colLetterToNumber(fromCol) + 1;
        const hideColIds = [];
        for (let colId = 0; colId < totalCols; colId++) {
          if (colId === 2 || colId === 3 || colId >= 5) hideColIds.push(colId);
        }
        const ref = match.match(/ref="([^"]+)"/)[1];
        const children = hideColIds.map(id => `<filterColumn colId="${id}" hiddenButton="1"/>`).join('');
        return `<autoFilter ref="${ref}">${children}</autoFilter>`;
      }
    );
    zip.file(path, patched);
  }
  return zip.generateAsync({ type: 'uint8array' });
}

const API = (path) => `/api/rank-tracker${path}`;

async function apiFetch(path, options, token) {
  const res = await fetch(API(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || '오류가 발생했습니다.');
    err.premiumOnly = !!body.premiumOnly;
    err.status = res.status;
    throw err;
  }
  return body;
}

// status는 이미 상위 5위 판정을 반영한다(백엔드 refreshRanks) — 'ranked'일 때만 숫자를 보여준다.
export default function RankTrackerPage({ onLoginRequest, onGoPricing, onHasItemsChange, onAuditBlog }) {
  const { user, session } = useAuth();
  const token = session?.access_token;

  const [mode, setMode] = useState('blog');
  const [items, setItems] = useState([]);

  useEffect(() => {
    onHasItemsChange?.(items.length > 0);
  }, [items, onHasItemsChange]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(''); // '' = 전체 그룹
  const [selected, setSelected] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshAllProgress, setRefreshAllProgress] = useState({ done: 0, total: 0, etaSeconds: null });
  const [failedJobId, setFailedJobId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editItem, setEditItem] = useState(null); // null = 신규, item = 수정
  const [error, setError] = useState('');
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [failedOnly, setFailedOnly] = useState(false);
  const [failedToastCount, setFailedToastCount] = useState(null);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const loadItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch('', {}, token);
      setItems(data);
    } catch (e) {
      if (e.premiumOnly) { setPremiumOnly(true); }
      else { setError(e.message); }
    }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { setSelectedIds(new Set()); }, [mode, selectedGroupId]);

  // 검색량·CTR이 비어 있는(각 기능 추가 이전에 등록된) 키워드를 조용히 백그라운드에서
  // 채운다 — 청크 단위 API라 세션당 한 번만 끝까지 돌리면 된다. 실패해도 페이지 이용에는
  // 영향 없어야 하므로 에러는 무시한다(프리미엄이 아니면 403이 나는데 그것도 그냥 넘어간다).
  const backfillRanRef = useRef(false);
  useEffect(() => {
    if (!token || backfillRanRef.current) return;
    backfillRanRef.current = true;
    (async () => {
      try {
        let done = false;
        let processedAny = false;
        while (!done) {
          const result = await apiFetch('/backfill-search-volume', { method: 'POST' }, token);
          done = !!result.done;
          if (result.processed > 0) processedAny = true;
        }
        if (processedAny) loadItems();
      } catch {
        // 조용히 무시 — 검색량/CTR 백필은 부가 기능이라 실패해도 페이지 이용에 지장 없어야 한다.
      }
    })();
  }, [token, loadItems]);

  const loadGroups = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/groups', {}, token);
      setGroups(data);
    } catch (e) {
      if (e.premiumOnly) setPremiumOnly(true);
    }
  }, [token]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const handleCreateGroup = async () => {
    const name = prompt('새 그룹 이름을 입력하세요');
    if (!name || !name.trim()) return;
    try {
      const g = await apiFetch('/groups', { method: 'POST', body: JSON.stringify({ name }) }, token);
      await loadGroups();
      setSelectedGroupId(String(g.id));
    } catch (e) { setError(e.message); }
  };

  const handleRenameGroup = async () => {
    if (!selectedGroupId) return;
    const current = groups.find(g => String(g.id) === selectedGroupId);
    const name = prompt('그룹 이름 변경', current?.name || '');
    if (!name || !name.trim()) return;
    try {
      await apiFetch(`/groups/${selectedGroupId}`, { method: 'PATCH', body: JSON.stringify({ name }) }, token);
      await loadGroups();
    } catch (e) { setError(e.message); }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId) return;
    if (!confirm('그룹을 삭제할까요? 그룹에 속한 항목은 삭제되지 않고 "전체"로 이동합니다.')) return;
    try {
      await apiFetch(`/groups/${selectedGroupId}`, { method: 'DELETE' }, token);
      setSelectedGroupId('');
      await Promise.all([loadGroups(), loadItems()]);
    } catch (e) { setError(e.message); }
  };

  const handleMoveItemGroup = async (itemId, groupId) => {
    try {
      await apiFetch(`/${itemId}/group`, { method: 'PATCH', body: JSON.stringify({ groupId: groupId || null }) }, token);
      await loadItems();
    } catch (e) { setError(e.message); }
  };

  // 즐겨찾기는 상단 고정이 바로 눈에 보여야 자연스러워서 낙관적으로 먼저 반영하고,
  // 실패하면 되돌린다.
  const handleToggleFavorite = async (itemId, favorite) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_favorite: favorite } : i));
    try {
      await apiFetch(`/${itemId}/favorite`, { method: 'PATCH', body: JSON.stringify({ favorite }) }, token);
    } catch (e) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_favorite: !favorite } : i));
      setError(e.message);
    }
  };

  const selectItem = useCallback(async (item) => {
    setSelected(item);
    setSnapshots([]);
    if (!token) return;
    try {
      const data = await apiFetch(`/${item.id}/snapshots`, {}, token);
      setSnapshots(data.snapshots || []);
    } catch (e) { setError(e.message); }
  }, [token]);

  const handleRefresh = async () => {
    if (!selected || !token) return;
    setRefreshing(true);
    try {
      await apiFetch(`/${selected.id}/refresh`, { method: 'POST' }, token);
      const [snapshotData, listData] = await Promise.all([
        apiFetch(`/${selected.id}/snapshots`, {}, token),
        apiFetch('', {}, token),
      ]);
      setSnapshots(snapshotData.snapshots || []);
      setItems(listData);
      const refreshed = listData.find(i => i.id === selected.id);
      if (refreshed) setSelected(refreshed);
    } catch (e) { setError(e.message); }
    finally { setRefreshing(false); }
  };

  const runJobToCompletion = async (job) => {
    const startedAt = Date.now();
    let current = job;
    // done/total이 처음 갱신된 시점부터의 처리 속도로 남은 시간을 추정한다
    // (요청 하나하나의 실제 소요 시간이 네트워크 상황에 따라 들쭉날쭉해서
    // 고정값 계산 대신 지금까지의 실측 속도를 그대로 외삽하는 방식을 쓴다).
    const updateProgress = () => {
      const done = current.completed_count + current.failed_count;
      const total = current.total_count;
      let etaSeconds = null;
      if (done > 0 && done < total) {
        const elapsedSec = (Date.now() - startedAt) / 1000;
        etaSeconds = Math.round((elapsedSec / done) * (total - done));
      }
      setRefreshAllProgress({ done, total, etaSeconds });
    };
    updateProgress();
    while (!current.done) {
      current = await apiFetch(`/refresh-jobs/${current.id}/process-chunk`, { method: 'POST' }, token);
      updateProgress();
    }
    return current;
  };

  // 전체 갱신과 "선택 항목만 갱신"이 같은 잡 기반 새로고침 메커니즘을 공유한다 —
  // 갱신 대상 id 목록만 다르게 넘긴다.
  // 예전에는 실패 항목이 있으면 사람이 "재시도" 버튼을 누르길 기다리지 않고 바로
  // 한 번 더 자동으로 돌렸는데, 막상 보니 실패가 거의 항상 "일시적 네트워크
  // 문제"가 아니라 같은 이유로 계속 실패하는 경우라 즉시 재시도가 똑같은 실패
  // 목록을 그대로 재현할 뿐 시간만 더 잡아먹었다. 그래서 즉시 자동 재시도는
  // 없애고, 실패가 남으면 곧바로 failedJobId를 세팅해 사람이 원할 때(예: 몇 분
  // 후) "실패 항목 재시도" 버튼을 눌러 다시 시도하게 한다.
  const runRefreshJob = async (ids, { skipFresh = false } = {}) => {
    if (!token || !ids.length) return;
    setRefreshingAll(true);
    setFailedJobId(null);
    try {
      const job = await apiFetch(
        '/refresh-jobs',
        { method: 'POST', body: JSON.stringify({ trackedIds: ids, skipFresh }) },
        token
      );
      const finished = await runJobToCompletion(job);

      if (finished.failed_count > 0) {
        setFailedJobId(finished.id);
        setFailedToastCount(finished.failed_count);
      }

      const listData = await apiFetch('', {}, token).catch(() => null);
      if (listData) {
        setItems(listData);
        if (selected) {
          const refreshed = listData.find(i => i.id === selected.id);
          if (refreshed) {
            setSelected(refreshed);
            const snapshotData = await apiFetch(`/${refreshed.id}/snapshots`, {}, token).catch(() => null);
            if (snapshotData) setSnapshots(snapshotData.snapshots || []);
          }
        }
      }
    } catch (e) { setError(e.message); }
    finally { setRefreshingAll(false); }
  };

  // 안정화된(수동 지정 또는 등록 14일 경과) 항목은 전체 갱신 대상에서 뺀다 — 이미
  // 순위가 안정된 항목까지 매번 다시 조회하는 건 시간 낭비다.
  const handleRefreshAll = () => runRefreshJob(
    filteredItems.filter(i => !isEffectivelyStabilized(i, mode)).map(i => i.id),
    { skipFresh: true }
  );
  const handleRefreshSelected = (ids) => runRefreshJob(ids);

  const handleRetryFailed = async () => {
    if (!token || !failedJobId) return;
    setRefreshingAll(true);
    try {
      const job = await apiFetch(`/refresh-jobs/${failedJobId}/retry-failed`, { method: 'POST' }, token);
      const finished = await runJobToCompletion(job);
      setFailedJobId(finished.failed_count > 0 ? finished.id : null);
      if (finished.failed_count > 0) setFailedToastCount(finished.failed_count);
      const listData = await apiFetch('', {}, token).catch(() => null);
      if (listData) setItems(listData);
    } catch (e) { setError(e.message); }
    finally { setRefreshingAll(false); }
  };

  const handleDelete = async (id) => {
    if (!token) return;
    if (!confirm('추적 항목을 삭제할까요? 모든 순위 기록이 사라집니다.')) return;
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' }, token);
      if (selected?.id === id) { setSelected(null); setSnapshots([]); }
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      await loadItems();
    } catch (e) { setError(e.message); }
  };

  const handleRemoveBlog = async (trackedId, blogId) => {
    if (!token) return;
    if (!confirm(`"${blogId}" 블로그를 이 키워드 추적에서 뺄까요?`)) return;
    try {
      await apiFetch(`/${trackedId}/remove-blog`, { method: 'POST', body: JSON.stringify({ blogId }) }, token);
      const listData = await apiFetch('', {}, token);
      setItems(listData);
      if (selected?.id === trackedId) {
        const refreshed = listData.find(i => i.id === trackedId);
        if (refreshed) setSelected(refreshed);
      }
    } catch (e) { setError(e.message); }
  };

  const toggleSelectId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async (ids) => {
    if (!token || !ids.length) return;
    if (!confirm(`선택한 ${ids.length}개 항목을 삭제할까요? 모든 순위 기록이 사라집니다.`)) return;
    try {
      await apiFetch('/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }, token);
      if (selected && ids.includes(selected.id)) { setSelected(null); setSnapshots([]); }
      setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
      await loadItems();
    } catch (e) { setError(e.message); }
  };

  // 삭제가 아니라 플래그만 바꾸는 것이라 낙관적으로 먼저 반영하고, 실패하면 되돌린다.
  const handleSetStabilized = async (ids, stabilized) => {
    if (!token || !ids.length) return;
    const prevItems = items;
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, is_stabilized: stabilized } : i));
    try {
      await apiFetch('/bulk-stabilize', { method: 'POST', body: JSON.stringify({ ids, stabilized }) }, token);
      setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
    } catch (e) {
      setItems(prevItems);
      setError(e.message);
    }
  };

  const handleToggleSelectAll = () => {
    setSelectedIds(prev => {
      const allSelected = filteredItems.length > 0 && filteredItems.every(i => prev.has(i.id));
      return allSelected ? new Set() : new Set(filteredItems.map(i => i.id));
    });
  };

  const scopedItems = items.filter(i =>
    i.mode === mode &&
    (!selectedGroupId || String(i.group_id ?? '') === selectedGroupId)
  );
  const failedCount = scopedItems.filter(hasFetchFailedLink).length;
  const filteredItems = scopedItems.filter(i =>
    (!searchQuery.trim() || i.keyword.toLowerCase().includes(searchQuery.trim().toLowerCase())) &&
    (!failedOnly || hasFetchFailedLink(i))
  );

  const handleExport = async () => {
    if (!token || filteredItems.length === 0) return;
    try {
      const rows = await apiFetch(
        '/export',
        { method: 'POST', body: JSON.stringify({ ids: filteredItems.map(i => i.id) }) },
        token
      );
      if (!rows.length) { setError('내보낼 순위 기록이 없습니다.'); return; }

      // 그룹별로 행을 나눠 그룹마다 별도 시트를 만든다(전체 그룹 보기에서 내보내도
      // 그룹1/그룹2/... 시트가 하나의 워크북에 나뉘어 담김). 특정 그룹만 선택해
      // 내보낸 경우는 자연히 시트가 하나뿐이다.
      const byGroupName = new Map();
      for (const r of rows) {
        const key = r.group || '없음';
        if (!byGroupName.has(key)) byGroupName.set(key, []);
        byGroupName.get(key).push(r);
      }
      const orderedNames = [...groups.map(g => g.name), '없음'].filter(name => byGroupName.has(name));
      for (const name of byGroupName.keys()) {
        if (!orderedNames.includes(name)) orderedNames.push(name);
      }

      // 내보내기를 누른 시점에만 exceljs를 불러와 초기 번들 크기에 영향을 주지 않는다.
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const usedSheetNames = new Set();
      for (const name of orderedNames) {
        const base = String(name).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || '없음';
        let sheetName = base;
        let i = 2;
        while (usedSheetNames.has(sheetName)) sheetName = `${base.slice(0, 28)}(${i++})`;
        usedSheetNames.add(sheetName);
        buildHeatmapSheet(workbook, sheetName, name, byGroupName.get(name));
      }

      const groupLabel = selectedGroupId
        ? (groups.find(g => String(g.id) === selectedGroupId)?.name || '그룹')
        : '전체';
      const rawBuffer = await workbook.xlsx.writeBuffer();
      const buffer = await hideNumericAutoFilterButtons(rawBuffer);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `순위기록_${groupLabel}_${getKSTToday()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

  if (premiumOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 18 }}>
        <div style={{ fontSize: 48, opacity: 0.25 }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>프리미엄 전용 기능입니다</div>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.8, margin: 0 }}>
          순위 추적은 프리미엄 플랜 구독자만 이용할 수 있어요.<br />프리미엄으로 업그레이드해보세요.
        </p>
        <button
          onClick={onGoPricing}
          style={{
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg,#0A84FF,#34C1FF)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            marginTop: 4, boxShadow: '0 4px 20px rgba(10,132,255,0.4)',
          }}
        >
          프리미엄 알아보기
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 18 }}>
        <div style={{ fontSize: 48, opacity: 0.25 }}>📊</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>로그인 후 이용할 수 있습니다</div>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.8, margin: 0 }}>
          키워드별 블로그 순위를 날짜별로 추적하고<br/>변화를 한눈에 확인해보세요
        </p>
        <button
          onClick={onLoginRequest}
          style={{
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            marginTop: 4,
          }}
        >
          로그인하기
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && (
        <div style={{
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)',
          fontSize: 13, color: '#FF453A', display: 'flex', justifyContent: 'space-between',
        }}>
          {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#FF453A', cursor: 'pointer', padding: 8, margin: -8, display: 'flex' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { id: 'blog', title: '블로그 추적 모드', desc: '특정 블로그가 키워드에서 몇 위인지 추적' },
          { id: 'all',  title: '전체 순위 모드',   desc: '키워드 블로그탭 상위 10개 스냅샷 기록' },
        ].map(m => (
          <div
            key={m.id}
            onClick={() => { setMode(m.id); setSelected(null); setSnapshots([]); setSortKey(null); }}
            style={{
              flex: 1, padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
              border: `1.5px solid ${mode === m.id ? 'var(--accent)' : 'var(--border)'}`,
              background: mode === m.id ? 'rgba(10,132,255,0.08)' : 'var(--bg-elevated)',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: mode === m.id ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 3 }}>{m.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.desc}</div>
          </div>
        ))}
      </div>

      <TrackerStatCards mode={mode} filteredItems={filteredItems} />

      <TrackerToolbar
        mode={mode}
        groups={groups}
        selectedGroupId={selectedGroupId}
        onGroupChange={(value) => { setSelectedGroupId(value); setSelected(null); setSnapshots([]); }}
        onCreateGroup={handleCreateGroup}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={handleDeleteGroup}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        failedOnly={failedOnly}
        onToggleFailedOnly={() => setFailedOnly(v => !v)}
        failedCount={failedCount}
        filteredItems={filteredItems}
        refreshingAll={refreshingAll}
        refreshAllProgress={refreshAllProgress}
        onRefreshAll={handleRefreshAll}
        failedJobId={failedJobId}
        onRetryFailed={handleRetryFailed}
        onExport={handleExport}
        onOpenBulkModal={() => setShowBulkModal(true)}
        onOpenAddModal={() => { setEditItem(null); setShowModal(true); }}
        onOpenNotificationSettings={() => setShowNotificationModal(true)}
        onOpenShareModal={() => setShowShareModal(true)}
      />

      <TrackerTable
        mode={mode}
        rows={filteredItems}
        groups={groups}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={(key, dir) => { setSortKey(key); setSortDir(dir); }}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelectId}
        onToggleSelectAll={handleToggleSelectAll}
        onRowClick={selectItem}
        onMoveItemGroup={handleMoveItemGroup}
        onToggleFavorite={handleToggleFavorite}
        onAddBlog={(item) => { setEditItem(item); setShowModal(true); }}
        onRemoveBlog={handleRemoveBlog}
        onDeleteKeyword={handleDelete}
        onBulkDeleteSelected={handleBulkDelete}
        onSetStabilizedSelected={handleSetStabilized}
        onRefreshSelected={handleRefreshSelected}
        refreshingSelected={refreshingAll}
        onAuditBlog={onAuditBlog}
        loading={loading}
      />

      <TrackerDetailDrawer
        open={!!selected}
        onClose={() => { setSelected(null); setSnapshots([]); }}
        mode={mode}
        selected={selected}
        snapshots={snapshots}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onAuditBlog={onAuditBlog && ((blogId) => {
          setSelected(null); setSnapshots([]);
          onAuditBlog(blogId);
        })}
      />

      {showModal && (
        <AddTrackerModal
          mode={mode}
          token={token}
          editItem={editItem}
          groups={groups}
          defaultGroupId={selectedGroupId}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onAdded={async () => { setShowModal(false); setEditItem(null); await loadItems(); }}
        />
      )}

      {showNotificationModal && (
        <NotificationSettingsModal
          token={token}
          onClose={() => setShowNotificationModal(false)}
        />
      )}

      {showShareModal && (
        <ShareReportModal
          token={token}
          groupId={selectedGroupId || null}
          groupName={selectedGroupId ? (groups.find(g => String(g.id) === selectedGroupId)?.name || '그룹') : null}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showBulkModal && (
        <BulkImportModal
          token={token}
          groups={groups}
          defaultGroupId={selectedGroupId}
          onClose={() => setShowBulkModal(false)}
          onImported={async () => { setShowBulkModal(false); await loadItems(); }}
        />
      )}

      {failedToastCount != null && (
        <FailedToast
          count={failedToastCount}
          onView={() => { setFailedOnly(true); setFailedToastCount(null); }}
          onDone={() => setFailedToastCount(null)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function AddTrackerModal({ mode: defaultMode, token, editItem, groups, defaultGroupId, onClose, onAdded }) {
  const isEdit = !!editItem;
  const [modalMode, setModalMode] = useState(editItem?.mode || defaultMode);
  const [keyword, setKeyword] = useState(editItem?.keyword || '');
  const [urlInput, setUrlInput] = useState('');
  const [blogUrls, setBlogUrls] = useState(editItem?.blog_ids || []);
  const [groupId, setGroupId] = useState(String(editItem?.group_id ?? defaultGroupId ?? ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function extractBlogId(url) {
    const m = String(url).match(/blog\.naver\.com\/([^/?#\s]+)/);
    return m ? m[1] : url.trim();
  }

  function addUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setBlogUrls(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    setUrlInput('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!keyword.trim()) { setError('키워드를 입력해 주세요.'); return; }
    if (modalMode === 'blog' && !blogUrls.length) { setError('블로그 URL을 1개 이상 추가해 주세요.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/rank-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ keyword: keyword.trim(), mode: modalMode, blogUrls, groupId: groupId ? Number(groupId) : null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '등록에 실패했습니다.');
      onAdded();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
        borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 480,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{isEdit ? `URL 추가 — ${editItem.keyword}` : '추적 등록'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 8, margin: -8 }}>
            <X size={18} />
          </button>
        </div>

        {!isEdit && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {[{ id: 'blog', label: '블로그 추적', desc: '내 블로그 순위 추적' }, { id: 'all', label: '전체 순위', desc: '상위 10위 스냅샷' }].map(m => (
              <div key={m.id} onClick={() => setModalMode(m.id)} style={{
                flex: 1, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${modalMode === m.id ? 'var(--accent)' : 'var(--border)'}`,
                background: modalMode === m.id ? 'rgba(10,132,255,0.08)' : 'transparent',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: modalMode === m.id ? 'var(--accent)' : 'var(--text-secondary)' }}>{m.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isEdit && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>타겟 키워드</label>
              <input
                value={keyword} onChange={e => setKeyword(e.target.value)}
                placeholder=""
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
          )}

          {!isEdit && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>그룹 (선택)</label>
              <select
                value={groupId} onChange={e => setGroupId(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">그룹 없음</option>
                {(groups || []).map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
              </select>
            </div>
          )}

          {modalMode === 'blog' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>추적할 블로그 URL</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
                  placeholder=""
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 9, boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-strong)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button type="button" onClick={addUrl} style={{
                  padding: '9px 14px', borderRadius: 9, border: 'none', background: 'var(--accent)',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}>추가</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {blogUrls.map(url => (
                  <span key={url} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-strong)',
                    fontSize: 12, color: 'var(--text-secondary)',
                  }}>
                    {extractBlogId(url)}
                    <button type="button" onClick={() => setBlogUrls(p => p.filter(u => u !== url))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 6, margin: -6, display: 'flex', lineHeight: 1 }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <p style={{ margin: 0, fontSize: 12, color: '#FF453A', fontWeight: 500 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: '9px 16px', borderRadius: 9, border: '1px solid var(--border-strong)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}>취소</button>
            <button type="submit" disabled={loading} style={{
              padding: '9px 20px', borderRadius: 9, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>{loading ? (isEdit ? '저장 중…' : '등록 중…') : (isEdit ? '저장하기' : '등록하기')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
