import { useEffect, useState } from 'react';
import { Target, Link2, Trophy, Radio, TrendingUp, TrendingDown, Search as SearchIcon, FileText, ArrowRight } from 'lucide-react';
import { supabase } from '../supabase';

const API = (path) => `/api/rank-tracker${path}`;

const HISTORY_TYPE_META = {
  keyword: { label: '키워드 분석', icon: SearchIcon, color: '#0A84FF' },
  blog: { label: '블로그 분석', icon: FileText, color: '#30D158' },
};

const CHANGE_META = {
  rank_in:      { icon: TrendingUp,   color: '#30D158', label: (c) => `${c.rank}위로 5위 안 진입` },
  rank_out:     { icon: TrendingDown, color: '#FF453A', label: () => '5위 밖으로 이탈' },
  integrated_in:  { icon: Radio, color: '#0A84FF', label: () => '통합검색 노출 시작' },
  integrated_out: { icon: Radio, color: 'var(--text-tertiary)', label: () => '통합검색 노출 종료' },
};

function StatCard({ label, value, total, color, icon: Icon }) {
  const pct = total ? Math.round((value / total) * 100) : null;
  return (
    <article className="mac-card" style={{
      padding: '20px 22px', minHeight: 130,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12,
      background: `radial-gradient(ellipse at top left, ${color}14 0%, transparent 60%)`,
      borderTop: `1px solid ${color}30`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: color + '18', border: `1px solid ${color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
        {total != null && <span style={{ fontSize: 15, color: 'var(--text-tertiary)', fontWeight: 600 }}>/{total}</span>}
        {pct !== null && <span style={{ fontSize: 14, color, fontWeight: 700, marginLeft: 8 }}>{pct}%</span>}
      </p>
    </article>
  );
}

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(isoString).toISOString().slice(0, 10);
}

export default function DashboardPage({ user, token, onLoginRequest, onGoToService }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!user || !token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(API('/dashboard-summary'), { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        if (res.status === 403 && body.premiumOnly) { if (!cancelled) setPremiumOnly(true); return; }
        if (!res.ok) throw new Error(body.message || '불러오지 못했습니다.');
        if (!cancelled) setSummary(body);
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();

    supabase.from('search_history')
      .select('id, type, keyword, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { if (!cancelled) setHistory(data || []); });

    return () => { cancelled = true; };
  }, [user, token]);

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 18 }}>
        <div style={{ fontSize: 48, opacity: 0.25 }}>🏠</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>로그인 후 이용할 수 있습니다</div>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.8, margin: 0 }}>
          순위 변동과 최근 검색 기록을 한눈에 확인해보세요
        </p>
        <button
          onClick={onLoginRequest}
          style={{
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: 'var(--accent)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          로그인하기
        </button>
      </div>
    );
  }

  if (premiumOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, gap: 18 }}>
        <div style={{ fontSize: 48, opacity: 0.25 }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>프리미엄 전용 기능입니다</div>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.8, margin: 0 }}>
          대시보드는 순위 추적 데이터를 기반으로 하는 프리미엄 플랜 전용 기능이에요.
        </p>
        <button
          onClick={() => onGoToService('pricing')}
          style={{
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg,#0A84FF,#34C1FF)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(10,132,255,0.4)',
          }}
        >
          프리미엄 알아보기
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: '0 0 4px' }}>
          안녕하세요{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}님` : ''} 👋
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>
          지금까지의 순위 추적 현황과 최근 활동을 모아봤어요.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#FF453A', fontSize: 13 }}>{error}</div>
      ) : summary && summary.totalKeywords === 0 ? (
        <div className="mac-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.8 }}>
            아직 추적 중인 키워드가 없어요.<br />순위 추적을 등록하면 여기서 변동을 한눈에 볼 수 있어요.
          </p>
          <button
            onClick={() => onGoToService('rank-tracker')}
            className="mac-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            순위 추적 시작하기 <ArrowRight size={14} />
          </button>
        </div>
      ) : summary && (
        <div className="mac-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section className="mac-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <StatCard label="추적 키워드" value={summary.totalKeywords} total={null} color="#8E8E93" icon={Target} />
            <StatCard label="추적 링크" value={summary.totalLinks} total={null} color="#0A84FF" icon={Link2} />
            <StatCard label="5위 내 노출" value={summary.top5LinkCount} total={summary.totalLinks} color="#30D158" icon={Trophy} />
            <StatCard label="통검 노출 중" value={summary.integratedCount} total={summary.totalLinks} color="#5E5CE6" icon={Radio} />
          </section>

          <section className="mac-card" style={{ padding: '20px 22px' }}>
            <div
              onClick={() => onGoToService('rank-tracker')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 14 }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>최근 변동</h2>
              <ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            {summary.recentChanges.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0, padding: '12px 0' }}>
                가장 최근 갱신에서 감지된 순위 변동이 없어요.
              </p>
            ) : (
              <div className="mac-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {summary.recentChanges.map((c, i) => {
                  const meta = CHANGE_META[c.kind];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: i < summary.recentChanges.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={14} style={{ color: meta.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.keyword}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                          {c.blogId} · {meta.label(c)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <section className="mac-card mac-fade-in" style={{ padding: '20px 22px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>최근 검색</h2>
        {history.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0, padding: '4px 0' }}>
            최근 검색 기록이 없습니다.
          </p>
        ) : (
          <div className="mac-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {history.map((item, i) => {
              const meta = HISTORY_TYPE_META[item.type] || HISTORY_TYPE_META.keyword;
              const Icon = meta.icon;
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={14} style={{ color: meta.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.keyword}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {meta.label} · {timeAgo(item.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
