import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, RotateCcw, Sparkles } from 'lucide-react';

const GREETING = '안녕하세요! 궁금하신 점을 물어보세요.\n자주 묻는 질문에 답변해 드려요.';

const SUGGESTED_QUESTIONS = [
  '키워드 분석하면 검색량도 나오나요?',
  '블로그 구조 분석이 궁금해요',
  '블로그 진단 등급이 궁금해요',
  '순위 추적 모드 차이가 궁금해요',
  '대량 등록이랑 일괄 등록이 궁금해요',
];

function initialMessages() {
  return [{ role: 'bot', text: GREETING }];
}

export default function ChatWidget({ user, token }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user' | 'bot', text }
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) setMessages(initialMessages());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

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

  return (
    <>
      <style>{`
        @keyframes chatPanelIn {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
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
        .chat-fab-btn { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .chat-fab-btn:hover { transform: scale(1.07); box-shadow: 0 12px 32px rgba(10,132,255,0.55); }
        .chat-fab-btn:active { transform: scale(0.96); }
        .chat-send-btn { transition: transform 0.15s ease; }
        .chat-send-btn:hover:not(:disabled) { transform: scale(1.06); }
        .chat-send-btn:active:not(:disabled) { transform: scale(0.94); }
        .chat-reset-btn { transition: transform 0.2s ease, background 0.15s ease; }
        .chat-reset-btn:hover { background: var(--bg-overlay); transform: rotate(-45deg); }
        .chat-chip-btn { transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease; }
        .chat-chip-btn:hover:not(:disabled) { transform: translateX(3px); border-color: var(--accent); background: var(--bg-elevated); }
        .chat-typing-dot {
          width: 6px; height: 6px; border-radius: 999px; background: var(--text-tertiary);
          animation: chatDotBounce 1.1s ease-in-out infinite;
        }
      `}</style>

      <button
        onClick={() => setOpen(o => !o)}
        aria-label="고객센터 챗봇"
        className="chat-fab-btn"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
          width: 56, height: 56, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, var(--accent), #34C1FF)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 28px rgba(10,132,255,0.45)',
        }}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 24, zIndex: 1200,
          width: 420, maxWidth: 'calc(100vw - 32px)', height: 600, maxHeight: 'calc(100vh - 140px)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
          borderRadius: 22, boxShadow: '0 32px 80px rgba(0,0,0,0.55)', overflow: 'hidden',
          animation: 'chatPanelIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 18px', borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(10,132,255,0.14), rgba(52,193,255,0.05))',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent), #34C1FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={17} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)' }}>고객센터</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>이용 방법을 물어보세요</div>
              </div>
            </div>
            <button
              onClick={handleReset}
              aria-label="처음으로"
              title="처음으로"
              className="chat-reset-btn"
              style={{
                width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
                border: '1px solid var(--border-strong)', background: 'transparent',
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RotateCcw size={15} />
            </button>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 18px 16px' }}>
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  disabled={sending}
                  className="chat-chip-btn"
                  style={{
                    width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                    border: '1px solid var(--border-strong)', background: 'var(--bg-overlay)',
                    color: 'var(--text-secondary)', fontSize: 13.5, fontFamily: 'inherit',
                    opacity: sending ? 0.5 : 1,
                    animation: 'chatChipIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
                    animationDelay: `${idx * 0.06}s`,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid var(--border)' }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              placeholder="궁금한 점을 입력하세요"
              disabled={sending}
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
        </div>
      )}
    </>
  );
}
