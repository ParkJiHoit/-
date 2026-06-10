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
        <article className="mac-card px-4 py-4" key={key}>
          <div className="flex items-start justify-between gap-2">
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
              {label}
            </span>
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-primary)', marginTop: 10 }}>
            {summary?.[key] ?? 0}
          </p>
        </article>
      ))}
    </section>
  );
}
