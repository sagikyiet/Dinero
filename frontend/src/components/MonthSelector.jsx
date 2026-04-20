import { useState } from 'react';
import { deleteMonth } from '../api';

const MONTH_NAMES = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];

export default function MonthSelector({ months, selectedId, onSelect, onDeleted }) {
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function handleDelete(e, monthId) {
    e.stopPropagation();
    if (confirmDelete === monthId) {
      try {
        await deleteMonth(monthId);
        setConfirmDelete(null);
        onDeleted();
      } catch (err) {
        alert('שגיאה במחיקה: ' + err.message);
      }
    } else {
      setConfirmDelete(monthId);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  }

  if (months.length === 0) {
    return (
      <div className="sidebar-empty">
        <p>אין חודשים</p>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>העלה קבצים כדי להתחיל</p>
      </div>
    );
  }

  // Group by year
  const byYear = months.reduce((acc, m) => {
    (acc[m.year] = acc[m.year] || []).push(m);
    return acc;
  }, {});

  return (
    <div className="month-selector">
      <h3 className="sidebar-title">חודשים</h3>
      {Object.entries(byYear)
        .sort(([a], [b]) => b - a)
        .map(([year, ms]) => (
          <div key={year} className="year-group">
            <div className="year-label">{year}</div>
            {ms.map(m => (
              <div
                key={m.id}
                className={`month-item${m.id === selectedId ? ' active' : ''}`}
                onClick={() => onSelect(m.id)}
              >
                <span className="month-name">{MONTH_NAMES[m.month - 1]}</span>
                <span className="month-count">{m.transaction_count} פע׳</span>
                <button
                  className={`month-delete${confirmDelete === m.id ? ' confirm' : ''}`}
                  onClick={(e) => handleDelete(e, m.id)}
                  title={confirmDelete === m.id ? 'לחץ שוב למחיקה' : 'מחיקת חודש'}
                >
                  {confirmDelete === m.id ? '!' : '×'}
                </button>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
