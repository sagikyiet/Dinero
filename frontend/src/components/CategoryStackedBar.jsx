import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { CATEGORIES, CATEGORY_LABELS } from '../categories';
import { fetchCategoryTrend, fetchDrillDown } from '../api';
import DrillDownModal from './DrillDownModal';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

const fmtShort = (n) => {
  if (n >= 1000) return `₪${(n / 1000).toFixed(0)}K`;
  return `₪${Math.round(n)}`;
};

const SOURCE_OPTIONS = [
  { value: 'all',     label: 'כל ההוצאות' },
  { value: 'bank',    label: 'בנק בלבד (ללא כרטיסים)' },
  { value: 'cc',      label: 'כרטיסי אשראי (מחשבון הבנק)' },
  { value: 'special', label: 'מיוחדות בלבד' },
  ...CATEGORIES.map(cat => ({
    value: cat,
    label: `${CATEGORY_LABELS[cat].emoji} ${CATEGORY_LABELS[cat].label}`,
  })),
];

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      <p style={{ color: '#6366f1', fontWeight: 600 }}>{fmt(payload[0].value)}</p>
    </div>
  );
}

export default function CategoryStackedBar() {
  const [sourceFilter, setSourceFilter] = useState(
    () => localStorage.getItem('insights_trend_source') || 'all'
  );
  const [result, setResult]     = useState({ periods: [] });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [drill, setDrill]       = useState(null);
  const [drillLoading, setDrillLoading] = useState(false);

  async function openDrill(barData) {
    setDrillLoading(true);
    try {
      const txs = await fetchDrillDown(sourceFilter, barData.period);
      const srcOpt = SOURCE_OPTIONS.find(o => o.value === sourceFilter);
      setDrill({
        transactions: txs,
        title: `${srcOpt?.label || sourceFilter} — ${barData.label}`,
        total: txs.reduce((s, tx) => s + tx.amount, 0),
      });
    } catch (err) {
      console.error('Drill-down failed:', err);
    } finally {
      setDrillLoading(false);
    }
  }

  function refreshData() {
    fetchCategoryTrend(sourceFilter)
      .then(res => setResult(res))
      .catch(() => {});
  }

  useEffect(() => {
    localStorage.setItem('insights_trend_source', sourceFilter);
    setLoading(true);
    setError(null);
    fetchCategoryTrend(sourceFilter)
      .then(res => { setResult(res); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [sourceFilter]);

  const { periods } = result;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <h3 className="card-title" style={{ margin: 0 }}>התפלגות הוצאות לפי תקופה</h3>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          {SOURCE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>טוען...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>{error}</div>
      ) : periods.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>אין נתונים</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={periods} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
            <Tooltip content={<TrendTooltip />} />
            <Bar
              dataKey="total"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              name="סה״כ"
              maxBarSize={80}
              onClick={(barData) => barData?.period && openDrill(barData)}
              style={{ cursor: drillLoading ? 'wait' : 'pointer' }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}

      {drill && (
        <DrillDownModal
          transactions={drill.transactions}
          title={drill.title}
          total={drill.total}
          onClose={() => setDrill(null)}
          onCategoryChanged={refreshData}
        />
      )}
    </div>
  );
}
