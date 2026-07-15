import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import HeroScene from './HeroScene';

import keywordOverview from '../assets/showcase/keyword-overview.png';
import keywordCluster from '../assets/showcase/keyword-cluster.png';
import blogStructure from '../assets/showcase/blog-structure.png';
import blogAudit from '../assets/showcase/blog-audit.png';
import rankOverview from '../assets/showcase/rank-overview.png';
import rankTable from '../assets/showcase/rank-table.png';

const CONTENT = {
  analysis: {
    title: '키워드 분석, 이렇게 씁니다',
    subtitle: '기준 키워드 하나로 검색량부터 의도 분류까지 한 화면에서 확인하세요',
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
    title: '블로그 분석, 이렇게 씁니다',
    subtitle: '상위 노출 포스팅 벤치마킹부터 내 블로그 등급 진단까지',
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
    title: '순위 추적, 이렇게 씁니다',
    subtitle: '등록한 키워드가 오늘 몇 위인지, 놓치지 않고 확인하세요',
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

// 첫 화면 — 탭 타이틀만 한 화면 꽉 채워서 보여주는 인트로 슬라이드
function IntroSlide({ title, subtitle, active, slideRef, index }) {
  return (
    <div className="feature-showcase-slide" ref={slideRef} data-slide-index={index}>
      <motion.div
        className="feature-showcase-intro"
        initial={{ opacity: 0, y: 24 }}
        animate={active ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="feature-showcase-eyebrow" style={{ justifyContent: 'center' }}>기능 소개</p>
        <h2 className="feature-showcase-heading" style={{ fontSize: 40 }}>{title}</h2>
        <p className="feature-showcase-desc" style={{ maxWidth: 520, margin: '0 auto', fontSize: 16 }}>{subtitle}</p>
      </motion.div>
    </div>
  );
}

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
              <li key={b}><Check size={15} strokeWidth={2.5} />{b}</li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}

export default function FeatureShowcaseSection({ tab, theme = 'dark' }) {
  const content = CONTENT[tab];
  const scrollerRef = useRef(null);
  const slideRefs = useRef([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const idx = Number(entry.target.dataset.slideIndex);
            setActiveIndex(idx);
          }
        });
      },
      { root, threshold: [0.5] }
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [tab]);

  if (!content) return null;

  // 인트로(0번) + 기능 슬라이드들을 하나의 스냅 시퀀스로 묶는다 — 화면 하나에
  // 섹션 하나만 보이도록, 히어로 다음부터 끝까지 전부 같은 스크롤 컨테이너 안에 둔다.
  const totalSlides = content.slides.length + 1;

  return (
    <div className="feature-showcase">
      <div className="feature-showcase-bg">
        {/* 순위 추적 탭은 페이지 전체에 고정 파티클 배경이 이미 깔려 있어(App.jsx) 여기서
            또 캔버스를 띄우지 않고 그 위에 자연스럽게 이어지게 둔다. */}
        {tab !== 'rank-tracker' && (
          <HeroScene dark={theme === 'dark'} showSpheres={false} particleCount={260} intensity={0.65} />
        )}
      </div>

      <div className="feature-showcase-scroller" ref={scrollerRef}>
        <IntroSlide
          title={content.title}
          subtitle={content.subtitle}
          active={activeIndex >= 0}
          index={0}
          slideRef={(el) => (slideRefs.current[0] = el)}
        />
        {content.slides.map((slide, i) => (
          <Slide
            key={slide.eyebrow}
            slide={slide}
            reverse={i % 2 === 1}
            active={activeIndex >= i + 1}
            index={i + 1}
            glowIndex={i}
            slideRef={(el) => (slideRefs.current[i + 1] = el)}
          />
        ))}
      </div>

      <div className="feature-showcase-progress">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <span key={i} className={`feature-showcase-progress-dot${i === activeIndex ? ' active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
