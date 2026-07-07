# 순위 추적 엑셀 내보내기 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 순위 추적 엑셀 내보내기를 `exceljs` 기반으로 재작성해 틀 고정·자동필터·정렬 개선·그룹 제목 행·비주얼 리디자인을 적용한다.

**Architecture:** `client/src/pages/RankTrackerPage.jsx` 안의 `buildHeatmapSheet`(시트 1개 생성)와 `handleExport`(워크북 조립 + 다운로드) 두 함수를 `xlsx-js-style` 대신 `exceljs` API로 재작성한다. 서버 쪽(`exportSnapshots`)과 다른 두 곳(`App.jsx` 키워드 분석 내보내기, `BulkImportModal.jsx` 업로드 파싱)은 손대지 않는다.

**Tech Stack:** React 18 + Vite, `exceljs`(신규), 기존 `xlsx-js-style`(다른 두 곳 유지)

## Global Constraints

- 이 클라이언트 패키지엔 프론트 자동 테스트 러너가 없다(`client/package.json`에 test 스크립트 없음) — 각 태스크의 검증은 `npm run build` 통과 + 수동 브라우저 검증으로 한다.
- `exceljs`는 `RankTrackerPage.jsx`의 `handleExport` 함수 **안에서만** 동적 import(`await import('exceljs')`)한다. 파일 최상단에 정적 import를 추가하지 않는다(초기 번들 크기 영향 없게).
- 색상은 ARGB 8자리 헥스(`FF` + 6자리 RGB)로 지정한다 — exceljs 요구사항이며 기존 `xlsx-js-style`의 6자리 RGB(`{rgb: 'XXXXXX'}`)와 형식이 다르다(`{argb: 'FFXXXXXX'}`).
- `xlsx-js-style`는 `client/src/App.jsx`, `client/src/components/BulkImportModal.jsx`에서 계속 쓰이므로 **절대 제거하지 않는다**.
- 서버(`server/services/rankTrackerService.js`의 `exportSnapshots`)는 변경하지 않는다 — 이번 작업은 프론트 시트 생성 로직에 한정.
- 참조 스펙: `docs/superpowers/specs/2026-07-07-rank-tracker-export-redesign-design.md`

---

### Task 1: exceljs 의존성 추가

**Files:**
- Modify: `client/package.json`
- Modify: `client/package-lock.json`

**Interfaces:**
- Produces: `exceljs` 패키지가 `client/node_modules`에 설치되어 이후 태스크에서 `await import('exceljs')`로 불러올 수 있음

- [ ] **Step 1: 의존성 설치**

```bash
cd client && npm install exceljs
```

- [ ] **Step 2: package.json에 반영됐는지 확인**

Run: `grep exceljs client/package.json`
Expected: `"exceljs": "^4.4.0"` (또는 그 이상 patch 버전) 한 줄 출력

- [ ] **Step 3: 빌드가 깨지지 않는지 확인**

Run: `cd client && npm run build`
Expected: `✓ built in ...` 로 성공 종료 (아직 exceljs를 쓰는 코드가 없으므로 기존과 동일하게 성공해야 함)

- [ ] **Step 4: 커밋**

```bash
git add client/package.json client/package-lock.json
git commit -m "chore: add exceljs dependency for rank tracker export redesign"
```

---

### Task 2: 색상 팔레트·범례 상수 교체

**Files:**
- Modify: `client/src/pages/RankTrackerPage.jsx:1-49`

**Interfaces:**
- Consumes: 없음 (상수/순수 함수만 교체)
- Produces: `heatmapCellColor(snap)` — `{bg, font}` 반환(8자리 ARGB), `integratedCellColor(value)` — `{bg, font}` 반환, `HEATMAP_LEGEND`/`INTEGRATED_LEGEND` 배열(각 항목 `{label, bg, font}`), `CELL_BORDER`/`HEADER_BORDER`/`EXPORT_FONT` — Task 3에서 그대로 사용

- [ ] **Step 1: 최상단 `xlsx-js-style` import 제거**

`client/src/pages/RankTrackerPage.jsx` 2번째 줄의 아래 코드를 찾아서:

```js
import * as XLSX from 'xlsx-js-style';
```

이 줄을 완전히 삭제한다(파일 1번째 줄 `import { useState, useEffect, useCallback } from 'react';`는 그대로 둠).

- [ ] **Step 2: 색상 헬퍼와 범례 상수를 새 팔레트로 교체**

아래 기존 코드 블록을 찾는다(`getKSTToday` 함수 바로 다음, `displayWidth` 함수 바로 전까지):

```js
// RankCalendar 화면 배색과 맞춘 히트맵 셀 색상 — rank==null이면 미노출, status가 fetch_failed면 조회 실패로 별도 표시.
function heatmapCellColor(cell) {
  if (!cell) return { bg: 'F2F2F2', font: '9E9E9E' };
  if (cell.status === 'fetch_failed') return { bg: 'FFCC80', font: '7A4B00' };
  const rank = cell.rank;
  if (rank == null) return { bg: 'E0E0E0', font: '9E9E9E' };
  if (rank === 1) return { bg: '1E8E3E', font: 'FFFFFF' };
  if (rank <= 2) return { bg: '34A853', font: 'FFFFFF' };
  if (rank <= 3) return { bg: '81C995', font: '1A3C1A' };
  if (rank <= 5) return { bg: 'FBBC04', font: '5C4400' };
  if (rank <= 7) return { bg: 'FDD663', font: '5C4400' };
  return { bg: 'F28B82', font: '7A1E14' };
}

const HEATMAP_LEGEND = [
  { label: '1위', bg: '1E8E3E', font: 'FFFFFF' },
  { label: '2위', bg: '34A853', font: 'FFFFFF' },
  { label: '3위', bg: '81C995', font: '1A3C1A' },
  { label: '5위', bg: 'FBBC04', font: '5C4400' },
  { label: '7위', bg: 'FDD663', font: '5C4400' },
  { label: '10위', bg: 'F28B82', font: '7A1E14' },
  { label: '미노출', bg: 'E0E0E0', font: '9E9E9E' },
  { label: '조회 실패', bg: 'FFCC80', font: '7A4B00' },
];

// 통합검색 노출 O/X 셀 색 — 순위 팔레트(초록~빨강)와 겹치면 구분이 안 가서
// 아예 다른 색 계열(파란색)을 쓴다.
function integratedCellColor(value) {
  if (value === 'O') return { bg: '1A73E8', font: 'FFFFFF' };
  if (value === 'X') return { bg: 'B3C6E8', font: '1A3C6E' };
  return { bg: 'F2F2F2', font: '9E9E9E' };
}

const INTEGRATED_LEGEND = [
  { label: 'O (통검 노출)', bg: '1A73E8', font: 'FFFFFF' },
  { label: 'X (통검 미노출)', bg: 'B3C6E8', font: '1A3C6E' },
];
```

이 전체 블록을 아래로 교체한다:

```js
// exceljs는 8자리 ARGB(FF + 6자리 RGB) 헥스를 쓴다. 모든 데이터 셀에 옅은 회색 테두리를
// 명시적으로 넣어 인쇄/타 프로그램에서도 격자가 유지되게 하고, 헤더 아래엔 더 굵은 구분선을 둔다.
const THIN_BORDER = { style: 'thin', color: { argb: 'FFD9D9D9' } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
const HEADER_BORDER = { ...CELL_BORDER, bottom: { style: 'medium', color: { argb: 'FF1C2333' } } };
const EXPORT_FONT = '맑은 고딕';

const NOT_RANKED_COLOR = { bg: 'FFEEEEEE', font: 'FF9E9E9E' };
const FETCH_FAILED_COLOR = { bg: 'FFBCAAA4', font: 'FF3E2723' };

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

function heatmapCellColor(snap) {
  if (!snap) return NOT_RANKED_COLOR;
  if (snap.status === 'fetch_failed') return FETCH_FAILED_COLOR;
  if (snap.rank == null) return NOT_RANKED_COLOR;
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
```

- [ ] **Step 3: 빌드 확인**

Run: `cd client && npm run build`
Expected: 성공 (Task 3에서 `buildHeatmapSheet`를 고치기 전까지는 이 파일의 다른 부분이 옛 필드명(`{rgb:...}`)을 여전히 참조하고 있어도 문법 오류만 없으면 빌드는 통과함 — 런타임 동작은 Task 3까지 마쳐야 정상)

- [ ] **Step 4: 커밋**

```bash
git add client/src/pages/RankTrackerPage.jsx
git commit -m "refactor: switch rank tracker export color palette to exceljs ARGB format"
```

---

### Task 3: `buildHeatmapSheet`를 exceljs 기반으로 재작성

**Files:**
- Modify: `client/src/pages/RankTrackerPage.jsx` (Task 2 완료 후 `buildHeatmapSheet` 함수 전체 — 함수 시작은 `function buildHeatmapSheet(rows) {`로 찾을 수 있음)

**Interfaces:**
- Consumes: Task 2의 `heatmapCellColor`, `integratedCellColor`, `HEATMAP_LEGEND`, `INTEGRATED_LEGEND`, `CELL_BORDER`, `HEADER_BORDER`, `EXPORT_FONT`. 이 파일에 이미 있는 `displayWidth`, `autoColWidth`, `formatDateLabels` (변경 없음, 그대로 재사용)
- Produces: `buildHeatmapSheet(workbook, sheetName, groupName, rows)` — `ExcelJS.Workbook` 인스턴스에 워크시트 하나를 추가하고 그 워크시트를 반환. Task 4의 `handleExport`가 이 시그니처로 호출함(파라미터 4개, 기존 `rows` 1개짜리에서 변경).

- [ ] **Step 1: 기존 `buildHeatmapSheet` 함수 전체를 새 버전으로 교체**

기존 함수(`function buildHeatmapSheet(rows) {` 부터 그 함수의 닫는 `}`까지 — `XLSX.utils.aoa_to_sheet`, `XLSX.utils.encode_cell` 등을 쓰는 버전)를 통째로 찾아서 아래 코드로 교체한다:

```js
function buildHeatmapSheet(workbook, sheetName, groupName, rows) {
  const dates = [...new Set(rows.map(r => r.date))].sort();
  const dateLabels = formatDateLabels(dates);

  const rowMap = new Map();
  for (const r of rows) {
    const key = `${r.keyword} ${r.blogId}`;
    if (!rowMap.has(key)) {
      rowMap.set(key, { keyword: r.keyword, searchVolume: r.searchVolume, blogId: r.blogId, mode: r.mode, registeredAt: r.registeredAt, cells: {} });
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
    for (let i = dates.length - 1; i >= 0; i--) {
      const c = dr.cells[dates[i]];
      if (!c) continue;
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
        if (!c) return 'X';
        if (c.status === 'fetch_failed') return '실패';
        return c.rank != null ? c.rank : 'X';
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
      const color = heatmapCellColor(dr.cells[d]);
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

  worksheet.views = [{ state: 'frozen', xSplit: infoColCount, ySplit: 2 }];
  worksheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: totalCols },
  };

  return worksheet;
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd client && npm run build`
Expected: 성공. (`handleExport`가 아직 옛 시그니처로 이 함수를 호출하고 있어 런타임 동작은 Task 4까지 마쳐야 정상 — 이 시점엔 문법/빌드만 확인)

- [ ] **Step 3: 커밋**

```bash
git add client/src/pages/RankTrackerPage.jsx
git commit -m "feat: rewrite rank tracker heatmap sheet builder with exceljs"
```

---

### Task 4: `handleExport`를 exceljs 워크북 조립 + 다운로드로 교체

**Files:**
- Modify: `client/src/pages/RankTrackerPage.jsx` (`handleExport` 함수 전체)

**Interfaces:**
- Consumes: Task 3의 `buildHeatmapSheet(workbook, sheetName, groupName, rows)`
- Produces: 브라우저에서 `.xlsx` 파일 다운로드 트리거 (다른 태스크가 이 결과를 소비하지 않음 — 최종 사용자 동작)

- [ ] **Step 1: 기존 `handleExport` 함수 전체를 새 버전으로 교체**

기존 함수(`const handleExport = async () => {` 부터 그 함수의 닫는 `};`까지 — `XLSX.utils.book_new`, `XLSX.writeFile` 등을 쓰는 버전)를 통째로 찾아서 아래 코드로 교체한다:

```js
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
      const buffer = await workbook.xlsx.writeBuffer();
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
```

- [ ] **Step 2: 빌드 확인**

Run: `cd client && npm run build`
Expected: 성공. 이제 이 파일에서 `XLSX`(`xlsx-js-style`) 참조가 완전히 사라졌어야 함 — 아래 명령으로 재확인:

Run: `grep -n "XLSX" client/src/pages/RankTrackerPage.jsx`
Expected: 아무 결과도 없음(no matches)

- [ ] **Step 3: 커밋**

```bash
git add client/src/pages/RankTrackerPage.jsx
git commit -m "feat: assemble rank tracker export workbook via exceljs and trigger blob download"
```

---

### Task 5: 수동 통합 검증 + 회귀 확인

**Files:** 없음 (코드 변경 없음, 검증만)

**Interfaces:**
- Consumes: Task 1~4의 전체 결과물
- Produces: 없음 (검증 완료 확인)

- [ ] **Step 1: 서버·클라이언트 로컬 구동**

```bash
cd server && npm run dev
```

새 터미널에서:

```bash
cd client && npm run dev
```

- [ ] **Step 2: 순위 추적 탭에서 내보내기 실행**

브라우저에서 로그인 후 "순위 추적" 탭으로 이동. 검색량이 서로 다른 키워드 여러 개, 블로그 여러 개, 최소 하나는 통검노출 O, 하나는 X인 상태(기존에 등록되어 있는 실제 데이터로 충분)에서 "내보내기" 버튼을 클릭한다.

Expected: 에러 메시지 없이 `순위기록_{그룹명 또는 전체}_{오늘날짜}.xlsx` 파일이 다운로드됨.

- [ ] **Step 3: 다운로드된 파일을 실제로 열어 항목별로 확인**

Excel(또는 호환 뷰어)로 파일을 열어 아래를 모두 확인한다:

- [ ] 시트마다 맨 위에 "그룹: {그룹명}" 제목 행이 있고, 네이비 배경 + 흰 굵은 글씨로 표시됨
- [ ] 그 아래 헤더 행: `등록일 | 키워드 | 월간 검색량 | 블로그 | 통검 노출 | (날짜...)` — "그룹" 열이 없음
- [ ] 데이터가 월간 검색량 내림차순으로 정렬돼 있고, 검색량이 같은 키워드끼리는 등록일(발행일) 오래된 순으로 묶여 있음
- [ ] 시트를 오른쪽/아래로 스크롤해도 제목 행 + 헤더 행 + 왼쪽 5개 정보열(등록일~통검노출)이 화면에 고정되어 있음
- [ ] 헤더 행 각 셀에 자동필터 드롭다운(▼) 버튼이 있고, 클릭하면 필터링이 동작함
- [ ] 순위 셀 색상이 새 팔레트(진초록~진빨강)로 바뀌어 있고, 미노출/조회실패 셀이 서로 다른 색으로 구분됨
- [ ] 모든 데이터 셀에 옅은 회색 테두리가 있고, 헤더 행 아래는 더 굵은 구분선으로 보임
- [ ] 열 너비가 내용 길이에 맞게 적절히 표시됨(키워드/블로그 텍스트가 잘리지 않음)
- [ ] 그룹이 여러 개라 시트가 여러 장이면, 시트 탭 이름이 그룹명대로(또는 중복 시 `(2)`, `(3)`) 붙어 있음
- [ ] 발행일을 한 번도 확인 못한 항목이 있다면 등록일 뒤에 `*`가 붙고, 시트 맨 아래 범례 밑에 안내 문구가 있음

- [ ] **Step 4: 다른 두 곳(xlsx-js-style 사용처) 회귀 확인**

키워드 분석 탭에서 검색 후 결과 내보내기 버튼을 눌러 `.xlsx`가 정상적으로 받아지는지 확인(`App.jsx`). 순위 추적 탭의 "대량 등록" 모달에서 엑셀 파일 업로드 파싱이 정상 동작하는지 확인(`BulkImportModal.jsx`).

Expected: 두 기능 모두 이번 변경 전과 동일하게 동작함(에러 없음).

- [ ] **Step 5: 최종 빌드 재확인 + 푸시**

```bash
cd client && npm run build
```

Expected: 성공. 문제 없으면 이미 Task 1~4에서 커밋된 내용을 원격에 푸시한다:

```bash
git push origin master
```
