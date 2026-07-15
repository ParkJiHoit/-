import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

import keywordOverview from '../assets/showcase/keyword-overview.png';
import keywordCluster from '../assets/showcase/keyword-cluster.png';
import blogStructure from '../assets/showcase/blog-structure.png';
import blogAudit from '../assets/showcase/blog-audit.png';
import rankOverview from '../assets/showcase/rank-overview.png';
import rankTable from '../assets/showcase/rank-table.png';

const CONTENT = {
  analysis: {
    slides: [
      {
        eyebrow: '검색량 & 효율 인사이트',
        heading: '검색량부터 효율 점수까지,\n숫자로 보는 키워드',
        description: 'PC·모바일 검색량을 분리해서 보여주고, 모바일 비중과 평균 CTR, 효율 점수까지 핵심 지표를 한눈에 확인할 수 있어요.',
        bullets: ['PC/모바일 검색량 분리 표시', '모바일 비중 · 평균 CTR', '발굴 가치를 보여주는 효율 점수'],
        image: keywordOverview,
      },
      {
        eyebrow: '의도 분류 & 필터링',
        heading: '의도 자동 분류부터\n정렬·필터·엑셀까지',
        description: '연관 키워드를 자동으로 확장하고, 정보 탐색·비용/수익 등 검색 의도를 자동 분류해요. 경쟁도·포화도로 비교하고 원하는 조건으로 필터링한 뒤 엑셀로 내려받을 수 있어요.',
        bullets: ['연관 키워드 자동 확장 + 의도 분류', '경쟁도 · 포화도 비교', '필터/정렬 후 엑셀 다운로드'],
        image: keywordCluster,
      },
    ],
  },
  blog: {
    slides: [
      {
        eyebrow: '블로그 구조 분석',
        heading: '상위 10개 포스팅은\n어떻게 썼을까',
        description: '블로그탭 상위 10개 포스팅의 제목 키워드 포함률, 발행 최신성, 작성자 다양성을 분석해 어떤 콘텐츠가 상위에 노출되는지 알려드려요.',
        bullets: ['상위 10개 포스팅 벤치마킹', '제목 키워드 위치 분포', '발행 최신성 · 작성자 다양성'],
        image: blogStructure,
      },
      {
        eyebrow: '블로그 진단',
        heading: '내 블로그는 지금\n몇 등급일까',
        description: '블로그 URL 하나만 입력하면 활동성·상위노출 이력·영향력·신뢰도·연차 5개 항목을 평가해 S~D 등급과 핵심 지표를 보여드려요.',
        bullets: ['5개 항목 종합 평가 → S~D 등급', '포스팅 주기 · 상위 노출률', '방문자 · 이웃 수 등 핵심 지표'],
        image: blogAudit,
      },
    ],
  },
  'rank-tracker': {
    slides: [
      {
        eyebrow: '추적 현황 한눈에',
        heading: '내 블로그,\n오늘은 몇 위일까',
        description: '추적 중인 키워드와 링크 수, 5위 이내 노출 현황, 통합검색 노출 현황을 한눈에 확인해요. 그룹으로 나눠 관리하고, CSV 대량 등록과 일괄 새로고침도 지원해요.',
        bullets: ['5위 이내 노출 · 통합검색 노출 현황', '그룹별 관리', 'CSV 대량 등록 · 일괄 새로고침'],
        image: rankOverview,
      },
      {
        eyebrow: '즐겨찾기 & 자동 알림',
        heading: '핵심 키워드는\n놓치지 않게',
        description: '중요한 키워드는 즐겨찾기로 상단에 고정하고, 순위·조회실패·미노출 상태를 색상으로 바로 구분할 수 있어요. 순위가 바뀌면 Slack으로 알림도 받아보세요.',
        bullets: ['즐겨찾기 상단 고정', '순위 상태를 색상으로 구분', '순위 변동 시 Slack 자동 알림'],
        image: rankTable,
      },
    ],
  },
};

function ScreenshotFrame({ src, alt }) {
  return (
    <div className="feature-showcase-frame">
      <div className="feature-showcase-frame-bar">
        <span className="feature-showcase-frame-dot" style={{ background: '#FF5F57' }} />
        <span className="feature-showcase-frame-dot" style={{ background: '#FEBC2E' }} />
        <span className="feature-showcase-frame-dot" style={{ background: '#28C840' }} />
      </div>
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}

const GLOW_COLORS = ['#0A84FF', '#BF5AF2', '#30D158'];

function Slide({ slide, reverse, active, slideRef, index, glowIndex }) {
  const glowColor = GLOW_COLORS[glowIndex % GLOW_COLORS.length];
  return (
    <div className="feature-showcase-slide" ref={slideRef} data-slide-index={index}>
      <div className={`feature-showcase-slide-inner${reverse ? ' reverse' : ''}`}>
        <motion.div
          className="feature-showcase-media"
          initial={{ opacity: 0, x: reverse ? 48 : -48, scale: 0.96 }}
          animate={active ? { opacity: 1, x: 0, scale: 1 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="feature-showcase-glow"
            style={{ background: glowColor, [reverse ? 'right' : 'left']: '-8%', top: '10%' }}
            animate={{ y: [0, -18, 0], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
          <ScreenshotFrame src={slide.image} alt={slide.heading} />
        </motion.div>
        <motion.div
          className="feature-showcase-copy"
          initial={{ opacity: 0, x: reverse ? -32 : 32 }}
          animate={active ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="feature-showcase-eyebrow">{slide.eyebrow}</p>
          <h3 className="feature-showcase-heading" style={{ whiteSpace: 'pre-line' }}>{slide.heading}</h3>
          <p className="feature-showcase-desc">{slide.description}</p>
          <ul className="feature-showcase-bullets">
            {slide.bullets.map((b) => (
              <li key={b}><Check size={17} strokeWidth={2.5} />{b}</li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}

export default function FeatureShowcaseSection({ tab }) {
  const content = CONTENT[tab];
  const containerRef = useRef(null);
  const scrollerRef = useRef(null);
  const slideRefs = useRef([]);
  const visibleSlides = useRef(new Set());
  // -1로 시작해야 한다 — 0으로 시작하면 첫 번째 슬라이드는 "activeIndex >= 0"이
  // 마운트 시점부터 이미 참이 되어, 실제로 화면에 스크롤되어 들어오기도 전에
  // (아직 히어로 화면에 있을 때) 등장 애니메이션이 먼저 끝나버려서 정작 사용자가
  // 스크롤해서 보게 될 때는 이미 정적인 최종 상태만 보이는 문제가 있었다.
  const [activeIndex, setActiveIndex] = useState(-1);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    visibleSlides.current = new Set();
    // 슬라이드들이 이제 히어로와 같은 전역(html) 스크롤 스냅 시퀀스에 속하기 때문에,
    // 별도의 스크롤 컨테이너가 아니라 뷰포트 자체를 기준으로 관찰한다. 진행 점은
    // "지금 화면에 절반 이상 걸쳐 있는 슬라이드가 하나라도 있는가"를 Set으로 누적
    // 추적해서 판단한다 — 관찰자 콜백은 한 번에 바뀐 엔트리만 주기 때문에, 매번
    // 전체 슬라이드 목록을 다시 훑지 않고도 정확한 현재 상태를 유지할 수 있다.
    const slideObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.dataset.slideIndex);
          const visible = entry.isIntersecting && entry.intersectionRatio > 0.5;
          if (visible) {
            visibleSlides.current.add(idx);
            setActiveIndex(idx);
          } else {
            visibleSlides.current.delete(idx);
          }
        });
        setInView(visibleSlides.current.size > 0);
      },
      { root: null, threshold: [0.5] }
    );
    slideRefs.current.forEach((el) => el && slideObserver.observe(el));

    return () => slideObserver.disconnect();
  }, [tab]);

  if (!content) return null;

  const totalSlides = content.slides.length;

  return (
    <div className="feature-showcase" ref={containerRef}>
      <div className="feature-showcase-scroller" ref={scrollerRef}>
        {content.slides.map((slide, i) => (
          <Slide
            key={slide.eyebrow}
            slide={slide}
            reverse={i % 2 === 1}
            active={activeIndex >= i}
            index={i}
            glowIndex={i}
            slideRef={(el) => (slideRefs.current[i] = el)}
          />
        ))}
      </div>

      {inView && (
        <div className="feature-showcase-progress">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <span key={i} className={`feature-showcase-progress-dot${i === activeIndex ? ' active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}
