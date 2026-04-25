import { useState, useRef, useEffect, useMemo } from 'react';
import {
  deleteMonthFile, replaceMonthFile, getMonthFileDownloadUrl,
  fetchTransactions, fetchCCFiles, deleteCCFile, getCCFileDownloadUrl,
  fetchCCFileTransactions, replaceCCFile,
} from '../api';

const MONTH_NAMES  = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const COMPANY_LABELS = { isracard: 'ישראכרט', max: 'מקס' };
const OWNER_LABELS   = { sagi: 'שגיא', maya: 'מאיה', joint: 'משותף' };

function periodLabel(key) {
  if (!key) return 'ללא תקופה';
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

// ─── CC metadata form (period + card name + owner) ────────────────────────────
function CCMetaForm({ initialCardName = '', initialOwner = 'joint', initialPeriod, onConfirm, onCancel, confirmLabel = 'העלה' }) {
  const now = new Date();
  const [cardName, setCardName] = useState(initialCardName);
  const [owner,    setOwner]    = useState(initialOwner);
  const [selYear,  setSelYear]  = useState(() =>
    initialPeriod ? parseInt(initialPeriod.split('-')[0]) : now.getFullYear()
  );
  const [selMonth, setSelMonth] = useState(() =>
    initialPeriod ? parseInt(initialPeriod.split('-')[1]) : now.getMonth() + 1
  );

  const period    = `${selYear}-${String(selMonth).padStart(2, '0')}`;
  const yearRange = [-2, -1, 0, 1].map(d => now.getFullYear() + d);

  return (
    <div className="cc-meta-form">
      <div className="cc-meta-row">
        <div className="form-group">
          <label>תקופה</label>
          <div className="cc-period-selectors">
            <select value={selMonth} onChange={e => setSelMonth(+e.target.value)}>
              {MONTH_NAMES.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
            </select>
            <select value={selYear} onChange={e => setSelYear(+e.target.value)}>
              {yearRange.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group cc-meta-name-group">
          <label>שם הכרטיס (אופציונלי)</label>
          <input
            list="cc-saved-card-names"
            type="text"
            className="cc-meta-input"
            placeholder="לדוגמה: מקס שגיא, ויזה מאיה..."
            value={cardName}
            onChange={e => setCardName(e.target.value)}
            maxLength={80}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>בעלות</label>
          <div className="cc-owner-pills">
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

      <div className="form-actions">
        <button className="btn-secondary" type="button" onClick={onCancel}>ביטול</button>
        <button className="btn-primary"   type="button" onClick={() => onConfirm(cardName.trim(), owner, period)}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Bank preview table ───────────────────────────────────────────────────────
function fmt(n) {
  if (n == null || n === 0) return '';
  return Number(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PreviewPanel({ monthId, bank }) {
  const [txs,     setTxs]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetchTransactions({ month_id: monthId, bank })
      .then(data => { setTxs(data.transactions); setLoading(false); })
      .catch(e   => { setError(e.message);        setLoading(false); });
  }, [monthId, bank]);

  if (loading) return <div className="files-preview-loading">טוען...</div>;
  if (error)   return <div className="files-preview-error">{error}</div>;
  if (!txs || txs.length === 0) return <div className="files-preview-empty">אין פעולות</div>;

  return (
    <div className="files-preview-wrap">
      <table className="files-preview-table">
        <thead>
          <tr>
            <th>תאריך</th><th>תיאור</th>
            <th className="num-col">חובה</th><th className="num-col">זכות</th>
          </tr>
        </thead>
        <tbody>
          {txs.map(tx => (
            <tr key={tx.id}>
              <td className="files-preview-date">{tx.date}</td>
              <td className="files-preview-desc">{tx.description}</td>
              <td className={`num-col${tx.debit  ? ' debit-col'  : ''}`}>{fmt(tx.debit)}</td>
              <td className={`num-col${tx.credit ? ' credit-col' : ''}`}>{fmt(tx.credit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Single bank file row ─────────────────────────────────────────────────────
function BankFileRow({ monthId, year, month, bank, bankLabel, filename, filepath, count, onChanged }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [showPreview,   setShowPreview]   = useState(false);
  const fileRef = useRef(null);
  const hasFile     = !!filename || count > 0;
  const displayName = filename || (count > 0 ? `${bankLabel}_${String(month).padStart(2,'0')}_${year}.xlsx` : null);

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setLoading(true);
    try { await deleteMonthFile(monthId, bank); onChanged(); }
    catch (e) { alert('שגיאה: ' + e.message); }
    finally   { setLoading(false); setConfirmDelete(false); }
  }

  async function handleReplace(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try { await replaceMonthFile(monthId, bank, file); onChanged(); }
    catch (e) { alert('שגיאה: ' + e.message); }
    finally   { setLoading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <div className="files-bank-block">
      <div className="files-bank-row">
        <span className={`badge badge-bank bank-${bank}`}>{bankLabel}</span>
        <div className="files-file-info">
          {hasFile ? (
            filepath
              ? <a className="files-filename files-filename-link" href={getMonthFileDownloadUrl(monthId, bank)} download>{displayName}</a>
              : <span className="files-filename" title="הקובץ המקורי לא נשמר — ניתן להחליפו">{displayName}</span>
          ) : (
            <span className="files-no-file">לא הועלה</span>
          )}
          {hasFile && <span className="files-tx-count">{count} פעולות</span>}
        </div>
        <div className="files-actions">
          {hasFile && (
            <button className={`files-action-btn files-btn-preview${showPreview ? ' active' : ''}`}
              onClick={() => setShowPreview(v => !v)}>
              {showPreview ? 'סגור' : 'תצוגה מקדימה'}
            </button>
          )}
          <label className={`files-action-btn files-btn-replace${loading ? ' disabled' : ''}`}>
            {loading ? 'מעבד...' : hasFile ? 'החלף' : 'העלה'}
            <input ref={fileRef} type="file" accept=".xls,.xlsx,.csv"
              style={{ display: 'none' }} onChange={handleReplace} disabled={loading} />
          </label>
          {hasFile && (
            <button className={`files-action-btn files-btn-delete${confirmDelete ? ' confirm' : ''}`}
              disabled={loading} onClick={handleDelete} onBlur={() => setConfirmDelete(false)}>
              {confirmDelete ? 'אישור מחיקה?' : 'מחק'}
            </button>
          )}
        </div>
      </div>
      {showPreview && hasFile && <PreviewPanel key={`${monthId}-${bank}`} monthId={monthId} bank={bank} />}
    </div>
  );
}

// ─── CC file preview table ────────────────────────────────────────────────────
function CCPreviewPanel({ uploadId }) {
  const [txs,     setTxs]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetchCCFileTransactions(uploadId)
      .then(data => { setTxs(data.transactions); setLoading(false); })
      .catch(e   => { setError(e.message);        setLoading(false); });
  }, [uploadId]);

  const fmtAmount = (n, currency) => {
    if (n == null) return '';
    try {
      return new Intl.NumberFormat('he-IL', { style: 'currency', currency: currency || 'ILS', maximumFractionDigits: 2 }).format(n);
    } catch {
      return `${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ${currency || ''}`;
    }
  };

  if (loading) return <div className="files-preview-loading">טוען...</div>;
  if (error)   return <div className="files-preview-error">{error}</div>;
  if (!txs || txs.length === 0) return <div className="files-preview-empty">אין עסקאות</div>;

  return (
    <div className="files-preview-wrap">
      <table className="files-preview-table">
        <thead>
          <tr><th>תאריך</th><th>שם עסק</th><th className="num-col">סכום</th><th>קטגוריה</th></tr>
        </thead>
        <tbody>
          {txs.map(tx => (
            <tr key={tx.id}>
              <td className="files-preview-date">{tx.date?.slice(0, 10)}</td>
              <td className="files-preview-desc">{tx.merchant}</td>
              <td className="num-col debit-col">{fmtAmount(tx.amount, tx.currency)}</td>
              <td>{tx.category}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Single CC file row ───────────────────────────────────────────────────────
function CCFileRow({ file, onChanged }) {
  const [showPreview,   setShowPreview]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading,       setLoading]       = useState(false);
  const fileRef = useRef(null);

  async function handleReplace(e) {
    const f = e.target.files[0];
    if (!f) return;
    setLoading(true);
    try { await replaceCCFile(file.id, f); onChanged(); }
    catch (err) { alert('שגיאה: ' + err.message); }
    finally { setLoading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try { await deleteCCFile(file.id); onChanged(); }
    catch (err) { alert('שגיאה: ' + err.message); }
  }

  return (
    <div className="files-bank-block">
      <div className="files-bank-row">
        <span className={`badge badge-company badge-${file.company}`}>
          {COMPANY_LABELS[file.company] || file.company}
        </span>
        <div className="files-file-info">
          {file.filepath
            ? <a className="files-filename files-filename-link" href={getCCFileDownloadUrl(file.id)} download>{file.filename}</a>
            : <span className="files-filename">{file.filename}</span>
          }
          {file.card_name && <span className="files-tx-count" style={{ fontWeight: 600 }}>{file.card_name}</span>}
          {file.owner && <span className="badge cc-owner-badge">{OWNER_LABELS[file.owner] || file.owner}</span>}
          <span className="files-tx-count">{file.transaction_count} פעולות</span>
        </div>
        <div className="files-actions">
          <button className={`files-action-btn files-btn-preview${showPreview ? ' active' : ''}`}
            onClick={() => setShowPreview(v => !v)}>
            {showPreview ? 'סגור' : 'תצוגה מקדימה'}
          </button>
          <label className={`files-action-btn files-btn-replace${loading ? ' disabled' : ''}`}>
            {loading ? 'מעבד...' : 'החלף'}
            <input ref={fileRef} type="file" accept=".xls,.xlsx"
              style={{ display: 'none' }} onChange={handleReplace} disabled={loading} />
          </label>
          <button className={`files-action-btn files-btn-delete${confirmDelete ? ' confirm' : ''}`}
            onClick={handleDelete} onBlur={() => setConfirmDelete(false)}>
            {confirmDelete ? 'אישור מחיקה?' : 'מחק'}
          </button>
        </div>
      </div>
      {showPreview && <CCPreviewPanel uploadId={file.id} />}
    </div>
  );
}

// ─── One period card: always shows both bank + CC sub-sections ────────────────
function PeriodCard({ periodKey, bankMonth, ccFiles, onBankChanged, onCCChanged }) {
  return (
    <div className="card files-month-card">
      <div className="files-month-header">
        <h3>{periodLabel(periodKey)}</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {bankMonth && <span className="tx-badge">{bankMonth.transaction_count} פעולות בנק</span>}
          {ccFiles.length > 0 && <span className="tx-badge">{ccFiles.reduce((s, f) => s + f.transaction_count, 0)} פעולות אשראי</span>}
        </div>
      </div>

      <div className="files-period-sub">
        <span className="files-sub-label">בנק</span>
        {bankMonth ? (
          <div className="files-banks">
            <BankFileRow monthId={bankMonth.id} year={bankMonth.year} month={bankMonth.month}
              bank="leumi"    bankLabel="לאומי"    filename={bankMonth.leumi_filename}    filepath={bankMonth.leumi_filepath}    count={bankMonth.leumi_count    || 0} onChanged={onBankChanged} />
            <BankFileRow monthId={bankMonth.id} year={bankMonth.year} month={bankMonth.month}
              bank="hapoalim" bankLabel="הפועלים" filename={bankMonth.hapoalim_filename} filepath={bankMonth.hapoalim_filepath} count={bankMonth.hapoalim_count || 0} onChanged={onBankChanged} />
          </div>
        ) : (
          <div className="files-sub-empty">אין קבצי בנק לתקופה זו</div>
        )}
      </div>

      <div className="files-period-sub">
        <span className="files-sub-label">כרטיסי אשראי</span>
        {ccFiles.length > 0 ? (
          <div className="files-banks">
            {ccFiles.map(f => <CCFileRow key={f.id} file={f} onChanged={onCCChanged} />)}
          </div>
        ) : (
          <div className="files-sub-empty">אין קבצי אשראי לתקופה זו</div>
        )}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
export default function FilesView({ months, onChanged }) {
  const [ccFiles,     setCCFiles]   = useState([]);
  const [ccLoading,   setCCLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const initedRef = useRef(false);

  const savedCardNames = useMemo(
    () => [...new Set(ccFiles.map(f => f.card_name).filter(Boolean))],
    [ccFiles]
  );

  function loadCCFiles() {
    setCCLoading(true);
    fetchCCFiles()
      .then(data => { setCCFiles(data); setCCLoading(false); })
      .catch(e   => { setError(e.message); setCCLoading(false); });
  }
  useEffect(() => { loadCCFiles(); }, []);

  // Merge bank months + CC files into sorted periods
  const periods = useMemo(() => {
    const map = new Map();
    for (const m of months) {
      const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
      map.set(key, { bankMonth: m, ccFiles: [] });
    }
    for (const f of ccFiles) {
      const key = f.period || '';
      if (!map.has(key)) map.set(key, { bankMonth: null, ccFiles: [] });
      map.get(key).ccFiles.push(f);
    }
    // Newest first; empty-period key last
    return [...map.entries()].sort(([a], [b]) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return b.localeCompare(a);
    });
  }, [months, ccFiles]);

  const allPeriodKeys = useMemo(() => periods.map(([k]) => k), [periods]);

  // One-time: default to most recent period
  useEffect(() => {
    if (!initedRef.current && allPeriodKeys.length > 0) {
      initedRef.current = true;
      const first = allPeriodKeys.find(k => k) ?? allPeriodKeys[0];
      setSelectedKeys(new Set([first]));
    }
  }, [allPeriodKeys]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAllSelected = allPeriodKeys.length > 0 && allPeriodKeys.every(k => selectedKeys.has(k));

  function toggleAll()  { setSelectedKeys(new Set(allPeriodKeys)); }
  function toggleKey(key) {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }

  const displayedPeriods = periods.filter(([k]) => selectedKeys.has(k));

  const hasAnyData = months.length > 0 || ccFiles.length > 0;

  return (
    <div className="history-view files-view">
      {/* One shared datalist — all CCMetaForm inputs reference it by id */}
      <datalist id="cc-saved-card-names">
        {savedCardNames.map(name => <option key={name} value={name} />)}
      </datalist>

      <div className="files-period-filter" style={{ marginBottom: '1.25rem' }}>
        <button className={`period-pill${isAllSelected ? ' active' : ''}`} onClick={toggleAll}>
          הכל
        </button>
        {allPeriodKeys.map(key => (
          <button key={key}
            className={`period-pill${selectedKeys.has(key) ? ' active' : ''}`}
            onClick={() => toggleKey(key)}
          >
            {periodLabel(key)}
          </button>
        ))}
      </div>

      {ccLoading && !hasAnyData ? (
        <div className="files-preview-loading">טוען...</div>
      ) : !hasAnyData ? (
        <div className="files-preview-empty">לא הועלו קבצים עדיין</div>
      ) : displayedPeriods.length === 0 ? (
        <div className="files-preview-empty">אין קבצים לתקופה הנבחרת</div>
      ) : (
        <div className="files-months-list">
          {displayedPeriods.map(([key, { bankMonth, ccFiles: pcc }]) => (
            <PeriodCard
              key={key || '__none__'}
              periodKey={key}
              bankMonth={bankMonth}
              ccFiles={pcc}
              onBankChanged={onChanged}
              onCCChanged={loadCCFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}
