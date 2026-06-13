import { useState, useEffect, useRef } from 'react';
import { fetchEventsSummary, fetchEventTransactions, deleteEvent, updateEvent } from '../api';
import { TAGS } from '../tags';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(n);

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function formatDateRange(earliest, latest) {
  if (!earliest || !latest) return '';
  const [ey, em] = earliest.slice(0, 7).split('-');
  const [ly, lm] = latest.slice(0, 7).split('-');
  const startLabel = `${HE_MONTHS[parseInt(em, 10) - 1]} ${ey}`;
  if (ey === ly && em === lm) return startLabel;
  return `${startLabel} — ${HE_MONTHS[parseInt(lm, 10) - 1]} ${ly}`;
}

function ConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">מחיקת אירוע</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div style={{ padding: '1rem 1.25rem', color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          האם אתה בטוח? מחיקת האירוע תסיר את השיוך שלו מכל הפעולות בכל התקופות.
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', padding: '0.75rem 1.25rem 1rem' }}>
          <button className="btn-secondary" onClick={onCancel}>ביטול</button>
          <button className="btn-danger" onClick={onConfirm}>מחק</button>
        </div>
      </div>
    </div>
  );
}

function EventCard({ ev, onDeleted, onUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const [txs, setTxs] = useState(null);
  const [txLoading, setTxLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(ev.name);
  const [saving, setSaving] = useState(false);
  const editingRef = useRef(false);

  async function toggle() {
    if (editing) return;
    const next = !expanded;
    setExpanded(next);
    if (next && txs === null) {
      setTxLoading(true);
      try {
        const data = await fetchEventTransactions(ev.id);
        setTxs(data);
      } catch (_) {
        setTxs([]);
      } finally {
        setTxLoading(false);
      }
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteEvent(ev.id);
      onDeleted(ev.id);
    } catch (e) {
      alert('שגיאה: ' + e.message);
      setDeleting(false);
    }
    setShowConfirm(false);
  }

  function startEdit(e) {
    e.stopPropagation();
    setEditName(ev.name);
    editingRef.current = false;
    setEditing(true);
  }

  async function saveName() {
    if (editingRef.current) return;
    editingRef.current = true;
    const trimmed = editName.trim();
    if (!trimmed || trimmed === ev.name) {
      setEditing(false);
      editingRef.current = false;
      return;
    }
    setSaving(true);
    try {
      const updated = await updateEvent(ev.id, trimmed);
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      alert('שגיאה: ' + e.message);
      editingRef.current = false;
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveName(); }
    if (e.key === 'Escape') { setEditing(false); editingRef.current = false; }
  }

  const amountClass = ev.total_amount >= 0 ? 'ev-amount-pos' : 'ev-amount-neg';
  const dateRange = formatDateRange(ev.earliest_date, ev.last_updated);

  return (
    <>
      {showConfirm && (
        <ConfirmDialog
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      <div className="card ev-card">
        <div className="ev-header" onClick={toggle}>
          <span className="ev-chevron">{expanded ? '▼' : '▶'}</span>
          <div className="ev-name-block">
            <div className="ev-name-row">
              {editing ? (
                <input
                  className="ev-name-input"
                  value={editName}
                  autoFocus
                  disabled={saving}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={handleKeyDown}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="ev-name">{ev.name}</span>
              )}
              {!editing && (
                <button
                  className="ev-icon-btn"
                  title="עריכת שם"
                  onClick={startEdit}
                >
                  ✎
                </button>
              )}
              <button
                className="ev-icon-btn ev-delete-btn"
                title="מחיקת אירוע"
                disabled={deleting}
                onClick={e => { e.stopPropagation(); setShowConfirm(true); }}
              >
                ✕
              </button>
            </div>
            {dateRange && <span className="ev-date-range">{dateRange}</span>}
          </div>
          <span className="ev-count">{ev.transaction_count} פעולות</span>
          <span className="ev-total-label">סה״כ</span>
          <span className={`ev-total-amount ${amountClass}`}>{fmt(ev.total_amount)}</span>
        </div>

        {expanded && (
          <div className="ev-body">
            {txLoading ? (
              <div className="ev-placeholder">טוען...</div>
            ) : txs && txs.length > 0 ? (
              <table className="ev-table">
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>תיאור</th>
                    <th>סכום</th>
                    <th>תיוג</th>
                    <th>מקור</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((tx, i) => {
                    const net = (tx.credit ?? 0) - (tx.debit ?? 0);
                    const tag = tx.tag ? TAGS[tx.tag] : null;
                    return (
                      <tr key={i}>
                        <td className="ev-td-date">{tx.date?.slice(0, 10)}</td>
                        <td className="ev-td-desc" title={tx.description}>{tx.description}</td>
                        <td className={`ev-td-amount ${net >= 0 ? 'ev-amount-pos' : 'ev-amount-neg'}`}>
                          {fmt(net)}
                        </td>
                        <td>
                          {tag && (
                            <span className="badge badge-tag" style={{ background: tag.bg, color: tag.color }}>
                              {tag.label}
                            </span>
                          )}
                        </td>
                        <td className="ev-td-source">{tx.bank}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="ev-placeholder">אין פעולות לאירוע זה</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEventsSummary()
      .then(data => { setEvents(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  function handleDeleted(id) {
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  function handleUpdated(updated) {
    setEvents(prev => prev.map(e => e.id === updated.id ? { ...e, name: updated.name } : e));
  }

  if (loading) return <div className="loading">טוען...</div>;
  if (error) return <div className="error-banner">{error}</div>;

  return (
    <div className="ev-page">
      <h2 className="ev-page-title">אירועים</h2>

      {events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🗓</div>
          <h2>עדיין לא נוצרו אירועים</h2>
          <p>תייג פעולות עם שם אירוע כדי להתחיל.</p>
        </div>
      ) : (
        events.map(ev => (
          <EventCard
            key={ev.id}
            ev={ev}
            onDeleted={handleDeleted}
            onUpdated={handleUpdated}
          />
        ))
      )}
    </div>
  );
}
