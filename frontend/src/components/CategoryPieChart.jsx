import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer } from 'recharts';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../categories';
import { fetchCategoryBreakdown, fetchDrillDown } from '../api';
import DrillDownModal from './DrillDownModal';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const cat = CATEGORY_LABELS[d.category];
  return (
    <div className="chart-tooltip">
      <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
        {cat ? `${cat.emoji} ${cat.label}` : d.category}
      </p>
      <p>{fmt(d.amount)}</p>
      <p>{d.percentage}%</p>
    </div>
  );
}

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, percentage }) {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${percentage}%`}
    </text>
  );
}

function renderActiveShape(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

export default function CategoryPieChart({ periods }) {
  const [periodFilter, setPeriodFilter] = useState(
    () => localStorage.getItem('insights_pie_period') || 'current'
  );
  const [ownerFilter, setOwnerFilter] = useState(
    () => localStorage.getItem('insights_pie_owner') || 'both'
  );
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [resolvedPeriod, setResolvedPeriod] = useState(null);
  const [drill, setDrill]             = useState(null);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('insights_pie_period', periodFilter);
    localStorage.setItem('insights_pie_owner', ownerFilter);
    setLoading(true);
    setError(null);
    setActiveIndex(null);
    fetchCategoryBreakdown(periodFilter, ownerFilter)
      .then(res => {
        setData(res.data || []);
        setResolvedPeriod(res.period || periodFilter);
        setLoading(false);
      })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [periodFilter, ownerFilter]);

  async function openDrill(category) {
    setDrillLoading(true);
    try {
      const period = resolvedPeriod || 'all';
      const txs = await fetchDrillDown(category, period, ownerFilter);
      const cat = CATEGORY_LABELS[category];
      setDrill({
        transactions: txs,
        title: cat ? `${cat.emoji} ${cat.label}` : category,
        total: txs.reduce((s, tx) => s + tx.amount, 0),
      });
    } catch (err) {
      console.error('Drill-down failed:', err);
    } finally {
      setDrillLoading(false);
    }
  }

  function refreshData() {
    fetchCategoryBreakdown(periodFilter, ownerFilter)
      .then(res => { setData(res.data || []); setResolvedPeriod(res.period || periodFilter); })
      .catch(() => {});
  }

  return (
    <>
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <h3 className="card-title" style={{ margin: 0 }}>פירוט הוצאות לפי קטגוריה</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
            <option value="current">תקופה נוכחית</option>
            <option value="all">כל התקופות</option>
            {periods.map(p => (
              <option key={p.period} value={p.period}>{p.label}</option>
            ))}
          </select>
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
            <option value="both">שנינו</option>
            <option value="sagi">שגיא</option>
            <option value="maya">מאיה</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>טוען...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>{error}</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>אין נתונים לתקופה זו</div>
      ) : (
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 320px' }}>
            <ResponsiveContainer width={320} height={320}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={130}
                  labelLine={false}
                  label={renderCustomLabel}
                  activeIndex={activeIndex !== null ? activeIndex : undefined}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(entry) => entry?.category && openDrill(entry.category)}
                  style={{ cursor: drillLoading ? 'wait' : 'pointer' }}
                >
                  {data.map(entry => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ flex: '1 1 240px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>קטגוריה</th>
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>סכום</th>
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>אחוז</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry, i) => {
                  const cat = CATEGORY_LABELS[entry.category];
                  const isActive = activeIndex === i;
                  const color = CATEGORY_COLORS[entry.category] || '#94a3b8';
                  return (
                    <tr
                      key={entry.category}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(null)}
                      onClick={() => openDrill(entry.category)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isActive ? `${color}18` : 'transparent',
                        cursor: drillLoading ? 'wait' : 'pointer',
                        transition: 'background 0.12s',
                      }}
                    >
                      <td style={{ padding: '0.45rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: isActive ? 600 : 400 }}>
                          {cat ? `${cat.emoji} ${cat.label}` : entry.category}
                        </span>
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: isActive ? 600 : 400 }}>
                        {fmt(entry.amount)}
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', color: '#64748b' }}>
                        {entry.percentage}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>

    {drill && (
      <DrillDownModal
        transactions={drill.transactions}
        title={drill.title}
        total={drill.total}
        onClose={() => setDrill(null)}
        onCategoryChanged={refreshData}
      />
    )}
    </>
  );
}
