import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchCCTransactions, tagCCTransaction } from '../api';
import { TAGS } from '../tags';
import TagModal from './TagModal';

const OWNER_LABELS = { sagi: 'שגיא', maya: 'מאיה', joint: 'משותף' };
const OWNER_STYLES = {
  sagi:  { color: '#059669', bg: '#ecfdf5' },
  maya:  { color: '#0284c7', bg: '#f0f9ff' },
  joint: { color: '#7c3aed', bg: '#f5f3ff' },
};

const fmt = (n, currency = 'ILS') => {
  if (n == null) return '';
  const ccy = currency === 'ILS' ? 'ILS' : currency;
  try {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ${currency}`;
  }
};

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function monthKeyLabel(mk) {
  if (!mk) return mk;
  const [y, m] = mk.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function parseDMY(str) {
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const [, d, mo, y] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return '';
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

const PAGE_SIZE = 50;

export default function CreditCardTransactionsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tagModal, setTagModal] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [cardNameFilter, setCardNameFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [monthKeyFilter, setMonthKeyFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Sorting
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const [page, setPage] = useState(1);

  const loadData = useCallback(() => {
    setLoading(true);
    fetchCCTransactions()
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function handleSort(col) {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  function SortArrow({ col }) {
    if (sortCol !== col) return <span className="sort-arrow inactive">↕</span>;
    return <span className="sort-arrow active">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter(tx => {
      if (cardNameFilter !== 'all' && tx.card_name !== cardNameFilter) return false;
      if (ownerFilter !== 'all' && tx.owner !== ownerFilter) return false;
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;
      if (monthKeyFilter !== 'all' && tx.month_key !== monthKeyFilter) return false;
      if (search && !(tx.merchant || '').toLowerCase().includes(search.toLowerCase()) &&
          !(tx.category || '').toLowerCase().includes(search.toLowerCase()) &&
          !(tx.notes || '').toLowerCase().includes(search.toLowerCase())) return false;
      const fromISO = parseDMY(fromDate);
      const toISO   = parseDMY(toDate);
      if (fromISO && tx.date < fromISO) return false;
      if (toISO   && tx.date > toISO)   return false;
      return true;
    });
  }, [data, cardNameFilter, ownerFilter, categoryFilter, monthKeyFilter, search, fromDate, toDate]);

  const sorted = useMemo(() => {
    if (!sortCol) return [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    return [...filtered].sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case 'date':     av = a.date || '';          bv = b.date || '';          break;
        case 'merchant': av = a.merchant || '';      bv = b.merchant || '';      break;
        case 'amount':   av = a.amount ?? -1;        bv = b.amount ?? -1;        break;
        case 'category': av = a.category || '';      bv = b.category || '';      break;
        case 'card':     av = a.card_name || '';     bv = b.card_name || '';     break;
        case 'owner':    av = a.owner || '';          bv = b.owner || '';          break;
        case 'tag':      av = a.tag || '';            bv = b.tag || '';            break;
        default: return 0;
      }
      const cmp = typeof av === 'string' ? av.localeCompare(bv, 'he') : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const paginated = sorted.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < sorted.length;

  const total = useMemo(() => filtered.reduce((s, t) => s + (t.amount || 0), 0), [filtered]);

  function resetFilters() {
    setSearch(''); setCardNameFilter('all'); setOwnerFilter('all');
    setCategoryFilter('all'); setMonthKeyFilter('all');
    setFromDate(''); setToDate(''); setPage(1);
  }

  const hasFilters = search || cardNameFilter !== 'all' || ownerFilter !== 'all' ||
    categoryFilter !== 'all' || monthKeyFilter !== 'all' || fromDate || toDate;

  if (loading) return <div className="loading">טוען...</div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return null;

  return (
    <div className="history-view cc-tx-view">
      <div className="card table-card">
        <div className="table-header">
          <h3 className="card-title">עסקאות כרטיסי אשראי</h3>
          <span className="tx-count-label">{filtered.length} עסקאות</span>
        </div>

        <div className="filters">
          <input
            className="filter-search"
            type="text"
            placeholder="חיפוש לפי שם עסק..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {data.cardNames.length > 0 && (
            <select value={cardNameFilter} onChange={e => { setCardNameFilter(e.target.value); setPage(1); }}>
              <option value="all">כל הכרטיסים</option>
              {data.cardNames.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <select value={ownerFilter} onChange={e => { setOwnerFilter(e.target.value); setPage(1); }}>
            <option value="all">כל הבעלים</option>
            {data.owners.map(o => (
              <option key={o} value={o}>{OWNER_LABELS[o] || o}</option>
            ))}
          </select>
          {data.categories.length > 0 && (
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
              <option value="all">כל הקטגוריות</option>
              {data.categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <select value={monthKeyFilter} onChange={e => { setMonthKeyFilter(e.target.value); setPage(1); }}>
            <option value="all">כל החודשים</option>
            {data.monthKeys.map(mk => (
              <option key={mk} value={mk}>{monthKeyLabel(mk)}</option>
            ))}
          </select>
          <input
            type="text"
            className={`filter-date${fromDate && !parseDMY(fromDate) ? ' invalid' : ''}`}
            placeholder="dd/mm/yyyy"
            value={fromDate}
            onChange={e => { setFromDate(e.target.value); setPage(1); }}
            maxLength={10}
          />
          <span style={{ color: '#94a3b8' }}>—</span>
          <input
            type="text"
            className={`filter-date${toDate && !parseDMY(toDate) ? ' invalid' : ''}`}
            placeholder="dd/mm/yyyy"
            value={toDate}
            onChange={e => { setToDate(e.target.value); setPage(1); }}
            maxLength={10}
          />
          {hasFilters && <button className="btn-ghost" onClick={resetFilters}>נקה</button>}
        </div>

        <div className="table-wrap">
          <table className="tx-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('date')}>תאריך <SortArrow col="date" /></th>
                <th className="sortable" onClick={() => handleSort('merchant')}>שם עסק <SortArrow col="merchant" /></th>
                <th className="num-col sortable" onClick={() => handleSort('amount')}>סכום <SortArrow col="amount" /></th>
                <th className="sortable" onClick={() => handleSort('category')}>קטגוריה <SortArrow col="category" /></th>
                <th className="sortable" onClick={() => handleSort('card')}>כרטיס <SortArrow col="card" /></th>
                <th className="sortable" onClick={() => handleSort('owner')}>בעלות <SortArrow col="owner" /></th>
                <th>הערות</th>
                <th className="sortable" onClick={() => handleSort('tag')}>תיוג <SortArrow col="tag" /></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(tx => {
                const tagDef = tx.tag ? TAGS[tx.tag] : null;
                return (
                  <tr key={tx.id} className="tx-row">
                    <td className="date-cell">{tx.date?.slice(0, 10)}</td>
                    <td className="desc-cell">
                      <span className="desc-text">{tx.merchant}</span>
                      {tx.tag_note && <span className="tx-tag-note">{tx.tag_note}</span>}
                      {tagDef && (
                        <span className="badge badge-tag" style={{ background: tagDef.bg, color: tagDef.color }}>
                          {tagDef.label}
                        </span>
                      )}
                    </td>
                    <td className="num-col debit-col">{fmt(tx.amount, tx.currency)}</td>
                    <td>{tx.category && <span className="badge cc-category-badge">{tx.category}</span>}</td>
                    <td>
                      {tx.card_name ? (
                        <span className="badge badge-cc">{tx.card_name}</span>
                      ) : tx.card_last4 ? (
                        <span className="badge badge-cc">****{tx.card_last4}</span>
                      ) : null}
                    </td>
                    <td>
                      {tx.owner && (() => {
                        const s = OWNER_STYLES[tx.owner];
                        return (
                          <span className="badge" style={s ? { background: s.bg, color: s.color } : {}}>
                            {OWNER_LABELS[tx.owner] || tx.owner}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="cc-notes-cell">{tx.notes}</td>
                    <td>
                      <button
                        className={`tag-btn${tx.tag ? ' tagged' : ''}`}
                        onClick={() => setTagModal({ ...tx, description: tx.merchant || '(ללא שם עסק)' })}
                        title={tagDef ? tagDef.label : 'תייג עסקה'}
                        style={tagDef ? { background: tagDef.bg, color: tagDef.color } : {}}
                      >
                        🏷
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="totals-row">
                <td colSpan={2}>סה"כ ({filtered.length} עסקאות)</td>
                <td className="num-col debit-col">{fmt(total)}</td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </div>

        {hasMore && (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <button className="btn-secondary" onClick={() => setPage(p => p + 1)}>
              טען עוד ({sorted.length - paginated.length} נותרו)
            </button>
          </div>
        )}

        {data.transactions.length === 0 && (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <div className="empty-icon">💳</div>
            <h2>אין עסקאות כרטיסי אשראי</h2>
            <p>העלה קבצי ישראכרט או מקס דרך עמוד הקבצים</p>
          </div>
        )}
      </div>

      {tagModal && (
        <TagModal
          tx={tagModal}
          onClose={() => setTagModal(null)}
          onSaved={loadData}
          tagFn={tagCCTransaction}
        />
      )}
    </div>
  );
}
