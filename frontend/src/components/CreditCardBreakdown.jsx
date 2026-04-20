import { useState } from 'react';
import { setCardOwner } from '../api';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

const CARD_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
const BANK_LABELS = { leumi: 'לאומי', hapoalim: 'פועלים' };

const OWNERS = {
  sagi:  { label: 'שגיא', color: '#059669', bg: '#ecfdf5' },
  maya:  { label: 'מאיה', color: '#0284c7', bg: '#f0f9ff' },
  joint: { label: 'משותף', color: '#7c3aed', bg: '#f5f3ff' },
};

const FILTER_OPTIONS = [
  { value: 'all',   label: 'הכל' },
  { value: 'sagi',  label: 'שגיא' },
  { value: 'maya',  label: 'מאיה' },
  { value: 'joint', label: 'משותף' },
];

export default function CreditCardBreakdown({ cards, onUpdate }) {
  const [ownerFilter, setOwnerFilter] = useState('all');

  async function handleOwnerChange(card, newOwner) {
    try {
      await setCardOwner(card.credit_card_name, card.bank, newOwner);
      onUpdate?.();
    } catch (e) {
      alert('שגיאה: ' + e.message);
    }
  }

  const filtered = ownerFilter === 'all'
    ? cards
    : cards.filter(c => c.owner === ownerFilter);

  const total = filtered.reduce((s, c) => s + c.total, 0);
  const grandTotal = cards.reduce((s, c) => s + c.total, 0);

  return (
    <div className="card">
      <div className="cc-header">
        <h3 className="card-title" style={{ marginBottom: 0 }}>חיובי כרטיסי אשראי</h3>
        <div className="cc-filter-pills">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`cc-filter-pill${ownerFilter === opt.value ? ' active' : ''}`}
              onClick={() => setOwnerFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cc-list">
        {filtered.map((card, i) => {
          const pct = grandTotal > 0 ? (card.total / grandTotal) * 100 : 0;
          const bankLabel = BANK_LABELS[card.bank] ?? card.bank;
          const displayName = `${card.credit_card_name} ${bankLabel}`;
          const ownerDef = card.owner ? OWNERS[card.owner] : null;

          return (
            <div key={`${card.credit_card_name}-${card.bank}`} className="cc-item">
              <div className="cc-meta">
                <span className="cc-dot" style={{ background: CARD_COLORS[i % CARD_COLORS.length] }} />
                <span className="cc-name">{displayName}</span>
                <select
                  className="cc-owner-select"
                  style={ownerDef
                    ? { background: ownerDef.bg, color: ownerDef.color, borderColor: ownerDef.color }
                    : {}
                  }
                  value={card.owner || ''}
                  onChange={e => handleOwnerChange(card, e.target.value)}
                >
                  <option value="" disabled>בעלות</option>
                  <option value="sagi">שגיא</option>
                  <option value="maya">מאיה</option>
                  <option value="joint">משותף</option>
                </select>
                <span className="cc-amount">{fmt(card.total)}</span>
                <span className="cc-pct">{pct.toFixed(0)}%</span>
              </div>
              <div className="cc-bar-track">
                <div
                  className="cc-bar-fill"
                  style={{ width: `${pct}%`, background: CARD_COLORS[i % CARD_COLORS.length] }}
                />
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
            אין כרטיסים לסינון זה
          </p>
        )}
      </div>

      <div className="cc-total">
        <span>סה"כ{ownerFilter !== 'all' ? ` (${OWNERS[ownerFilter]?.label})` : ' כרטיסים'}</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
}
