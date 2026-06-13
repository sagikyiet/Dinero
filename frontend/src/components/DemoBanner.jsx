import { useState } from 'react';

export default function DemoBanner({ onReset, onExit }) {
  const [loading, setLoading] = useState(null);

  async function handle(action, cb) {
    setLoading(action);
    try { await cb(); }
    finally { setLoading(null); }
  }

  return (
    <div className="demo-banner">
      <span className="demo-banner-text">
        מצב דמו פעיל — הנתונים המוצגים הם לצורכי הדגמה בלבד
      </span>
      <div className="demo-banner-actions">
        <button
          className="btn-demo-action"
          disabled={loading !== null}
          onClick={() => handle('reset', onReset)}
        >
          {loading === 'reset' ? 'טוען...' : 'אפס דמו'}
        </button>
        <button
          className="btn-demo-action exit"
          disabled={loading !== null}
          onClick={() => handle('exit', onExit)}
        >
          {loading === 'exit' ? 'יוצא...' : 'צא ממצב דמו'}
        </button>
      </div>
    </div>
  );
}
