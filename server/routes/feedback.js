import { Router } from 'express';

const router = Router();

router.post('/', async (req, res) => {
  const { type, content, email } = req.body || {};
  if (!type || !content?.trim()) {
    return res.status(400).json({ message: '내용을 입력해주세요.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: '이메일 설정이 없습니다.' });
  }

  const typeLabel = type === 'bug' ? '🐛 버그 신고' : '💡 기능 제안';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'qkrwlgh52660724@gmail.com',
        subject: `[Ranklet 피드백] ${typeLabel}`,
        text: `유형: ${typeLabel}\n보낸 사람: ${email || '비로그인'}\n\n${content}`,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('[feedback] Resend 오류:', err);
      return res.status(500).json({ message: '전송에 실패했습니다.' });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[feedback] 오류:', e.message);
    res.status(500).json({ message: '전송 중 오류가 발생했습니다.' });
  }
});

export default router;
