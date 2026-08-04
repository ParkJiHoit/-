import { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { X, Upload, ChevronDown } from 'lucide-react';

export default function BulkImportModal({ token, groups: trackerGroups, defaultGroupId, onClose, onImported }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null); // { groups, errors, newKeywordCount }
  const [groupId, setGroupId] = useState(defaultGroupId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleFile(file) {
    const isExcel = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (isExcel) {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        setText(XLSX.utils.sheet_to_csv(sheet));
      } else {
        setText(String(evt.target.result || ''));
      }
    };
    if (isExcel) reader.readAsBinaryString(file);
    else reader.readAsText(file);
  }

  async function handlePreview() {
    if (!text.trim()) { setError('키워드/URL 데이터를 입력하거나 파일을 업로드해 주세요.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/rank-tracker/bulk-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text, groupId: groupId ? Number(groupId) : null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '미리보기에 실패했습니다.');
      setPreview(body);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleConfirm() {
    if (!preview?.groups?.length) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/rank-tracker/bulk-import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ groups: preview.groups, groupId: groupId ? Number(groupId) : null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '등록에 실패했습니다.');
      onImported();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
        borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 640,
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>대량 등록 (CSV/엑셀)</div>
          <button onClick={onClose} className="mac-icon-btn mac-icon-btn-danger mac-icon-btn-x"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 8, margin: -8, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {!preview ? (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, marginTop: 0 }}>
              "키워드"와 "URL" 두 열로 된 CSV/엑셀 파일을 업로드하거나, 엑셀에서 복사한 내용을 아래에 붙여넣으세요.
              헤더 이름은 자유롭게(키워드/검색어, url/링크 등) 써도 자동으로 인식됩니다.
            </p>
            <label className="mac-upload-label" style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '10px 14px', borderRadius: 9, border: '1px dashed var(--border-strong)',
              color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12, width: 'fit-content',
            }}>
              <Upload size={14} />
              파일 선택 (.csv, .xlsx)
              <input
                type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
            </label>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5 }}>등록할 그룹 (선택)</label>
              <div className="mac-select-wrap">
                <select
                  value={groupId} onChange={e => setGroupId(e.target.value)}
                  className="mac-select"
                >
                  <option value="">그룹 없음</option>
                  {(trackerGroups || []).map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                </select>
                <ChevronDown size={15} className="mac-select-chevron" />
              </div>
            </div>
            <textarea
              value={text} onChange={e => setText(e.target.value)}
              placeholder={'키워드\tURL\n강남맛집\thttps://blog.naver.com/abc/111'}
              rows={10}
              className="mac-input"
              style={{ fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }}
            />
            {error && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#FF453A', fontWeight: 500 }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={onClose} className="mac-btn mac-btn-ghost">취소</button>
              <button type="button" onClick={handlePreview} disabled={loading} className="mac-btn">
                {loading ? '분석 중…' : '미리보기'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              키워드 <b style={{ color: 'var(--accent)' }}>{preview.groups.length}</b>개
              (신규 <b style={{ color: '#30D158' }}>{preview.newKeywordCount}</b>개,
              기존 갱신 {preview.groups.length - preview.newKeywordCount}개)
              · 링크 <b style={{ color: 'var(--accent)' }}>{preview.groups.reduce((sum, g) => sum + g.urls.length, 0)}</b>개
              {preview.errors.length > 0 && <> · 오류 <b style={{ color: '#FF453A' }}>{preview.errors.length}</b>건</>}
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              {preview.groups.map(g => {
                const label = g.isNew ? '[신규] ' : g.allDuplicate ? '[중복] ' : '[기존] ';
                const color = g.isNew ? '#30D158' : g.allDuplicate ? '#FF9F0A' : 'var(--text-secondary)';
                const urlDetails = g.urlDetails || g.urls.map(url => ({ url, isDuplicate: false }));
                const newUrlCount = urlDetails.filter(d => !d.isDuplicate).length;
                const dupUrlCount = urlDetails.length - newUrlCount;
                return (
                  <div key={g.keyword} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <div>
                      <span style={{ fontWeight: 700, color }}>
                        {label}{g.keyword}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>
                        URL {urlDetails.length}개
                        {newUrlCount > 0 && dupUrlCount > 0 && (
                          <> (신규 <span style={{ color: '#30D158' }}>{newUrlCount}</span> · 중복 <span style={{ color: '#FF9F0A' }}>{dupUrlCount}</span>)</>
                        )}
                      </span>
                      {g.allDuplicate && (
                        <span style={{ color: '#FF9F0A', marginLeft: 8 }}>· 추가되는 URL 없음</span>
                      )}
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {urlDetails.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            flexShrink: 0, fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '1px 5px',
                            color: d.isDuplicate ? '#FF9F0A' : '#30D158',
                            background: d.isDuplicate ? 'rgba(255,159,10,0.12)' : 'rgba(48,209,88,0.12)',
                          }}>
                            {d.isDuplicate ? '중복' : '신규'}
                          </span>
                          <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                            {d.url}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {preview.errors.map((e, i) => (
                <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: '#FF453A' }}>
                  <div>{e.rowNumber}행: {e.reason}</div>
                  {e.raw && (
                    <div style={{ marginTop: 2, color: 'var(--text-tertiary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {e.raw}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {error && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#FF453A', fontWeight: 500 }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setPreview(null)} className="mac-btn mac-btn-ghost">다시 입력</button>
              <button type="button" onClick={handleConfirm} disabled={loading || !preview.groups.length} className="mac-btn">
                {loading ? '등록 중…' : `${preview.groups.length}개 등록하기`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
