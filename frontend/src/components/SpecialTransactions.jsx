import { useMemo } from 'react';
import { TAGS, isSalaryTag } from '../tags';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(n);

function Section({ title, rows, amountKey, amountClass, headerClass }) {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, tx) => s + (tx[amountKey] || 0), 0);
  return (
    <div className={`special-section ${headerClass}`}>
      <div className="special-section-header">
        <span className="special-section-label">{title}</span>
        <span className={`special-section-total ${amountClass}`}>{fmt(total)}</span>
      </div>
      <div className="special-rows">
        {rows.map(tx => {
          const tag = TAGS[tx.tag];
          const amount = tx[amountKey] || 0;
          return (
            <div key={tx.id} className="special-row">
              <span className="special-date">{tx.date?.slice(0, 10)}</span>
              <span className="special-desc" title={tx.tag_note ? tx.description : undefined}>
                {tx.tag_note || tx.description}
              </span>
              <span
                className="badge badge-tag special-tag"
                style={{ background: tag.bg, color: tag.color }}
              >
                {tag.label}
              </span>
              <span className={`special-amount ${amountClass}`}>{fmt(amount)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SpecialTransactions({ transactions }) {
  const { largeIncomes, largeExpenses, routineIncomes, routineExpenses } = useMemo(() => {
    const tagged = transactions.filter(tx => tx.tag && TAGS[tx.tag] && !isSalaryTag(tx.tag));
    const byDate = (a, b) => b.date.localeCompare(a.date);
    return {
      largeIncomes:    tagged.filter(tx => tx.tag === 'large_income').sort(byDate),
      largeExpenses:   tagged.filter(tx => tx.tag === 'large_expense' || tx.tag === 'savings').sort(byDate),
      routineIncomes:  tagged.filter(tx => tx.tag === 'routine_income').sort(byDate),
      routineExpenses: tagged.filter(tx => tx.tag === 'routine_expense').sort(byDate),
    };
  }, [transactions]);

  const hasAny = largeIncomes.length || largeExpenses.length || routineIncomes.length || routineExpenses.length;
  if (!hasAny) return null;

  const sum = (rows, key) => rows.reduce((s, tx) => s + (tx[key] || 0), 0);
  const totalIncome  = sum(routineIncomes, 'credit') + sum(largeIncomes, 'credit');
  const totalExpense = sum(routineExpenses, 'debit') + sum(largeExpenses, 'debit');

  return (
    <div className="card special-card">
      <h3 className="card-title">פעולות גדולות</h3>
      <div className="special-columns">
        <Section title="הכנסות שגרה"   rows={routineIncomes}  amountKey="credit" amountClass="routine-income-total" headerClass="special-section-routine-income" />
        <Section title="הוצאות שגרה"   rows={routineExpenses} amountKey="debit"  amountClass="routine-expense-total" headerClass="special-section-routine-expense" />
        <Section title="הכנסות מיוחדות" rows={largeIncomes}    amountKey="credit" amountClass="income-total"         headerClass="special-section-income" />
        <Section title="הוצאות מיוחדות" rows={largeExpenses}   amountKey="debit"  amountClass="expense-total"         headerClass="special-section-expense" />
      </div>
      <div className="special-totals">
        <div className="special-total-item special-total-income">
          <span className="special-total-label">סה״כ הכנסות גדולות</span>
          <span className="special-total-amount credit-col">{fmt(totalIncome)}</span>
        </div>
        <div className="special-total-item special-total-expense">
          <span className="special-total-label">סה״כ הוצאות גדולות</span>
          <span className="special-total-amount debit-col">{fmt(totalExpense)}</span>
        </div>
      </div>
    </div>
  );
}
