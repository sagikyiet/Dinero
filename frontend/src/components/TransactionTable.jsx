import { useState, useMemo, useEffect, useRef } from 'react';
import { getTagLabels } from '../tags';
import TagModal from './TagModal';
import { categorizeMerchant, overrideCategory } from '../api';
import { CATEGORIES, CATEGORY_LABELS } from '../categories';

const fmt = (n) =>
  n != null
    ? new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(n)
    : '';

const BANK_LABELS = { leumi: 'לאומי', hapoalim: 'הפועלים' };

// Convert dd/mm/yyyy → yyyy-mm-dd for comparisons. Returns '' if invalid.
function parseDMY(str) {
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const [, d, mo, y] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return '';
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export default function TransactionTable({ transactions, onUpdate, demoNames = {} }) {
  const TAGS = getTagLabels(demoNames);
  const [search, setSearch] = useState('');
  const [bankFilter, setBankFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDateText, setFromDateText] = useState('');
  const [toDateText, setToDateText] = useState('');
  const [tagModal, setTagModal] = useState(null);
  const [sortCol, setSortCol] = useState(null);   // null = default (date desc)
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState({}); // { [description]: category }
  const [editingTxId, setEditingTxId] = useState(null);
  const fetchedRef = useRef(new Set()); // descriptions already fetched or in-flight
  const PAGE_SIZE = 50;

  async function handleCategoryOverride(txId, merchantName, category) {
    setCategories(prev => ({ ...prev, [merchantName]: category }));
    setEditingTxId(null);
    try {
      await overrideCategory(merchantName, category);
    } catch (err) {
      console.error('Category override failed:', err);
    }
  }

  function handleSort(col) {
    if (sortCol === col) {
      if (sortDir === 'asc') { setSortDir('desc'); }
      else { setSortCol(null); setSortDir('asc'); }  // third click → reset
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
    const rows = transactions.filter(tx => {
      if (bankFilter !== 'all' && tx.bank !== bankFilter) return false;
      if (typeFilter === 'debit' && !(tx.debit > 0)) return false;
      if (typeFilter === 'credit' && !(tx.credit > 0)) return false;
      if (search && !(tx.description || '').toLowerCase().includes(search.toLowerCase())) return false;
      const fromISO = parseDMY(fromDateText);
      const toISO   = parseDMY(toDateText);
      if (fromISO && tx.date < fromISO) return false;
      if (toISO   && tx.date > toISO)   return false;
      return true;
    });

    if (!sortCol) {
      // Default: date descending
      return [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    }

    return [...rows].sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case 'date':        av = a.date || '';          bv = b.date || '';          break;
        case 'description': av = a.description || '';   bv = b.description || '';   break;
        case 'bank':        av = a.bank || '';          bv = b.bank || '';          break;
        case 'debit':       av = a.debit ?? -1;         bv = b.debit ?? -1;         break;
        case 'credit':      av = a.credit ?? -1;        bv = b.credit ?? -1;        break;
        case 'tag':         av = a.tag || '';           bv = b.tag || '';           break;
        default:            return 0;
      }
      const cmp = typeof av === 'string' ? av.localeCompare(bv, 'he') : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [transactions, bankFilter, typeFilter, search, fromDateText, toDateText, sortCol, sortDir]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  // Stable string key: sorted unique descriptions — changes only when the visible set changes,
  // not when sort order changes. Used as the useEffect dependency.
  const paginatedDescriptions = [...new Set(
    paginated.map(tx => tx.description).filter(Boolean)
  )].sort().join('\x00');

  useEffect(() => {
    const unique = [...new Set(
      paginated.map(tx => tx.description).filter(d => d && !fetchedRef.current.has(d))
    )];
    if (!unique.length) return;
    unique.forEach(d => fetchedRef.current.add(d));
    unique.forEach(description => {
      categorizeMerchant(description)
        .then(({ category }) => setCategories(prev => ({ ...prev, [description]: category })))
        .catch(() => fetchedRef.current.delete(description));
    });
  }, [paginatedDescriptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => ({
    debit: filtered.reduce((s, t) => s + (t.debit || 0), 0),
    credit: filtered.reduce((s, t) => s + (t.credit || 0), 0),
  }), [filtered]);

  function resetFilters() {
    setSearch('');
    setBankFilter('all');
    setTypeFilter('all');
    setFromDateText('');
    setToDateText('');
    setPage(1);
  }

  const hasFilters = search || bankFilter !== 'all' || typeFilter !== 'all' || fromDateText || toDateText;

  return (
    <div className="card table-card">
      <div className="table-header">
        <h3 className="card-title">פעולות עו"ש</h3>
        <span className="tx-count-label">{filtered.length} פעולות</span>
      </div>

      <div className="filters">
        <input
          className="filter-search"
          type="text"
          placeholder="חיפוש בתיאור..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select value={bankFilter} onChange={e => { setBankFilter(e.target.value); setPage(1); }}>
          <option value="all">כל הבנקים</option>
          <option value="leumi">לאומי</option>
          <option value="hapoalim">הפועלים</option>
        </select>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="all">הכל</option>
          <option value="debit">חובה</option>
          <option value="credit">זכות</option>
        </select>
        <input
          type="text"
          className={`filter-date${fromDateText && !parseDMY(fromDateText) ? ' invalid' : ''}`}
          placeholder="dd/mm/yyyy"
          value={fromDateText}
          onChange={e => { setFromDateText(e.target.value); setPage(1); }}
          maxLength={10}
        />
        <span style={{ color: '#94a3b8' }}>—</span>
        <input
          type="text"
          className={`filter-date${toDateText && !parseDMY(toDateText) ? ' invalid' : ''}`}
          placeholder="dd/mm/yyyy"
          value={toDateText}
          onChange={e => { setToDateText(e.target.value); setPage(1); }}
          maxLength={10}
        />
        {hasFilters && (
          <button className="btn-ghost" onClick={resetFilters}>נקה</button>
        )}
      </div>

      <div className="table-wrap">
        <table className="tx-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('date')}>תאריך <SortArrow col="date" /></th>
              <th className="sortable" onClick={() => handleSort('description')}>תיאור <SortArrow col="description" /></th>
              <th>קטגוריה</th>
              <th className="sortable" onClick={() => handleSort('bank')}>בנק <SortArrow col="bank" /></th>
              <th className="num-col sortable" onClick={() => handleSort('debit')}>חובה <SortArrow col="debit" /></th>
              <th className="num-col sortable" onClick={() => handleSort('credit')}>זכות <SortArrow col="credit" /></th>
              <th className="sortable" onClick={() => handleSort('tag')}>תיוג <SortArrow col="tag" /></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(tx => {
              const tagDef = tx.tag ? TAGS[tx.tag] : null;
              return (
                <tr key={tx.id} className={`tx-row${tx.is_credit_card ? ' credit-card' : ''}`}>
                  <td className="date-cell">{tx.date?.slice(0, 10)}</td>
                  <td className="desc-cell">
                    <span className="desc-text">{tx.description}</span>
                    {tx.tag_note && (
                      <span className="tx-tag-note">{tx.tag_note}</span>
                    )}
                    {tx.is_credit_card && (
                      <span className="badge badge-cc">{tx.credit_card_name}</span>
                    )}
                    {tagDef && (
                      <span
                        className="badge badge-tag"
                        style={{ background: tagDef.bg, color: tagDef.color }}
                      >
                        {tagDef.label}
                      </span>
                    )}
                  </td>
                  <td className="category-cell">
                    {!tx.is_credit_card && editingTxId === tx.id ? (
                      <select
                        autoFocus
                        value={categories[tx.description] || ''}
                        onChange={e => handleCategoryOverride(tx.id, tx.description, e.target.value)}
                        onBlur={() => setEditingTxId(null)}
                        style={{ fontSize: '0.72rem', borderRadius: '0.25rem', padding: '0.1rem 0.2rem' }}
                      >
                        <option value="" disabled>בחר קטגוריה</option>
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>
                            {CATEGORY_LABELS[cat].emoji} {CATEGORY_LABELS[cat].label}
                          </option>
                        ))}
                      </select>
                    ) : (!tx.is_credit_card && (() => {
                      const catDef = tx.description ? CATEGORY_LABELS[categories[tx.description]] : null;
                      return catDef ? (
                        <span
                          title="לחץ לשינוי קטגוריה"
                          onClick={() => setEditingTxId(tx.id)}
                          style={{
                            fontSize: '0.72rem',
                            background: '#f1f5f9',
                            color: '#475569',
                            borderRadius: '0.25rem',
                            padding: '0.125rem 0.4rem',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                          }}
                        >
                          {catDef.emoji} {catDef.label}
                        </span>
                      ) : null;
                    })())}
                  </td>
                  <td>
                    <span className={`badge badge-bank bank-${tx.bank}`}>
                      {BANK_LABELS[tx.bank]}
                    </span>
                  </td>
                  <td className="num-col debit-col">{tx.debit != null && tx.debit > 0 ? fmt(tx.debit) : ''}</td>
                  <td className="num-col credit-col">{tx.credit != null && tx.credit > 0 ? fmt(tx.credit) : ''}</td>
                  <td>
                    <button
                      className={`tag-btn${tx.tag ? ' tagged' : ''}`}
                      onClick={() => setTagModal(tx)}
                      title={tagDef ? tagDef.label : 'תייג פעולה'}
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
              <td colSpan={4}>סה"כ ({filtered.length} פעולות)</td>
              <td className="num-col debit-col">{fmt(totals.debit)}</td>
              <td className="num-col credit-col">{fmt(totals.credit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <button className="btn-secondary" onClick={() => setPage(p => p + 1)}>
            טען עוד ({filtered.length - paginated.length} נותרו)
          </button>
        </div>
      )}

      {tagModal && (
        <TagModal
          tx={tagModal}
          onClose={() => setTagModal(null)}
          onSaved={onUpdate}
          demoNames={demoNames}
        />
      )}
    </div>
  );
}
