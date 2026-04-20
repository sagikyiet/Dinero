import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line,
} from 'recharts';

const MONTH_NAMES = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

const fmtShort = (n) => {
  if (n >= 1000) return `₪${(n / 1000).toFixed(0)}K`;
  return `₪${Math.round(n)}`;
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function HistoryView({ history }) {
  if (!history.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <h3>אין מספיק נתונים להיסטוריה</h3>
        <p>העלה לפחות חודש אחד כדי לראות נתונים</p>
      </div>
    );
  }

  const chartData = history.map(m => ({
    name: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
    הכנסות: Math.round(m.total_income),
    הוצאות: Math.round(m.total_expenses),
    מאזן: Math.round(m.total_income - m.total_expenses),
    חיסכון: Math.round(m.savings || 0),
  }));

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];

  return (
    <div className="history-view">
      <h2 className="month-heading" style={{ marginBottom: '1.5rem' }}>היסטוריה חודשית</h2>

      {prev && (
        <div className="comparison-bar">
          <span>השוואה: {MONTH_NAMES[latest.month - 1]} {latest.year} לעומת {MONTH_NAMES[prev.month - 1]} {prev.year}</span>
          <div className="comparison-items">
            <CompareItem
              label="הכנסות"
              current={latest.total_income}
              previous={prev.total_income}
              positiveIsGood
            />
            <CompareItem
              label="הוצאות"
              current={latest.total_expenses}
              previous={prev.total_expenses}
              positiveIsGood={false}
            />
            <CompareItem
              label="מאזן"
              current={latest.total_income - latest.total_expenses}
              previous={prev.total_income - prev.total_expenses}
              positiveIsGood
            />
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="card-title">הכנסות והוצאות לפי חודש</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="הכנסות" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="הוצאות" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="card-title">מאזן חודשי</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="מאזן" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="חיסכון" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="card-title">טבלת סיכום</h3>
        <div className="table-wrap">
          <table className="tx-table">
            <thead>
              <tr>
                <th>חודש</th>
                <th className="num-col">הכנסות</th>
                <th className="num-col">הוצאות</th>
                <th className="num-col">מאזן</th>
                <th className="num-col">חיסכון</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map(m => {
                const balance = m.total_income - m.total_expenses;
                return (
                  <tr key={m.id}>
                    <td>{MONTH_NAMES[m.month - 1]} {m.year}</td>
                    <td className="num-col credit-col">{fmt(m.total_income)}</td>
                    <td className="num-col debit-col">{fmt(m.total_expenses)}</td>
                    <td className={`num-col ${balance >= 0 ? 'credit-col' : 'debit-col'}`}>{fmt(balance)}</td>
                    <td className="num-col">{m.savings > 0 ? fmt(m.savings) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CompareItem({ label, current, previous, positiveIsGood }) {
  const diff = current - previous;
  const pct = previous !== 0 ? ((diff / Math.abs(previous)) * 100).toFixed(1) : null;
  const isPositive = diff > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;

  return (
    <div className="compare-item">
      <span className="compare-label">{label}</span>
      <span className="compare-value">{new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(current)}</span>
      {diff !== 0 && (
        <span className={`compare-delta ${isGood ? 'good' : 'bad'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(diff).toLocaleString('he-IL')}
          {pct && ` (${Math.abs(pct)}%)`}
        </span>
      )}
    </div>
  );
}
