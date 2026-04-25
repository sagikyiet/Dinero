import { useState, useEffect } from 'react';
import { uploadFiles, uploadCreditCardFile, fetchCCFiles } from '../api';

const NOW   = new Date();
const YEARS = Array.from({ length: 5 }, (_, i) => NOW.getFullYear() - i);
const MONTHS = [
  { v: 1, l: 'ינואר' }, { v: 2, l: 'פברואר' }, { v: 3, l: 'מרץ' },
  { v: 4, l: 'אפריל' }, { v: 5, l: 'מאי'    }, { v: 6, l: 'יוני'   },
  { v: 7, l: 'יולי'  }, { v: 8, l: 'אוגוסט' }, { v: 9, l: 'ספטמבר' },
  { v: 10, l: 'אוקטובר' }, { v: 11, l: 'נובמבר' }, { v: 12, l: 'דצמבר' },
];
const OWNER_LABELS = { sagi: 'שגיא', maya: 'מאיה', joint: 'משותף' };
const CC_YEAR_RANGE = [-2, -1, 0, 1].map(d => NOW.getFullYear() + d);

export default function UploadPanel({ onSuccess, onClose }) {
  const [uploadType, setUploadType] = useState(null); // null | 'bank' | 'cc'

  // ── Bank state ──────────────────────────────────────────────────────────────
  const [bankYear,      setBankYear]      = useState(String(NOW.getFullYear()));
  const [bankMonth,     setBankMonth]     = useState(String(NOW.getMonth() + 1));
  const [leumiFile,     setLeumiFile]     = useState(null);
  const [hapoalimFile,  setHapoalimFile]  = useState(null);

  // ── CC state ────────────────────────────────────────────────────────────────
  const [ccYear,        setCCYear]        = useState(NOW.getFullYear());
  const [ccMonth,       setCCMonth]       = useState(NOW.getMonth() + 1);
  const [cardName,      setCardName]      = useState('');
  const [owner,         setOwner]         = useState('joint');
  const [ccFile,        setCCFile]        = useState(null);
  const [savedCardNames, setSavedCardNames] = useState([]);

  // ── Shared ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetchCCFiles()
      .then(files => setSavedCardNames([...new Set(files.map(f => f.card_name).filter(Boolean))]))
      .catch(() => {});
  }, []);

  function back() {
    setUploadType(null);
    setResult(null);
    setError(null);
  }

  // ── Bank submit ─────────────────────────────────────────────────────────────
  async function handleBankSubmit(e) {
    e.preventDefault();
    if (!leumiFile && !hapoalimFile) { setError('יש לבחור לפחות קובץ אחד'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append('year', bankYear); fd.append('month', bankMonth);
      if (leumiFile)    fd.append('leumi',    leumiFile);
      if (hapoalimFile) fd.append('hapoalim', hapoalimFile);
      const res = await uploadFiles(fd);
      setResult(res);
      if (!res.errors?.length) setTimeout(() => onSuccess({ type: 'bank', ...res }), 1200);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }

  // ── CC submit ───────────────────────────────────────────────────────────────
  async function handleCCSubmit(e) {
    e.preventDefault();
    if (!ccFile) { setError('יש לבחור קובץ'); return; }
    setLoading(true); setError(null); setResult(null);
    const period = `${ccYear}-${String(ccMonth).padStart(2, '0')}`;
    try {
      const res = await uploadCreditCardFile(ccFile, cardName.trim(), owner, period);
      setResult({ transactionCount: res.transactionCount });
      setTimeout(() => onSuccess({ type: 'cc' }), 1200);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }

  const title = uploadType === 'bank' ? 'העלאת קובץ בנק'
              : uploadType === 'cc'   ? 'העלאת כרטיס אשראי'
              :                         'העלאת קבצים';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Step 1: type chooser ─────────────────────────────────────── */}
        {uploadType === null && (
          <div className="upload-type-chooser">
            <button className="upload-type-btn" onClick={() => setUploadType('bank')}>
              <span className="upload-type-icon">🏦</span>
              <span className="upload-type-label">קובץ בנק</span>
              <span className="upload-type-desc">לאומי / הפועלים</span>
            </button>
            <button className="upload-type-btn" onClick={() => setUploadType('cc')}>
              <span className="upload-type-icon">💳</span>
              <span className="upload-type-label">כרטיס אשראי</span>
              <span className="upload-type-desc">ישראכרט / מקס</span>
            </button>
          </div>
        )}

        {/* ── Bank upload form ─────────────────────────────────────────── */}
        {uploadType === 'bank' && (
          <form onSubmit={handleBankSubmit} className="upload-form">
            <div className="form-row">
              <div className="form-group">
                <label>שנה</label>
                <select value={bankYear} onChange={e => setBankYear(e.target.value)}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>חודש</label>
                <select value={bankMonth} onChange={e => setBankMonth(e.target.value)}>
                  {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
              </div>
            </div>

            <div className="file-inputs">
              <div className={`file-drop${leumiFile ? ' has-file' : ''}`}>
                <div className="file-bank-name">בנק לאומי</div>
                <label className="file-label">
                  <input type="file" accept=".xls,.xlsx,.csv"
                    onChange={e => setLeumiFile(e.target.files[0] || null)} />
                  {leumiFile
                    ? <span className="file-chosen">{leumiFile.name}</span>
                    : <span className="file-placeholder">בחר קובץ Excel...</span>}
                </label>
                {leumiFile && <button type="button" className="file-clear" onClick={() => setLeumiFile(null)}>✕</button>}
              </div>

              <div className={`file-drop${hapoalimFile ? ' has-file' : ''}`}>
                <div className="file-bank-name">בנק הפועלים</div>
                <label className="file-label">
                  <input type="file" accept=".xls,.xlsx,.csv"
                    onChange={e => setHapoalimFile(e.target.files[0] || null)} />
                  {hapoalimFile
                    ? <span className="file-chosen">{hapoalimFile.name}</span>
                    : <span className="file-placeholder">בחר קובץ Excel...</span>}
                </label>
                {hapoalimFile && <button type="button" className="file-clear" onClick={() => setHapoalimFile(null)}>✕</button>}
              </div>
            </div>

            {error  && <div className="upload-error">{error}</div>}
            {result && (
              <div className="upload-success">
                נקלטו {result.transactionCount} פעולות בהצלחה!
                {result.errors?.length > 0 && (
                  <div className="upload-warnings">
                    {result.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
                  </div>
                )}
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={back}>→ חזרה</button>
              <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
              <button type="submit"  className="btn-primary"   disabled={loading}>
                {loading ? 'מעבד...' : 'העלאה ועיבוד'}
              </button>
            </div>
          </form>
        )}

        {/* ── CC upload form ───────────────────────────────────────────── */}
        {uploadType === 'cc' && (
          <form onSubmit={handleCCSubmit} className="upload-form">
            <datalist id="upload-panel-card-names">
              {savedCardNames.map(n => <option key={n} value={n} />)}
            </datalist>

            <div className="form-row">
              <div className="form-group">
                <label>חודש</label>
                <select value={ccMonth} onChange={e => setCCMonth(+e.target.value)}>
                  {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>שנה</label>
                <select value={ccYear} onChange={e => setCCYear(+e.target.value)}>
                  {CC_YEAR_RANGE.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>שם הכרטיס (אופציונלי)</label>
                <input
                  list="upload-panel-card-names"
                  type="text"
                  className="upload-cc-name-input"
                  placeholder="לדוגמה: מקס שגיא, ויזה מאיה..."
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="form-group">
                <label>בעלות</label>
                <div className="cc-owner-pills" style={{ marginTop: '0.15rem' }}>
                  {['sagi', 'maya', 'joint'].map(v => (
                    <button key={v} type="button"
                      className={`cc-filter-pill${owner === v ? ' active' : ''}`}
                      onClick={() => setOwner(v)}
                    >
                      {OWNER_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="file-inputs">
              <div className={`file-drop${ccFile ? ' has-file' : ''}`}>
                <div className="file-bank-name">קובץ ישראכרט / מקס</div>
                <label className="file-label">
                  <input type="file" accept=".xls,.xlsx"
                    onChange={e => setCCFile(e.target.files[0] || null)} />
                  {ccFile
                    ? <span className="file-chosen">{ccFile.name}</span>
                    : <span className="file-placeholder">בחר קובץ Excel...</span>}
                </label>
                {ccFile && <button type="button" className="file-clear" onClick={() => setCCFile(null)}>✕</button>}
              </div>
            </div>

            {error  && <div className="upload-error">{error}</div>}
            {result && <div className="upload-success">נקלטו {result.transactionCount} עסקאות בהצלחה!</div>}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={back}>→ חזרה</button>
              <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
              <button type="submit"  className="btn-primary"   disabled={loading}>
                {loading ? 'מעבד...' : 'העלה ועבד'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
