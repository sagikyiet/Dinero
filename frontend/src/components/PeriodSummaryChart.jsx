import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fetchPeriodSummary } from '../api';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

const fmtShort = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}₪${(abs / 1000).toFixed(0)}K`;
  return `${sign}₪${Math.round(abs)}`;
};

const METRICS = [
  { key: 'הכנסות', color: '#10b981' },
  { key: 'הוצאות', color: '#ef4444' },
  { key: 'מאזן',   color: '#3b82f6' },
  { key: 'חיסכון', color: '#8b5cf6' },
];

function SummaryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.fill }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function PeriodSummaryChart() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [visible, setVisible] = useState(() => {
    try {
      const saved = localStorage.getItem('insights_period_visible');
      return saved ? JSON.parse(saved) : Object.fromEntries(METRICS.map(m => [m.key, true]));
    } catch {
      return Object.fromEntries(METRICS.map(m => [m.key, true]));
    }
  });

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPeriodSummary()
      .then(res => { setData(res); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, []);

  function toggle(key) {
    setVisible(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('insights_period_visible', JSON.stringify(next));
      return next;
    });
  }

  const visibleMetrics = METRICS.filter(m => visible[m.key]);

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <h3 className="card-title" style={{ margin: 0 }}>מגמה לפי תקופות</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              style={{
                fontSize: '0.72rem',
                padding: '0.18rem 0.6rem',
                borderRadius: '999px',
                border: `1.5px solid ${m.color}`,
                background: visible[m.key] ? m.color : 'transparent',
                color: visible[m.key] ? '#fff' : m.color,
                cursor: 'pointer',
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {m.key}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>טוען...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>{error}</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>אין נתונים</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
            <Tooltip content={<SummaryTooltip />} />
            <Legend />
            {visibleMetrics.map(m => (
              <Bar key={m.key} dataKey={m.key} fill={m.color} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
