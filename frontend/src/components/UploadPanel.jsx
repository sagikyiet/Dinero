import { useState } from 'react';
import { uploadFiles } from '../api';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = [
  { v: 1, l: 'ינואר' }, { v: 2, l: 'פברואר' }, { v: 3, l: 'מרץ' },
  { v: 4, l: 'אפריל' }, { v: 5, l: 'מאי' }, { v: 6, l: 'יוני' },
  { v: 7, l: 'יולי' }, { v: 8, l: 'אוגוסט' }, { v: 9, l: 'ספטמבר' },
  { v: 10, l: 'אוקטובר' }, { v: 11, l: 'נובמבר' }, { v: 12, l: 'דצמבר' },
];

export default function UploadPanel({ onSuccess, onClose }) {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [leumiFile, setLeumiFile] = useState(null);
  const [hapoalimFile, setHapoalimFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!leumiFile && !hapoalimFile) {
      setError('יש לבחור לפחות קובץ אחד');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append('year', year);
      fd.append('month', month);
      if (leumiFile) fd.append('leumi', leumiFile);
      if (hapoalimFile) fd.append('hapoalim', hapoalimFile);

      const res = await uploadFiles(fd);
      setResult(res);

      if (res.errors?.length === 0 || !res.errors) {
        setTimeout(() => onSuccess(res), 1200);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>העלאת קבצי בנק</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          <div className="form-row">
            <div className="form-group">
              <label>שנה</label>
              <select value={year} onChange={e => setYear(e.target.value)}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>חודש</label>
              <select value={month} onChange={e => setMonth(e.target.value)}>
                {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
          </div>

          <div className="file-inputs">
            <div className={`file-drop${leumiFile ? ' has-file' : ''}`}>
              <div className="file-bank-name">בנק לאומי</div>
              <label className="file-label">
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  onChange={e => setLeumiFile(e.target.files[0] || null)}
                />
                {leumiFile ? (
                  <span className="file-chosen">{leumiFile.name}</span>
                ) : (
                  <span className="file-placeholder">בחר קובץ Excel...</span>
                )}
              </label>
              {leumiFile && (
                <button type="button" className="file-clear" onClick={() => setLeumiFile(null)}>✕</button>
              )}
            </div>

            <div className={`file-drop${hapoalimFile ? ' has-file' : ''}`}>
              <div className="file-bank-name">בנק הפועלים</div>
              <label className="file-label">
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  onChange={e => setHapoalimFile(e.target.files[0] || null)}
                />
                {hapoalimFile ? (
                  <span className="file-chosen">{hapoalimFile.name}</span>
                ) : (
                  <span className="file-placeholder">בחר קובץ Excel...</span>
                )}
              </label>
              {hapoalimFile && (
                <button type="button" className="file-clear" onClick={() => setHapoalimFile(null)}>✕</button>
              )}
            </div>
          </div>

          {error && <div className="upload-error">{error}</div>}

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
            <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'מעבד...' : 'העלאה ועיבוד'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
