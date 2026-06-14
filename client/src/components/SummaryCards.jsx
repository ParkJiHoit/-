import { Lightbulb, ShieldAlert, Target, Trophy } from 'lucide-react';

const CARDS = [
  { key: 'totalKeywords',    label: '전체 키워드',  icon: Target      },
  { key: 'priorityCount',    label: '우선 테스트',  icon: Trophy      },
  { key: 'opportunityCount', label: '기회 키워드',  icon: Lightbulb   },
  { key: 'saturatedCount',   label: '과포화 주의',  icon: ShieldAlert },
];

export default function SummaryCards({ summary }) {
  return (
    <section className="mac-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon }) => (
        <article className="mac-card" style={{ padding: '12px 16px' }} key={key}>
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', lineHeight: 1 }}>
              {label}
            </span>
            <Icon style={{ width: 12, height: 12, color: 'var(--text-tertiary)', flexShrink: 0 }} />
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)', margin: 0 }}>
            {summary?.[key] ?? 0}
          </p>
        </article>
      ))}
    </section>
  );
}
