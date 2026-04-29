import { useState } from 'react';
import { CATEGORIES, CATEGORY_LABELS } from '../categories';
import { overrideCategory } from '../api';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

const TH = { padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem' };
const TD = { padding: '0.45rem 0.75rem', textAlign: 'right', color: '#475569' };

export default function DrillDownModal({ transactions, title, total, onClose, onCategoryChanged }) {
  // category state keyed by merchant — so all rows for the same merchant update together
  const [cats, setCats] = useState(() => {
    const map = {};
    for (const tx of transactions) {
      if (tx.merchant) map[tx.merchant] = tx.category || 'other';
    }
    return map;
  });

  async function handleChange(merchant, newCat) {
    setCats(prev => ({ ...prev, [merchant]: newCat }));
    try {
      await overrideCategory(merchant, newCat);
      onCategoryChanged?.();
    } catch (err) {
      console.error('Category override failed:', err);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '0.75rem',
          width: '100%', maxWidth: '660px',
          maxHeight: '82vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'baseline',
          justifyContent: 'space-between', gap: '0.75rem',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
            <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>{fmt(total)}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="סגור"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.4rem', color: '#94a3b8', lineHeight: 1, padding: '0 0.1rem',
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable table */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {transactions.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>אין עסקאות</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                <tr>
                  <th style={TH}>תאריך</th>
                  <th style={{ ...TH, width: '42%' }}>פירוט</th>
                  <th style={TH}>סכום</th>
                  <th style={TH}>קטגוריה</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => {
                  const currentCat = tx.merchant ? (cats[tx.merchant] ?? 'other') : null;
                  return (
                    <tr key={`${tx.type}_${tx.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={TD}>{tx.date?.slice(0, 10)}</td>
                      <td style={{ ...TD, color: '#1e293b' }}>{tx.merchant || '—'}</td>
                      <td style={{ ...TD, fontWeight: 500 }}>{fmt(tx.amount)}</td>
                      <td style={TD}>
                        {tx.merchant ? (
                          <select
                            value={currentCat}
                            onChange={e => handleChange(tx.merchant, e.target.value)}
                            style={{
                              fontSize: '0.72rem', borderRadius: '0.25rem',
                              padding: '0.1rem 0.2rem', width: '100%',
                              border: '1px solid #e2e8f0', background: '#f8fafc',
                            }}
                          >
                            {CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>
                                {CATEGORY_LABELS[cat].emoji} {CATEGORY_LABELS[cat].label}
                              </option>
                            ))}
                          </select>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
