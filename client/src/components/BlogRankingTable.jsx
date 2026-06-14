import { Download, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ── 블로그 지수 계산 (블로그 탭 전용) ────────────────────────────────────────
function calcBlogIndex(item, keyword) {
  const rankScore = Math.max(0, 35 - (item.rank - 1) * 5);

  const titleNorm = (item.title || '').toLowerCase().replace(/\s+/g, '');
  const kwNorm    = (keyword   || '').toLowerCase().replace(/\s+/g, '');
  const kwWords   = (keyword   || '').split(/\s+/).filter(Boolean);
  let titleScore  = 0;
  if (kwNorm && titleNorm.includes(kwNorm)) {
    titleScore = 20;
  } else if (kwWords.length) {
    const hit = kwWords.filter(w => titleNorm.includes(w.toLowerCase())).length;
    titleScore = Math.round((hit / kwWords.length) * 15);
  }

  const d = item.daysAgo;
  let recency = 0;
  if (d !== null && d !== undefined) {
    if      (d <=   7) recency = 15;
    else if (d <=  30) recency = 12;
    else if (d <=  90) recency = 9;
    else if (d <= 180) recency = 6;
    else if (d <= 365) recency = 3;
  }

  let reaction = 0;
  const v = item.dailyVisitors;
  if (v) {
    if      (v >= 10000) reaction = 15;
    else if (v >=  5000) reaction = 12;
    else if (v >=  1000) reaction = 9;
    else if (v >=   500) reaction = 6;
    else if (v >=   100) reaction = 3;
    else                 reaction = 1;
  }

  return rankScore + titleScore + recency + reaction;
}

// ── CSV 다운로드 ───────────────────────────────────────────────────────────
function downloadCSV(rankings, keyword, tab) {
  const isView = tab === 'view';
  const hasBlog = tab === 'blog';

  const headers = isView
    ? ['순위', '유형', '작성자/카페', '제목', 'URL', '발행일']
    : hasBlog
      ? ['순위', '블로그명', '제목', 'URL', '발행일', '방문자/일', '블로그지수']
      : ['순위', '카페명', '제목', 'URL', '발행일'];

  const rows = rankings.map((r) =>
    isView
      ? [r.rank, r.type === 'blog' ? '블로그' : '카페', r.author, r.title, r.postLink, r.date]
      : hasBlog
        ? [r.rank, r.author, r.title, r.postLink, r.date, r.dailyVisitors ?? '비공개', r.blogIndex ?? '-']
        : [r.rank, r.author, r.title, r.postLink, r.date]
  );

  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  const TAB_LABEL = { blog: '블로그', view: 'VIEW', cafe: '카페' };
  a.download = `${TAB_LABEL[tab] || ''}순위_${keyword}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 12 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: 'var(--bg-overlay)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  );
}

function RankBadge({ rank }) {
  const RANK_STYLE = {
    1: { bg: '#ffd60a20', color: '#b8920a', border: '#ffd60a40' },
    2: { bg: '#a1a1a618', color: '#888',    border: '#a1a1a640' },
    3: { bg: '#c96b2e20', color: '#c96b2e', border: '#c96b2e40' },
  };
  const s = RANK_STYLE[rank] || { bg: 'var(--bg-overlay)', color: 'var(--text-tertiary)', border: 'var(--border)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 22, height: 22, borderRadius: 6,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: 11, fontWeight: 700, flexShrink: 0,
    }}>
      {rank}
    </span>
  );
}

function TypeBadge({ type }) {
  const isBlog = type === 'blog';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '1px 6px', borderRadius: 4,
      fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
      background: isBlog ? '#0A84FF18' : '#30d15818',
      color: isBlog ? '#0A84FF' : '#30d158',
      border: `1px solid ${isBlog ? '#0A84FF30' : '#30d15830'}`,
      flexShrink: 0,
    }}>
      {isBlog ? '블로그' : '카페'}
    </span>
  );
}

function IndexCell({ score }) {
  const MAX = 85;
  const pct  = Math.min(100, Math.round((score / MAX) * 100));
  const color = score >= 60 ? '#30d158' : score >= 35 ? '#ffd60a' : '#ff6b6b';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
      <div style={{ width: 36, height: 3, borderRadius: 2, background: 'var(--bg-overlay)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 20, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

function VisitorsCell({ value }) {
  return (
    <span style={{
      fontSize: 11, textAlign: 'right',
      color: value != null ? 'var(--text-primary)' : 'var(--text-tertiary)',
      fontWeight: value != null ? 600 : 400,
    }}>
      {value != null ? value.toLocaleString() : '비공개'}
    </span>
  );
}

function SkeletonRows({ colCount }) {
  return (
    <tbody>
      {Array.from({ length: 8 }, (_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: colCount }, (__, j) => (
            <td key={j} style={{ padding: '10px' }}>
              <Skeleton w={j === 2 ? `${70 + (i % 3) * 10}%` : j === 0 ? 22 : 64} h={j === 0 ? 22 : 12} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ── 탭별 컬럼 정의 ────────────────────────────────────────────────────────
const COLS = {
  blog: [
    { label: '#',      align: 'center', width: 36 },
    { label: '블로그명', align: 'left',   width: 88 },
    { label: '제목',   align: 'left',   width: undefined },
    { label: '발행일', align: 'right',  width: 70 },
    { label: '방문자/일', align: 'right', width: 70 },
    { label: '지수',   align: 'right',  width: 70 },
  ],
  view: [
    { label: '#',    align: 'center', width: 36 },
    { label: '유형', align: 'center', width: 56 },
    { label: '작성자/카페', align: 'left', width: 88 },
    { label: '제목', align: 'left',   width: undefined },
    { label: '발행일', align: 'right', width: 70 },
  ],
  cafe: [
    { label: '#',    align: 'center', width: 36 },
    { label: '카페명', align: 'left',  width: 88 },
    { label: '제목', align: 'left',   width: undefined },
    { label: '발행일', align: 'right', width: 70 },
  ],
};

function THead({ tab }) {
  const cols = COLS[tab] || COLS.blog;
  return (
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        {cols.map(({ label, align, width }) => (
          <th key={label} style={{
            padding: '7px 10px', fontSize: 9, fontWeight: 700,
            color: 'var(--text-tertiary)', letterSpacing: '0.06em',
            textTransform: 'uppercase', textAlign: align,
            background: 'var(--bg-secondary)',
            ...(width ? { width } : {}),
          }}>
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function DataRows({ rows, keyword, tab }) {
  return (
    <tbody>
      {rows.map((item) => (
        <tr
          key={item.rank}
          style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-overlay)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <td style={{ padding: '9px 10px', textAlign: 'center' }}>
            <RankBadge rank={item.rank} />
          </td>

          {tab === 'view' && (
            <td style={{ padding: '9px 10px', textAlign: 'center' }}>
              <TypeBadge type={item.type} />
            </td>
          )}

          {/* 작성자 / 카페명 / 블로그명 */}
          <td style={{
            padding: '9px 10px', fontSize: 11, color: 'var(--text-secondary)',
            maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={item.author}>
            {item.author || '—'}
          </td>

          {/* 제목 */}
          <td style={{ padding: '9px 10px', maxWidth: 0 }}>
            <a
              href={item.postLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-primary)', textDecoration: 'none',
                fontSize: 12, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}
              title={item.title}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
              <ExternalLink size={10} style={{ flexShrink: 0, opacity: 0.4 }} />
            </a>
          </td>

          {/* 발행일 */}
          <td style={{
            padding: '9px 10px', fontSize: 11,
            color: 'var(--text-tertiary)', textAlign: 'right', whiteSpace: 'nowrap',
          }}>
            {item.date || '—'}
          </td>

          {/* 방문자/일 (블로그 탭 전용) */}
          {tab === 'blog' && (
            <>
              <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                <VisitorsCell value={item.dailyVisitors} />
              </td>
              <td style={{ padding: '9px 10px' }}>
                <IndexCell score={item.blogIndex} />
              </td>
            </>
          )}
        </tr>
      ))}
    </tbody>
  );
}

// ── 탭 스위처 ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'blog', label: '블로그' },
  { id: 'view', label: 'VIEW' },
  { id: 'cafe', label: '카페' },
];

function TabSwitcher({ active, onChange }) {
  return (
    <div style={{
      display: 'inline-flex',
      background: 'var(--bg-overlay)',
      borderRadius: 8,
      padding: 2,
      gap: 1,
    }}>
      {TABS.map(({ id, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              letterSpacing: '0.04em',
              transition: 'all 0.15s',
              background: isActive ? 'var(--accent)' : 'transparent',
              color: isActive ? '#fff' : 'var(--text-tertiary)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function BlogRankingTable({ baseKeyword }) {
  const [activeTab,  setActiveTab]  = useState('blog');
  const [tabData,    setTabData]    = useState({ blog: null, view: null, cafe: null });
  const [tabLoading, setTabLoading] = useState({ blog: false, view: false, cafe: false });
  const [errMsg,     setErrMsg]     = useState(null);
  const mounted   = useRef(true);
  const inFlight  = useRef(new Set());

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // baseKeyword 바뀌면 캐시 전부 초기화
  useEffect(() => {
    setTabData({ blog: null, view: null, cafe: null });
    setTabLoading({ blog: false, view: false, cafe: false });
    setErrMsg(null);
    inFlight.current.clear();
  }, [baseKeyword]);

  // 현재 탭 데이터 fetch
  useEffect(() => {
    if (!baseKeyword) return;
    if (tabData[activeTab] !== null) return; // 이미 데이터 있으면 skip

    const key = `${baseKeyword}:${activeTab}`;
    if (inFlight.current.has(key)) return; // 이미 요청 중이면 skip
    inFlight.current.add(key);

    const snap = activeTab; // 클로저 캡처 (stale closure 방지)
    setTabLoading(prev => ({ ...prev, [snap]: true }));
    setErrMsg(null);

    fetch(`/api/keywords/blog-rankings?keyword=${encodeURIComponent(baseKeyword)}&tab=${snap}`)
      .then((r) => {
        if (!r.ok) throw new Error(`서버 오류 (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (!mounted.current) return;
        if (!Array.isArray(data) || data.length === 0) {
          setErrMsg(`${TABS.find(t => t.id === snap)?.label} 탭 결과를 가져올 수 없습니다.`);
        } else {
          setTabData(prev => ({ ...prev, [snap]: data }));
        }
        setTabLoading(prev => ({ ...prev, [snap]: false }));
        inFlight.current.delete(key);
      })
      .catch((e) => {
        if (!mounted.current) return;
        setErrMsg(`불러오기 실패: ${e.message}`);
        setTabLoading(prev => ({ ...prev, [snap]: false }));
        inFlight.current.delete(key);
      });
  }, [baseKeyword, activeTab, tabData]);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setErrMsg(null);
  };

  const loading  = tabLoading[activeTab];
  const rawRows  = tabData[activeTab];

  // 블로그 탭만 지수 계산
  const enriched = rawRows?.map((item) => ({
    ...item,
    blogIndex: activeTab === 'blog' ? calcBlogIndex(item, baseKeyword) : undefined,
  }));

  const colCount = (COLS[activeTab] || COLS.blog).length;

  return (
    <div>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, gap: 8,
      }}>
        <TabSwitcher active={activeTab} onChange={handleTabChange} />

        {enriched?.length ? (
          <button
            onClick={() => downloadCSV(enriched, baseKeyword, activeTab)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: 'var(--text-tertiary)',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 5, padding: '3px 8px', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <Download size={10} /> CSV
          </button>
        ) : null}
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <THead tab={activeTab} />
          {loading   && <SkeletonRows colCount={colCount} />}
          {enriched  && !loading && <DataRows rows={enriched} keyword={baseKeyword} tab={activeTab} />}
        </table>
      </div>

      {/* 에러 */}
      {errMsg && !loading && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '12px 0', textAlign: 'center' }}>
          {errMsg}
        </div>
      )}

      {/* 안내 문구 */}
      <p style={{ fontSize: 9.5, color: 'var(--text-tertiary)', margin: '6px 0 0', lineHeight: 1.5 }}>
        {activeTab === 'blog'
          ? '지수 = 순위(35) + 키워드 일치(20) + 최신성(15) + 방문자(15) + 활동성(15, 미수집)'
          : activeTab === 'view'
            ? 'VIEW탭 = 블로그 + 카페 통합 순위 · 방문자 수는 블로그 글에만 표시'
            : '카페탭 순위 · 네이버 카페 게시글 기준'}
      </p>
    </div>
  );
}
