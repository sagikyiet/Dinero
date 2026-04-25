import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

const CARD_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

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

const fmtFull = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function ValidationIndicator({ bankCCTotal, ccFilesTotal, ccFilesCount }) {
  const [tipPos, setTipPos] = useState(null);
  const iconRef = useRef(null);

  let icon, tipText, cls;
  if (ccFilesCount === 0) {
    icon = 'ℹ';
    tipText = 'לא הועלו קבצי אשראי לתקופה זו';
    cls = 'cc-valid-none';
  } else {
    const gap = Math.round((ccFilesTotal - bankCCTotal) * 100) / 100;
    if (Math.abs(gap) < 0.01) {
      icon = '✓';
      tipText = 'הסכומים תואמים';
      cls = 'cc-valid-ok';
    } else {
      icon = '⚠';
      tipText = `פער של ${fmtFull(Math.abs(gap))} בין חיובי העו"ש לקבצי האשראי שהועלו`;
      cls = 'cc-valid-warn';
    }
  }

  function handleMouseEnter() {
    if (!iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    setTipPos({ top: r.top - 8, centerX: r.left + r.width / 2 });
  }

  function handleMouseLeave() {
    setTipPos(null);
  }

  return (
    <span
      ref={iconRef}
      className={`cc-valid-wrap ${cls}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {icon}
      {tipPos && createPortal(
        <span
          className="cc-valid-tip"
          style={{ '--tip-center-x': `${tipPos.centerX}px`, '--tip-top': `${tipPos.top}px` }}
        >
          {tipText}
        </span>,
        document.body
      )}
    </span>
  );
}

export default function CreditCardBreakdown({ cards, bankCCTotal = 0, ccFilesTotal = 0, ccFilesCount = 0 }) {
  const [ownerFilter, setOwnerFilter] = useState('all');

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
          const ownerDef = card.owner ? OWNERS[card.owner] : null;

          return (
            <div key={`${card.card_name}-${card.owner}`} className="cc-item">
              <div className="cc-meta">
                <span className="cc-dot" style={{ background: CARD_COLORS[i % CARD_COLORS.length] }} />
                <span className="cc-name">{card.card_name}</span>
                {ownerDef && (
                  <span
                    className="badge"
                    style={{ background: ownerDef.bg, color: ownerDef.color, fontSize: '0.75rem' }}
                  >
                    {ownerDef.label}
                  </span>
                )}
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
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {fmt(ownerFilter === 'all' ? bankCCTotal : total)}
          {ownerFilter === 'all' && (
            <ValidationIndicator
              bankCCTotal={bankCCTotal}
              ccFilesTotal={ccFilesTotal}
              ccFilesCount={ccFilesCount}
            />
          )}
        </span>
      </div>
    </div>
  );
}
