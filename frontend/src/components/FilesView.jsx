import { useState, useRef, useEffect } from 'react';
import { deleteMonthFile, replaceMonthFile, getMonthFileDownloadUrl, fetchTransactions } from '../api';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function fmt(n) {
  if (n == null || n === 0) return '';
  return Number(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PreviewPanel({ monthId, bank }) {
  const [txs, setTxs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTransactions({ month_id: monthId, bank })
      .then(data => { setTxs(data.transactions); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [monthId, bank]);

  if (loading) return <div className="files-preview-loading">טוען...</div>;
  if (error) return <div className="files-preview-error">{error}</div>;
  if (!txs || txs.length === 0) return <div className="files-preview-empty">אין פעולות</div>;

  return (
    <div className="files-preview-wrap">
      <table className="files-preview-table">
        <thead>
          <tr>
            <th>תאריך</th>
            <th>תיאור</th>
            <th className="num-col">חובה</th>
            <th className="num-col">זכות</th>
          </tr>
        </thead>
        <tbody>
          {txs.map(tx => (
            <tr key={tx.id}>
              <td className="files-preview-date">{tx.date}</td>
              <td className="files-preview-desc">{tx.description}</td>
              <td className={`num-col${tx.debit ? ' debit-col' : ''}`}>{fmt(tx.debit)}</td>
              <td className={`num-col${tx.credit ? ' credit-col' : ''}`}>{fmt(tx.credit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BankFileRow({ monthId, year, month, bank, bankLabel, filename, filepath, count, onChanged }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef(null);
  const hasFile = !!filename || count > 0;

  const displayName = filename ||
    (count > 0 ? `${bankLabel}_${String(month).padStart(2, '0')}_${year}.xlsx` : null);

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setLoading(true);
    try {
      await deleteMonthFile(monthId, bank);
      onChanged();
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  }

  async function handleReplace(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      await replaceMonthFile(monthId, bank, file);
      onChanged();
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="files-bank-block">
      <div className="files-bank-row">
        <span className={`badge badge-bank bank-${bank}`}>{bankLabel}</span>

        <div className="files-file-info">
          {hasFile ? (
            filepath ? (
              <a
                className="files-filename files-filename-link"
                href={getMonthFileDownloadUrl(monthId, bank)}
                download
                title="הורד קובץ"
              >
                {displayName}
              </a>
            ) : (
              <span className="files-filename" title="הקובץ המקורי לא נשמר — ניתן להחליפו">
                {displayName}
              </span>
            )
          ) : (
            <span className="files-no-file">לא הועלה</span>
          )}
          {hasFile && <span className="files-tx-count">{count} פעולות</span>}
        </div>

        <div className="files-actions">
          {hasFile && (
            <button
              className={`files-action-btn files-btn-preview${showPreview ? ' active' : ''}`}
              onClick={() => setShowPreview(v => !v)}
              title="תצוגה מקדימה"
            >
              {showPreview ? 'סגור' : 'תצוגה מקדימה'}
            </button>
          )}
          {hasFile && (
            <button
              className={`files-action-btn${confirmDelete ? ' files-btn-danger' : ''}`}
              disabled={loading}
              onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
            >
              {confirmDelete ? 'אישור מחיקה?' : 'מחק'}
            </button>
          )}
          <label className={`files-action-btn files-btn-replace${loading ? ' disabled' : ''}`}>
            {loading ? 'מעבד...' : hasFile ? 'החלף' : 'העלה'}
            <input
              ref={fileRef}
              type="file"
              accept=".xls,.xlsx,.csv"
              style={{ display: 'none' }}
              onChange={handleReplace}
              disabled={loading}
            />
          </label>
        </div>
      </div>

      {showPreview && hasFile && (
        <PreviewPanel key={`${monthId}-${bank}`} monthId={monthId} bank={bank} />
      )}
    </div>
  );
}

export default function FilesView({ months, onChanged }) {
  if (months.length === 0) {
    return (
      <div className="history-view">
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <h2>אין חודשים</h2>
          <p>העלה קבצי בנק כדי להתחיל לעקוב אחר ההוצאות שלכם</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-view files-view">
      <h2 className="files-view-title">קבצים מועלים לפי חודש</h2>
      <div className="files-months-list">
        {months.map(m => (
          <div key={m.id} className="card files-month-card">
            <div className="files-month-header">
              <h3>{MONTH_NAMES[m.month - 1]} {m.year}</h3>
              <span className="tx-badge">{m.transaction_count} פעולות</span>
            </div>
            <div className="files-banks">
              <BankFileRow
                monthId={m.id}
                year={m.year}
                month={m.month}
                bank="leumi"
                bankLabel="לאומי"
                filename={m.leumi_filename}
                filepath={m.leumi_filepath}
                count={m.leumi_count || 0}
                onChanged={onChanged}
              />
              <BankFileRow
                monthId={m.id}
                year={m.year}
                month={m.month}
                bank="hapoalim"
                bankLabel="הפועלים"
                filename={m.hapoalim_filename}
                filepath={m.hapoalim_filepath}
                count={m.hapoalim_count || 0}
                onChanged={onChanged}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
