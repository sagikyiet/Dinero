import { useState, useEffect, useMemo } from 'react';
import { updateMonth } from '../api';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtExact = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(n ?? 0);

export default function SavingsInput({ monthId, notes, transactions = [], onUpdate }) {
  const [notesText, setNotesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNotesText(notes || '');
  }, [notes, monthId]);

  const savingsTxs = useMemo(
    () => transactions.filter(tx => tx.tag === 'savings'),
    [transactions]
  );

  const total = useMemo(
    () => savingsTxs.reduce((s, tx) => s + (tx.debit || 0) + (tx.credit || 0), 0),
    [savingsTxs]
  );

  async function handleSave() {
    setSaving(true);
    try {
      await updateMonth(monthId, { notes: notesText });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onUpdate();
    } catch (e) {
      alert('שגיאה בשמירה: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3 className="card-title">חיסכון והערות</h3>
      <div className="savings-form">

        <div className="savings-total-block">
          <span className="savings-total-label">חיסכון החודש</span>
          <span className="savings-total-amount">{fmt(total)}</span>
        </div>

        {savingsTxs.length > 0 && (
          <div className="savings-tx-list">
            {savingsTxs.map(tx => (
              <div key={tx.id} className="savings-tx-row">
                <span className="savings-tx-date">{tx.date?.slice(0, 10)}</span>
                <span className="savings-tx-desc">{tx.description}</span>
                <span className="savings-tx-amount">
                  {fmtExact((tx.debit || 0) + (tx.credit || 0))}
                </span>
              </div>
            ))}
          </div>
        )}

        {savingsTxs.length === 0 && (
          <p className="savings-empty">
            תייג פעולות כ"חיסכון" בטבלת הפעולות כדי שיופיעו כאן
          </p>
        )}

        <div className="form-group">
          <label>הערות לחודש</label>
          <textarea
            className="notes-input"
            placeholder="הערות, אירועים מיוחדים..."
            value={notesText}
            onChange={e => setNotesText(e.target.value)}
            rows={3}
          />
        </div>

        <button
          className={`btn-primary${saved ? ' btn-saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? '✓ נשמר' : saving ? 'שומר...' : 'שמור הערות'}
        </button>
      </div>
    </div>
  );
}
