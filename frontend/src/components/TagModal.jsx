import { useState } from 'react';
import { TAGS } from '../tags';
import { tagTransaction } from '../api';

export default function TagModal({ tx, onClose, onSaved }) {
  const [selected, setSelected] = useState(tx.tag ?? null);
  const [permanent, setPermanent] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await tagTransaction(tx.id, selected, permanent);
      onSaved();
      onClose();
    } catch (e) {
      alert('שגיאה: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>תיוג פעולה</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="tag-modal-body">
          <p className="tag-modal-desc">{tx.description}</p>

          <div className="tag-options">
            {Object.entries(TAGS).map(([key, { label, color, bg }]) => (
              <button
                key={key}
                className={`tag-option${selected === key ? ' selected' : ''}`}
                style={{ '--tag-color': color, '--tag-bg': bg }}
                onClick={() => setSelected(selected === key ? null : key)}
              >
                {label}
              </button>
            ))}
            {selected && (
              <button
                className="tag-option tag-option-clear"
                onClick={() => setSelected(null)}
              >
                ✕ הסר תיוג
              </button>
            )}
          </div>

          <label className="tag-permanent-label">
            <input
              type="checkbox"
              checked={permanent}
              onChange={e => setPermanent(e.target.checked)}
            />
            <span>זכור תיוג זה לפעולות דומות (אותו תיאור, ±2 ימים מדי חודש)</span>
          </label>

          <div className="form-actions" style={{ marginTop: '1.25rem' }}>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
