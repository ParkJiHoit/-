import { Download, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ── 블로그 지수 계산 (최대 85점 – 활동성 항목 데이터 없음) ─────────────────
// 순위(35) + 키워드일치(20) + 최신성(15) + 방문자반응(15) + 활동성(15, 현재 0)
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

  return rankScore + titleScore + recency + reaction; // 활동성 0
}

// ── CSV 다운로드 ───────────────────────────────────────────────────────────
function downloadCSV(rankings, keyword) {
  const headers = ['순위', '블로그명', '제목', 'URL', '발행일', '방문자/일', '블로그지수'];
  const rows = rankings.map((r) => [
    r.rank,
    r.author,
    r.title,
    r.postLink,
    r.date,
    r.dailyVisitors ?? '비공개',
    r.blogIndex ?? '-',
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `블로그순위_${keyword}_${new Date().toISOString().slice(0, 10)}.csv`;
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

const COL_HEADS = [
  { label: '#',     align: 'center', width: 36 },
  { label: '블로그명', align: 'left',   width: 88 },
  { label: '제목',   align: 'left',   width: undefined },
  { label: '발행일', align: 'right',  width: 70 },
  { label: '방문자/일', align: 'right', width: 70 },
  { label: '지수',   align: 'right',  width: 70 },
];

function THead() {
  return (
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        {COL_HEADS.map(({ label, align, width }) => (
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

function SkeletonRows() {
  return (
    <tbody>
      {Array.from({ length: 8 }, (_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
          <td style={{ padding: '10px' }}><Skeleton w={22} h={22} /></td>
          <td style={{ padding: '10px' }}><Skeleton w={72} /></td>
          <td style={{ padding: '10px' }}><Skeleton w={`${70 + (i % 3) * 10}%`} /></td>
          <td style={{ padding: '10px', textAlign: 'right' }}><Skeleton w={52} /></td>
          <td style={{ padding: '10px', textAlign: 'right' }}><Skeleton w={44} /></td>
          <td style={{ padding: '10px', textAlign: 'right' }}><Skeleton w={50} /></td>
        </tr>
      ))}
    </tbody>
  );
}

function DataRows({ rows, keyword }) {
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
          <td style={{
            padding: '9px 10px', fontSize: 11, color: 'var(--text-secondary)',
            maxWidth: 88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={item.author}>
            {item.author || '—'}
          </td>
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
          <td style={{
            padding: '9px 10px', fontSize: 11,
            color: 'var(--text-tertiary)', textAlign: 'right', whiteSpace: 'nowrap',
          }}>
            {item.date || '—'}
          </td>
          <td style={{
            padding: '9px 10px', fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap',
            color: item.dailyVisitors ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontWeight: item.dailyVisitors ? 600 : 400,
          }}>
            {item.dailyVisitors != null ? item.dailyVisitors.toLocaleString() : '비공개'}
          </td>
          <td style={{ padding: '9px 10px' }}>
            <IndexCell score={item.blogIndex} />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function BlogRankingTable({ baseKeyword }) {
  const [rows,    setRows]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [errMsg,  setErrMsg]  = useState(null);
  const mounted = useRef(true);
  const lastKey = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!baseKeyword || baseKeyword === lastKey.current) return;
    lastKey.current = baseKeyword;

    setRows(null);
    setErrMsg(null);
    setLoading(true);

    fetch(`/api/keywords/blog-rankings?keyword=${encodeURIComponent(baseKeyword)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`서버 오류 (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (!mounted.current) return;
        if (!Array.isArray(data) || data.length === 0) {
          setErrMsg('블로그탭 결과를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.');
        } else {
          setRows(data);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted.current) return;
        setErrMsg(`불러오기 실패: ${e.message}`);
        setLoading(false);
      });
  }, [baseKeyword]);

  // 지수 계산
  const enriched = rows?.map((item) => ({ ...item, blogIndex: calcBlogIndex(item, baseKeyword) }));

  return (
    <div>
      {/* 헤더 */}
      <p style={{ margin: '0 0 14px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        <span>블로그탭 순위</span>
        {enriched?.length ? (
          <button
            onClick={() => downloadCSV(enriched, baseKeyword)}
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
      </p>

      {/* 테이블 */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540 }}>
          <THead />
          {loading  && <SkeletonRows />}
          {enriched && <DataRows rows={enriched} keyword={baseKeyword} />}
        </table>
      </div>

      {/* 에러 */}
      {errMsg && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '12px 0', textAlign: 'center' }}>
          {errMsg}
        </div>
      )}

      {/* 안내 문구 */}
      <p style={{ fontSize: 9.5, color: 'var(--text-tertiary)', margin: '6px 0 0', lineHeight: 1.5 }}>
        확인 가능 데이터 및 자체 계산 지수 기준 &nbsp;·&nbsp;
        지수 = 순위(35) + 키워드 일치(20) + 최신성(15) + 방문자(15) + 활동성(15, 미수집)
      </p>
    </div>
  );
}
