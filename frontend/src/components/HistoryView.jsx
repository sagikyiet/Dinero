import CategoryPieChart from './CategoryPieChart';
import CategoryStackedBar from './CategoryStackedBar';
import PeriodSummaryChart from './PeriodSummaryChart';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);

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

  const periods = history.map(m => ({
    period: `${m.year}-${String(m.month).padStart(2, '0')}`,
    label: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
  }));

  return (
    <div className="history-view">
      <h2 className="month-heading" style={{ marginBottom: '1.5rem' }}>תובנות</h2>

      <PeriodSummaryChart />
      <div style={{ marginBottom: '1.5rem' }}><CategoryStackedBar /></div>
      <CategoryPieChart periods={periods} />

      <div className="card">
        <h3 className="card-title">טבלת סיכום</h3>
        <div className="table-wrap">
          <table className="tx-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '19.5%' }} />
              <col style={{ width: '19.5%' }} />
              <col style={{ width: '19.5%' }} />
              <col style={{ width: '19.5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>חודש</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>הכנסות</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>הוצאות</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>מאזן</th>
                <th style={{ textAlign: 'right', padding: '0.5rem' }}>חיסכון</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map(m => {
                const balance = m.total_income - m.total_expenses;
                return (
                  <tr key={m.id}>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                      {MONTH_NAMES[m.month - 1]} {m.year}
                    </td>
                    <td className="credit-col" style={{ textAlign: 'right', padding: '0.5rem' }}>
                      {fmt(m.total_income)}
                    </td>
                    <td className="debit-col" style={{ textAlign: 'right', padding: '0.5rem' }}>
                      {fmt(m.total_expenses)}
                    </td>
                    <td
                      className={balance >= 0 ? 'credit-col' : 'debit-col'}
                      style={{ textAlign: 'right', padding: '0.5rem' }}
                    >
                      {fmt(balance)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                      {m.savings_tagged > 0 ? fmt(m.savings_tagged) : '—'}
                    </td>
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
