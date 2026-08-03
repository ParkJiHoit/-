import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Radio, Search, ArrowUp, ArrowRight, Sparkles, ChevronDown } from 'lucide-react';
import TrackerStatCards from '../components/rankTracker/TrackerStatCards';
import ExposureDonutCard from '../components/rankTracker/ExposureDonutCard';
import { formatRankStatus } from '../components/rankTracker/trackerFormat';
import { cardEntranceVariants } from '../utils/motionVariants';
import logoLight from '../assets/logo-light.png';
import logoDark from '../assets/logo-dark.png';

// 사이트 전체에서 쓰는 뱃지 팔레트(client/src/styles.css의 .mac-badge-*)를 그대로
// 재사용한다 — 리포트 페이지만을 위한 새 색상 체계를 만들지 않는다.
function rankBadgeClass(status, rank) {
  if (status === 'fetch_failed') return 'mac-badge mac-badge-orange';
  if (status === 'ranked' && rank != null) return rank <= 3 ? 'mac-badge mac-badge-green' : 'mac-badge mac-badge-orange';
  return 'mac-badge mac-badge-gray';
}

function earliestAddedDate(item) {
  const dates = Object.values(item.latestRanks || {}).map(r => r.addedDate).filter(Boolean);
  return dates.length ? dates.sort().at(-1) : null; // 링크 여러 개면 "가장 최근에 추가된 링크" 기준으로 정렬
}

// 검색량·CTR을 "검색량 1,200 · CTR 2.3%" 형태의 부가 정보 한 줄로 합친다.
// 둘 다 없으면 아예 표시하지 않는다(등록 전 이 기능이 없던 옛 키워드는 값이 없을 수 있음).
function formatVolumeCtr(searchVolume, averageCtr) {
  const parts = [];
  if (searchVolume != null) parts.push(`검색량 ${searchVolume.toLocaleString()}`);
  if (averageCtr != null) parts.push(`CTR ${averageCtr}%`);
  return parts.join(' · ');
}

// 링크가 여러 개인 키워드는 변동사항 목록에 같은 키워드가 여러 줄로 반복된다
// (블로그 링크 단위 변동이라서). id(트래킹 항목)로 묶어서 한 줄 + 배지 여러 개로
// 보여준다 — 텍스트가 같다고 묶으면 "전체 그룹" 공유에서 다른 그룹의 동일
// 키워드까지 잘못 합쳐질 수 있어 반드시 id로 묶는다.
function groupChangesById(list) {
  const order = [];
  const byId = new Map();
  for (const c of list) {
    if (!byId.has(c.id)) { byId.set(c.id, []); order.push(c.id); }
    byId.get(c.id).push(c);
  }
  return order.map(id => byId.get(id));
}

// 통합검색 노출 변동사항은 링크마다 "미노출 → 노출" 또는 "노출 → 미노출" 둘 중
// 하나뿐이라, 링크 수만큼 같은 칩을 반복하면 지저분해진다. 같은 타입끼리는
// 칩 하나로 합치고 "×N"으로 개수만 표시한다.
function summarizeByType(group) {
  const order = [];
  const counts = new Map();
  for (const c of group) {
    if (!counts.has(c.type)) { counts.set(c.type, 0); order.push(c.type); }
    counts.set(c.type, counts.get(c.type) + 1);
  }
  return order.map(type => ({ type, count: counts.get(type) }));
}

export default function SharedReportPage({ token }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(''); // '' = 전체
  const [searchQuery, setSearchQuery] = useState('');
  const [tableOpen, setTableOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public-reports/${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || '리포트를 불러오지 못했습니다.');
        if (!cancelled) setReport(body);
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const filteredItems = useMemo(() => {
    if (!report) return [];
    const scoped = !selectedGroupId
      ? report.items
      : report.items.filter(i => String(i.group_id ?? '') === selectedGroupId);
    const q = searchQuery.trim().toLowerCase();
    const searched = q ? scoped.filter(i => i.keyword.toLowerCase().includes(q)) : scoped;
    return [...searched].sort((a, b) => {
      const ad = earliestAddedDate(a) || '';
      const bd = earliestAddedDate(b) || '';
      return bd.localeCompare(ad); // 최신이 위로
    });
  }, [report, selectedGroupId, searchQuery]);

  // 변동사항은 keyword 텍스트가 아니라 트래킹 항목 id로 범위를 맞춘다 — "전체 그룹"
  // 공유에서는 서로 다른 그룹에 같은 키워드가 존재할 수 있어 텍스트 매칭은 부정확하다.
  const idsInScope = useMemo(() => new Set(filteredItems.map(i => i.id)), [filteredItems]);

  const filteredChanges = useMemo(() => {
    if (!report) return [];
    return report.changes.filter(c => idsInScope.has(c.id));
  }, [report, idsInScope]);

  const filteredIntegratedChanges = useMemo(() => {
    if (!report) return [];
    return (report.integratedChanges || []).filter(c => idsInScope.has(c.id));
  }, [report, idsInScope]);

  const searchVolumeById = useMemo(() => new Map(filteredItems.map(i => [i.id, i.searchVolume])), [filteredItems]);
  const averageCtrById = useMemo(() => new Map(filteredItems.map(i => [i.id, i.averageCtr])), [filteredItems]);

  // 두 변동사항 목록 모두 구간으로 나누지 않고 한 목록으로 세로 나열하되, 검색량
  // 높은 키워드부터 내림차순으로 정렬해 중요한 것이 위로 오게 한다.
  const sortedChanges = useMemo(() => {
    return [...filteredChanges].sort(
      (a, b) => (searchVolumeById.get(b.id) ?? 0) - (searchVolumeById.get(a.id) ?? 0)
    );
  }, [filteredChanges, searchVolumeById]);

  const sortedIntegratedChanges = useMemo(() => {
    return [...filteredIntegratedChanges].sort(
      (a, b) => (searchVolumeById.get(b.id) ?? 0) - (searchVolumeById.get(a.id) ?? 0)
    );
  }, [filteredIntegratedChanges, searchVolumeById]);

  // 아래 변동사항 카드들을 다시 훑지 않아도 성과가 한눈에 들어오도록, 카드 위에
  // 큼직한 숫자 요약(헤드라인)을 따로 뽑아둔다.
  const changeHeadline = useMemo(() => {
    const newTop5Count = filteredChanges.filter(c => c.type === 'new_top5').length;
    const improvedCount = filteredChanges.length - newTop5Count;
    const gainedCount = filteredIntegratedChanges.filter(c => c.type === 'gained').length;
    return { newTop5Count, improvedCount, gainedCount };
  }, [filteredChanges, filteredIntegratedChanges]);

  // KPI 카드의 "추적 키워드" 자리를 대신할 노출 현황 도넛. all 모드(전체 순위
  // 스냅샷)는 "우리가 관리하는 링크"라는 개념이 없어 이 요약을 건너뛴다.
  const exposureSummary = useMemo(() => {
    if (!filteredItems.length || filteredItems[0]?.mode !== 'blog') return null;
    let top3 = 0, midTier = 0, notExposed = 0, fetchFailed = 0;
    for (const item of filteredItems) {
      if (item.mode !== 'blog') continue;
      for (const blogId of item.blog_ids || []) {
        const entry = item.latestRanks?.[blogId];
        if (!entry) { notExposed++; continue; }
        if (entry.status === 'fetch_failed') fetchFailed++;
        else if (entry.status === 'ranked' && entry.rank != null && entry.rank <= 3) top3++;
        else if (entry.status === 'ranked') midTier++;
        else notExposed++;
      }
    }
    const total = top3 + midTier + notExposed + fetchFailed;
    if (!total) return null;
    return {
      total,
      segments: [
        { key: 'top3', label: '상위 3위', color: '#30D158', value: top3 },
        { key: 'mid', label: '4~5위', color: '#FF9F0A', value: midTier },
        { key: 'none', label: '미노출', color: '#8E8E93', value: notExposed },
        { key: 'failed', label: '조회 실패', color: '#FF453A', value: fetchFailed },
      ],
    };
  }, [filteredItems]);

  // 검색 중일 때는 표를 찾아볼 이유가 생긴 것이므로 접힘 상태와 무관하게 펼쳐서 보여준다.
  const tableExpanded = tableOpen || !!searchQuery.trim();

  const mode = filteredItems[0]?.mode || 'blog';
  const showGroupSwitcher = !!report && report.groups.length > 0;
  const headerTitle = selectedGroupId
    ? report?.groups.find(g => String(g.id) === selectedGroupId)?.name
    : (report?.groupName || '전체 그룹');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={logoDark} alt="RANKLET" style={{ height: 22, width: 'auto' }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>순위 추적 공유 리포트</span>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <div style={{ fontSize: 40, opacity: 0.25, marginBottom: 12 }}>🔒</div>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0 }}>{error}</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>{headerTitle}</h1>
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                  추적 키워드 {filteredItems.length}개 · 최근 14일 이내 등록된 링크만 표시 · 읽기 전용 공유 리포트
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="키워드 검색"
                    style={{
                      height: 34, width: 160, padding: '0 10px 0 30px', borderRadius: 8,
                      background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
                      color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
                {showGroupSwitcher && (
                  <select
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                    style={{
                      height: 34, padding: '0 10px', borderRadius: 8,
                      background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
                      color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="">전체 그룹</option>
                    {report.groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div style={{ margin: '20px 0' }}>
              <TrackerStatCards
                mode={mode}
                filteredItems={filteredItems}
                compact
                donutSlot={exposureSummary && (
                  <ExposureDonutCard total={exposureSummary.total} segments={exposureSummary.segments} compact index={0} />
                )}
              />
            </div>

            {filteredItems.length > 0 && (
              <>
                <motion.div
                  className="mac-card"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '18px 24px', margin: '0 0 12px' }}
                  custom={3} variants={cardEntranceVariants} initial="hidden" animate="show"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(48,209,88,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ArrowUp size={17} style={{ color: '#30D158' }} />
                    </span>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{changeHeadline.improvedCount}건</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>순위 상승</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,159,10,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Sparkles size={17} style={{ color: '#FF9F0A' }} />
                    </span>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{changeHeadline.newTop5Count}건</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>신규 TOP5 진입</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(94,92,230,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Radio size={17} style={{ color: '#5E5CE6' }} />
                    </span>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{changeHeadline.gainedCount}건</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>통합검색 노출 시작</div>
                    </div>
                  </div>
                </motion.div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: 12, margin: '0 0 20px', alignItems: 'stretch',
              }}>
                <motion.div
                  className="mac-card" style={{ padding: '22px 26px' }}
                  custom={4} variants={cardEntranceVariants} initial="hidden" animate="show"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    <TrendingUp size={18} style={{ color: '#30D158' }} />
                    순위 변동사항
                  </div>
                  {sortedChanges.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>변동 없음</p>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {groupChangesById(sortedChanges).map((group, i) => {
                        const volumeCtr = formatVolumeCtr(searchVolumeById.get(group[0].id), averageCtrById.get(group[0].id));
                        return (
                          <li key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {group[0].keyword}
                                {group.length > 1 && (
                                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 700 }}>×{group.length}</span>
                                )}
                              </span>
                              {volumeCtr && (
                                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                                  {volumeCtr}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {group.map((c, j) => (
                                <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                                    {c.type === 'new_top5' ? '미노출' : `${c.fromRank}위`}
                                  </span>
                                  <ArrowRight size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#30D158' }}>{c.toRank}위</span>
                                </span>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </motion.div>

                <motion.div
                  className="mac-card" style={{ padding: '22px 26px' }}
                  custom={5} variants={cardEntranceVariants} initial="hidden" animate="show"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    <Radio size={18} style={{ color: '#5E5CE6' }} />
                    통합검색 노출 변동사항
                  </div>
                  {sortedIntegratedChanges.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>변동 없음</p>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {groupChangesById(sortedIntegratedChanges).map((group, i) => {
                        const volumeCtr = formatVolumeCtr(searchVolumeById.get(group[0].id), averageCtrById.get(group[0].id));
                        return (
                          <li key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {group[0].keyword}
                              </span>
                              {volumeCtr && (
                                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                                  {volumeCtr}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {summarizeByType(group).map(({ type, count }) => (
                                <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                                    {type === 'gained' ? '미노출' : '노출'}
                                  </span>
                                  <ArrowRight size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: type === 'gained' ? '#30D158' : '#FF453A' }}>
                                    {type === 'gained' ? '노출' : '미노출'}{count > 1 && ` ×${count}`}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </motion.div>
              </div>
              </>
            )}

            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 13 }}>
                {searchQuery.trim()
                  ? '검색 결과가 없습니다.'
                  : '최근 14일 이내 등록된 추적 항목이 없습니다.'}
              </div>
            ) : (
              <motion.div custom={6} variants={cardEntranceVariants} initial="hidden" animate="show">
                <button
                  onClick={() => setTableOpen(v => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '10px 14px', background: 'var(--bg-overlay)', border: '1px solid var(--border)',
                    borderRadius: tableExpanded ? '10px 10px 0 0' : 10,
                    color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  <ChevronDown size={14} style={{ transform: tableExpanded ? 'none' : 'rotate(-90deg)' }} />
                  상세 데이터 보기 ({filteredItems.length}개)
                </button>
                {tableExpanded && (
                <div style={{ borderRadius: '0 0 10px 10px', border: '1px solid var(--border)', borderTop: 'none', overflow: 'hidden' }}>
                <table className="mac-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '10%' }}>등록일</th>
                      <th style={{ width: '22%' }}>키워드</th>
                      <th style={{ width: '28%' }}>블로그</th>
                      <th style={{ width: '12%' }}>검색량</th>
                      <th style={{ width: '12%' }}>순위</th>
                      <th style={{ width: '16%' }}>통검</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.flatMap((item, idx) => {
                      const blogIds = item.mode === 'blog' ? (item.blog_ids || []) : [];
                      const rows = blogIds.length ? blogIds : [null];
                      return rows.map((blogId, i) => {
                        const entry = blogId ? item.latestRanks?.[blogId] : null;
                        const { label } = formatRankStatus(entry?.rank ?? null, entry?.status ?? null);
                        return (
                          <tr key={`${idx}-${blogId ?? 'x'}-${i}`} style={{ borderTop: i === 0 ? '2px solid var(--border-strong)' : undefined }}>
                            <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{i === 0 ? (entry?.addedDate || '—') : ''}</td>
                            <td style={{ fontWeight: i === 0 ? 700 : 400, color: i === 0 ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                              {i === 0 ? item.keyword : '↳'}
                            </td>
                            <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blogId || '—'}</td>
                            <td>{i === 0 ? (item.searchVolume ?? '—') : ''}</td>
                            <td>{blogId ? <span className={rankBadgeClass(entry?.status ?? null, entry?.rank ?? null)}>{label}</span> : '—'}</td>
                            <td style={{ color: entry?.integratedExposed ? '#0A84FF' : 'var(--text-tertiary)', fontWeight: 700 }}>
                              {entry?.integratedExposed == null ? '—' : (entry.integratedExposed ? 'O' : 'X')}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
                </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
