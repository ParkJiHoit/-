import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

const GREETING = '안녕하세요! 궁금하신 점을 물어보세요.\n자주 묻는 질문에 답변해 드려요.';

const SUGGESTED_QUESTIONS = [
  '키워드 분석하면 검색량도 나오나요?',
  '블로그 구조 분석이 궁금해요',
  '블로그 진단 등급이 궁금해요',
  '순위 추적 모드 차이가 궁금해요',
  '대량 등록이랑 일괄 등록이 궁금해요',
];

export default function ChatWidget({ user, token }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user' | 'bot', text }
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) setMessages([{ role: 'bot', text: GREETING }]);
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

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="고객센터 챗봇"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
          width: 52, height: 52, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 1200,
          width: 360, maxWidth: 'calc(100vw - 32px)', maxHeight: 480,
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
          borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            고객센터
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%', padding: '8px 12px', borderRadius: 14,
                background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-overlay)',
                color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {m.text}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--text-tertiary)' }}>답변 작성 중…</div>
            )}
          </div>
          {messages.length <= 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 14px 12px' }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  disabled={sending}
                  style={{
                    padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
                    border: '1px solid var(--border-strong)', background: 'var(--bg-overlay)',
                    color: 'var(--text-secondary)', fontSize: 11.5, fontFamily: 'inherit',
                    opacity: sending ? 0.5 : 1,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              placeholder="궁금한 점을 입력하세요"
              disabled={sending}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 9,
                border: '1px solid var(--border-strong)', background: 'transparent',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button type="submit" disabled={sending || !input.trim()} style={{
              width: 38, height: 38, borderRadius: 9, border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: sending || !input.trim() ? 0.5 : 1,
            }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
