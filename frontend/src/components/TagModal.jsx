import { useState, useEffect } from 'react';
import { getTagLabels } from '../tags';
import { tagTransaction, fetchEvents, createEvent } from '../api';

const TAG_ROWS = [
  ['salary_sagi', 'salary_maya', 'savings'],
  ['large_income', 'large_expense', 'routine_income', 'routine_expense'],
];

const EVENT_REQUIRED_TAGS = new Set(['large_income', 'large_expense']);

export default function TagModal({ tx, txs, onClose, onSaved, tagFn, bulkTagFn, demoNames = {} }) {
  const TAGS = getTagLabels(demoNames);
  const isBulk = Array.isArray(txs);

  // Fix 2: tags disallowed based on transaction direction. In bulk mode, a tag
  // is disabled if it would be invalid for ANY of the selected transactions.
  const disabledTags = isBulk
    ? new Set([
        ...(txs.some(t => t.debit > 0) ? ['large_income', 'routine_income'] : []),
        ...(txs.some(t => t.credit > 0) ? ['large_expense', 'routine_expense'] : []),
      ])
    : tx.debit
      ? new Set(['large_income', 'routine_income'])
      : tx.credit
        ? new Set(['large_expense', 'routine_expense'])
        : new Set();

  // Auto-deselect if the existing tag is now invalid for this transaction's direction.
  // Bulk mode always starts unselected since the selection can mix existing tags.
  const [selected, setSelected] = useState(() => {
    if (isBulk) return null;
    const initial = tx.tag ?? null;
    return (initial && disabledTags.has(initial)) ? null : initial;
  });
  const [permanent, setPermanent] = useState(false);
  const [saving, setSaving] = useState(false);

  // Event combobox state
  const [events, setEvents] = useState([]);
  const [eventQuery, setEventQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const applyTag = tagFn ?? tagTransaction;

  useEffect(() => {
    fetchEvents()
      .then(list => {
        setEvents(list);
        if (!isBulk && tx.event_id) {
          const found = list.find(e => e.id === tx.event_id);
          if (found) { setSelectedEvent(found); setEventQuery(found.name); }
        }
      })
      .catch(() => {});
  }, []);

  const filteredEvents = events.filter(e =>
    !eventQuery || e.name.includes(eventQuery)
  );

  // Fix 1: event is required for the four special tag types
  const needsEvent = selected && EVENT_REQUIRED_TAGS.has(selected);
  const eventMissing = needsEvent && !eventQuery.trim();

  function handleEventInput(val) {
    setEventQuery(val);
    setSelectedEvent(null);
    setShowDropdown(true);
    setHighlightIdx(-1);
  }

  function handleEventSelect(ev) {
    setSelectedEvent(ev);
    setEventQuery(ev.name);
    setShowDropdown(false);
    setHighlightIdx(-1);
  }

  // Fix 3: keyboard navigation in dropdown
  function handleKeyDown(e) {
    if (!showDropdown || filteredEvents.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, filteredEvents.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      handleEventSelect(filteredEvents[highlightIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowDropdown(false);
      setHighlightIdx(-1);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      let eventId = null;
      if (selectedEvent) {
        eventId = selectedEvent.id;
      } else if (eventQuery.trim()) {
        const created = await createEvent(eventQuery.trim());
        eventId = created.id;
      }
      if (isBulk) {
        console.log('[TagModal] bulk saving', { txIds: txs.map(t => t.id), tag: selected, event_id: eventId });
        await bulkTagFn(txs.map(t => t.id), selected, eventId);
      } else {
        console.log('[TagModal] saving', { txId: tx.id, tag: selected, permanent, event_id: eventId });
        await applyTag(tx.id, selected, permanent, tx.tag_note ?? '', eventId);
      }
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
          <h3>{isBulk ? 'תיוג מספר פעולות' : 'תיוג פעולה'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="tag-modal-body">
          <p className="tag-modal-desc">{isBulk ? `תיוג ${txs.length} פעולות נבחרות` : tx.description}</p>

          <div className="tag-options">
            {TAG_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="tag-row">
                {row.map(key => {
                  const { label, color, bg } = TAGS[key];
                  const isDisabled = disabledTags.has(key);
                  return (
                    <button
                      key={key}
                      className={`tag-option${selected === key ? ' selected' : ''}${isDisabled ? ' tag-option-disabled' : ''}`}
                      style={isDisabled ? undefined : { '--tag-color': color, '--tag-bg': bg }}
                      onClick={() => !isDisabled && setSelected(selected === key ? null : key)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
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

          {selected && (
            <div className="form-group event-combobox-wrap">
              <label>שם אירוע</label>
              <div className="event-combobox">
                <input
                  className={`tag-note-input${eventMissing ? ' input-error' : ''}`}
                  type="text"
                  placeholder="חפש אירוע קיים או הזן שם חדש..."
                  value={eventQuery}
                  onChange={e => handleEventInput(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                />
                {showDropdown && filteredEvents.length > 0 && (
                  <div className="event-dropdown">
                    {filteredEvents.map((ev, idx) => (
                      <div
                        key={ev.id}
                        ref={idx === highlightIdx ? el => el?.scrollIntoView({ block: 'nearest' }) : null}
                        className={`event-dropdown-item${idx === highlightIdx ? ' highlighted' : ''}${selectedEvent?.id === ev.id ? ' active' : ''}`}
                        onMouseDown={() => handleEventSelect(ev)}
                        onMouseEnter={() => setHighlightIdx(idx)}
                      >
                        {ev.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {eventMissing && (
                <p className="event-field-error">נדרש שם אירוע עבור הכנסה גדולה והוצאה גדולה</p>
              )}
              {selectedEvent && (
                <button
                  type="button"
                  className="event-clear-btn"
                  onClick={() => { setSelectedEvent(null); setEventQuery(''); }}
                >
                  ✕ הסר אירוע
                </button>
              )}
            </div>
          )}

          {!isBulk && (
            <label className="tag-permanent-label">
              <input
                type="checkbox"
                checked={permanent}
                onChange={e => setPermanent(e.target.checked)}
              />
              <span>זכור תיוג זה לפעולות דומות (אותו תיאור, ±2 ימים מדי חודש)</span>
            </label>
          )}

          <div className="form-actions" style={{ marginTop: '1.25rem' }}>
            <button className="btn-secondary" onClick={onClose}>ביטול</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !!eventMissing}>
              {saving ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
