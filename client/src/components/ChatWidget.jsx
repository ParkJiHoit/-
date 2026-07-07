import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Send, RotateCcw, Mail } from 'lucide-react';

const GREETING = '안녕하세요! 궁금하신 점을 물어보세요.\n자주 묻는 질문에 답변해 드려요.';

const SUGGESTED_QUESTIONS = [
  '키워드 분석하면 검색량도 나오나요?',
  '블로그 구조 분석이 궁금해요',
  '블로그 진단 등급이 궁금해요',
  '순위 추적 모드 차이가 궁금해요',
  '대량 등록이랑 일괄 등록이 궁금해요',
];

const PLACEHOLDER_HINTS = [
  '궁금한 점을 입력하세요',
  '예: 순위 갱신은 하루에 몇 번 가능해요?',
  '예: 대량 등록은 어떻게 하나요?',
  '예: 블로그 진단 등급은 어떻게 매겨져요?',
];

const CONTACT_QUESTION = '제작자한테 직접 물어보고 싶어요';
const CONTACT_EMAIL = 'qkrwlgh52660724@gmail.com';

const COLLAPSED_WIDTH = 126;
const COLLAPSED_HEIGHT = 48;
const EXPANDED_WIDTH = 420;
const EXPANDED_HEIGHT = 600;

function initialMessages() {
  return [{ role: 'bot', text: GREETING }];
}

// 서로 다른 속도/방향으로 도는 3개의 그라디언트 레이어가 겹쳐 불규칙하게
// 일렁이는 오브 — 로고/봇 아바타로 사용.
function ColorOrb({ dimension = 24 }) {
  const blur = Math.max(dimension * 0.13, 3);

  return (
    <div
      className="chat-color-orb"
      style={{ width: dimension, height: dimension, flexShrink: 0, '--co-blur': `${blur}px` }}
    />
  );
}

export default function ChatWidget({ user, token }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user' | 'bot', text }
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_HINTS[0]);
  const listRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) setMessages(initialMessages());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // 입력창이 비어 있을 때만 타이핑 애니메이션으로 예시 질문을 순환 표시.
  useEffect(() => {
    if (input) return;
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId;

    function tick() {
      const phrase = PLACEHOLDER_HINTS[phraseIndex];
      charIndex += deleting ? -1 : 1;
      setPlaceholder(phrase.slice(0, charIndex));
      let delay = deleting ? 28 : 55;
      if (!deleting && charIndex === phrase.length) { deleting = true; delay = 1800; }
      else if (deleting && charIndex === 0) { deleting = false; phraseIndex = (phraseIndex + 1) % PLACEHOLDER_HINTS.length; delay = 300; }
      timeoutId = setTimeout(tick, delay);
    }
    timeoutId = setTimeout(tick, 1800);
    return () => clearTimeout(timeoutId);
  }, [input === '']);

  if (!user) return null; // 로그인 사용자만 노출 (게스트 접근 없음)

  async function sendMessage(text) {
    if (!text || sending) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setSending(true);
    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '메시지 전송에 실패했습니다.');
      setMessages(prev => [...prev, { role: 'bot', text: data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: err.message || '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' }]);
    } finally {
      setSending(false);
    }
  }

  function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    sendMessage(text);
  }

  function handleReset() {
    setMessages(initialMessages());
    setInput('');
  }

  function handleContactClick() {
    setMessages(prev => [
      ...prev,
      { role: 'user', text: CONTACT_QUESTION },
      { role: 'bot', text: `직접 연락하고 싶으시면 아래 이메일로 남겨주세요.\n${CONTACT_EMAIL}` },
    ]);
  }

  return (
    <>
      <style>{`
        @property --co-angle-a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
        @property --co-angle-b { syntax: '<angle>'; inherits: false; initial-value: 120deg; }
        @property --co-angle-c { syntax: '<angle>'; inherits: false; initial-value: 250deg; }
        .chat-color-orb {
          position: relative; display: block; border-radius: 50%; overflow: hidden;
        }
        .chat-color-orb::before {
          content: ''; position: absolute; inset: -20%; border-radius: 50%;
          background:
            conic-gradient(from var(--co-angle-a) at 30% 70%, #40C8FF, transparent 30% 70%, #40C8FF),
            conic-gradient(from var(--co-angle-b) at 75% 30%, #A64BFF, transparent 35% 65%, #A64BFF),
            conic-gradient(from var(--co-angle-c) at 25% 20%, #0A84FF, transparent 25% 75%, #0A84FF);
          filter: blur(var(--co-blur)) saturate(1.8) contrast(1.3);
          animation: coSpinA 6s linear infinite, coSpinB 9.5s linear infinite reverse, coSpinC 4.5s linear infinite;
        }
        @keyframes coSpinA { to { --co-angle-a: 360deg; } }
        @keyframes coSpinB { to { --co-angle-b: 480deg; } }
        @keyframes coSpinC { to { --co-angle-c: 610deg; } }
        @media (prefers-reduced-motion: reduce) { .chat-color-orb::before { animation: none; } }

        @keyframes chatBubbleInUser {
          from { opacity: 0; transform: translateX(14px) scale(0.94); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes chatBubbleInBot {
          from { opacity: 0; transform: translateX(-14px) scale(0.94); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes chatChipIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatDotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%           { transform: translateY(-5px); opacity: 1; }
        }
        .chat-dock-btn { transition: transform 0.18s ease; }
        .chat-dock-btn:hover { transform: scale(1.03); }
        .chat-dock-btn:active { transform: scale(0.97); }
        .chat-send-btn { transition: transform 0.15s ease; }
        .chat-send-btn:hover:not(:disabled) { transform: scale(1.06); }
        .chat-send-btn:active:not(:disabled) { transform: scale(0.94); }
        .chat-icon-btn { transition: transform 0.2s ease, background 0.15s ease, color 0.15s ease; }
        .chat-icon-btn:hover { background: var(--bg-overlay); }
        .chat-icon-btn.reset:hover { transform: rotate(-45deg); }
        .chat-icon-btn.close:hover { transform: rotate(135deg) scale(1.12); background: rgba(255,69,58,0.14); color: #FF453A; }
        .chat-chip-btn { transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease; }
        .chat-chip-btn:hover:not(:disabled) { transform: translateY(-2px); background: var(--bg-elevated); box-shadow: 0 6px 16px rgba(0,0,0,0.18); }
        .chat-input::placeholder { color: var(--text-tertiary); opacity: 0.85; }
        .chat-typing-dot {
          width: 6px; height: 6px; border-radius: 999px; background: var(--text-tertiary);
          animation: chatDotBounce 1.1s ease-in-out infinite;
        }
      `}</style>

      <motion.div
        animate={{
          width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          height: open ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
          borderRadius: open ? 22 : 999,
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
          maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: open ? 'var(--bg-elevated)' : 'color-mix(in srgb, var(--bg-elevated) 55%, transparent)',
          backdropFilter: open ? 'none' : 'blur(20px)',
          WebkitBackdropFilter: open ? 'none' : 'blur(20px)',
          border: open ? '1px solid var(--border-strong)' : '1px solid color-mix(in srgb, var(--border-strong) 35%, transparent)',
          boxShadow: open ? '0 32px 80px rgba(0,0,0,0.55)' : '0 6px 20px rgba(10,132,255,0.14), 0 2px 8px rgba(0,0,0,0.14)',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {!open ? (
            <motion.button
              key="collapsed"
              type="button"
              onClick={() => setOpen(true)}
              aria-label="고객센터 챗봇 열기"
              className="chat-dock-btn"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                width: '100%', height: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 16px',
              }}
            >
              <ColorOrb dimension={18} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>AI 챗봇</span>
            </motion.button>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15, delay: open ? 0.08 : 0 }}
              style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 18px', borderBottom: '1px solid var(--border)',
                background: 'linear-gradient(135deg, rgba(10,132,255,0.14), rgba(52,193,255,0.05))',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ColorOrb dimension={30} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)' }}>AI 챗봇</span>
                      <span style={{
                        fontSize: 9.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap',
                        padding: '2px 7px', borderRadius: 999, background: 'var(--bg-overlay)',
                      }}>규칙 기반 FAQ · AI 연동 예정</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>이용 방법을 물어보세요</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    onClick={handleReset}
                    aria-label="처음으로"
                    title="처음으로"
                    className="chat-icon-btn reset"
                    style={{
                      width: 32, height: 32, borderRadius: 999, cursor: 'pointer',
                      border: 'none', background: 'transparent',
                      color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="닫기"
                    title="닫기"
                    className="chat-icon-btn close"
                    style={{
                      width: 32, height: 32, borderRadius: 999, cursor: 'pointer',
                      border: 'none', background: 'transparent',
                      color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%', padding: '11px 14px', borderRadius: 16,
                    background: m.role === 'user' ? 'linear-gradient(135deg, var(--accent), #34C1FF)' : 'var(--bg-overlay)',
                    color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                    fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    boxShadow: m.role === 'user' ? '0 6px 16px rgba(10,132,255,0.3)' : 'none',
                    animation: `${m.role === 'user' ? 'chatBubbleInUser' : 'chatBubbleInBot'} 0.32s cubic-bezier(0.16, 1, 0.3, 1) both`,
                  }}>
                    {m.text}
                  </div>
                ))}
                {sending && (
                  <div style={{
                    alignSelf: 'flex-start', display: 'flex', gap: 5, padding: '12px 16px',
                    borderRadius: 16, background: 'var(--bg-overlay)',
                    animation: 'chatBubbleInBot 0.32s cubic-bezier(0.16, 1, 0.3, 1) both',
                  }}>
                    <span className="chat-typing-dot" style={{ animationDelay: '0s' }} />
                    <span className="chat-typing-dot" style={{ animationDelay: '0.15s' }} />
                    <span className="chat-typing-dot" style={{ animationDelay: '0.3s' }} />
                  </div>
                )}
              </div>

              {messages.length <= 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '0 18px 16px' }}>
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      disabled={sending}
                      className="chat-chip-btn"
                      style={{
                        maxWidth: '88%', textAlign: 'left', padding: '10px 14px', borderRadius: '4px 16px 16px 16px', cursor: 'pointer',
                        border: 'none', background: 'var(--bg-overlay)',
                        color: 'var(--text-secondary)', fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.45,
                        opacity: sending ? 0.5 : 1,
                        animation: 'chatChipIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
                        animationDelay: `${idx * 0.06}s`,
                      }}
                    >
                      {q}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleContactClick}
                    className="chat-chip-btn"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      maxWidth: '88%', textAlign: 'left', padding: '10px 14px', borderRadius: '4px 16px 16px 16px', cursor: 'pointer',
                      border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
                      background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                      color: 'var(--accent)', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', lineHeight: 1.45,
                      animation: 'chatChipIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
                      animationDelay: `${SUGGESTED_QUESTIONS.length * 0.06}s`,
                    }}
                  >
                    <Mail size={14} />
                    {CONTACT_QUESTION}
                  </button>
                </div>
              )}

              <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid var(--border)' }}>
                <input
                  value={input} onChange={e => setInput(e.target.value)}
                  placeholder={placeholder}
                  disabled={sending}
                  className="chat-input"
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 12,
                    border: '1px solid var(--border-strong)', background: 'transparent',
                    color: 'var(--text-primary)', fontSize: 14.5, fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button type="submit" disabled={sending || !input.trim()} className="chat-send-btn" style={{
                  width: 44, height: 44, borderRadius: 12, border: 'none', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), #34C1FF)', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: sending || !input.trim() ? 0.5 : 1,
                }}>
                  <Send size={18} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
