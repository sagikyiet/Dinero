import { useMemo, useState } from 'react';
import { TAGS, isSalaryTag } from '../tags';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(n);

function Section({ title, rows, amountKey, amountClass, headerClass }) {
  const total = rows.reduce((s, tx) => s + (tx[amountKey] || 0), 0);
  return (
    <div className={`special-section ${headerClass}`}>
      <div className="special-section-header">
        <span className="special-section-label">{title}</span>
        {rows.length > 0 && (
          <span className={`special-section-total ${amountClass}`}>{fmt(total)}</span>
        )}
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

function NormalizedItem({ label, amount, colorClass, tooltip }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className={`norm-item ${colorClass}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="norm-label">{label}</span>
      <span className="norm-amount">{fmt(amount)}</span>
      {visible && <div className="norm-tooltip">{tooltip}</div>}
    </div>
  );
}

export default function SpecialTransactions({ transactions, summary = {} }) {
  const { largeIncomes, largeExpenses, routineIncomes, routineExpenses } = useMemo(() => {
    const tagged = transactions.filter(tx => tx.tag && TAGS[tx.tag] && !isSalaryTag(tx.tag));
    const byDate = (a, b) => b.date.localeCompare(a.date);
    return {
      largeIncomes:    tagged.filter(tx => tx.tag === 'large_income').sort(byDate),
      largeExpenses:   tagged.filter(tx => tx.tag === 'large_expense').sort(byDate),
      routineIncomes:  tagged.filter(tx => tx.tag === 'routine_income').sort(byDate),
      routineExpenses: tagged.filter(tx => tx.tag === 'routine_expense').sort(byDate),
    };
  }, [transactions]);

  const hasAny = largeIncomes.length || largeExpenses.length || routineIncomes.length || routineExpenses.length;
  if (!hasAny) return null;

  const sum = (rows, key) => rows.reduce((s, tx) => s + (tx[key] || 0), 0);
  const totalIncome  = sum(routineIncomes, 'credit') + sum(largeIncomes, 'credit');
  const totalExpense = sum(routineExpenses, 'debit') + sum(largeExpenses, 'debit');

  const normIncome  = (summary.total_income  ?? 0) - sum(largeIncomes,  'credit');
  const normExpense = (summary.total_expenses ?? 0) - sum(largeExpenses, 'debit');
  const normBalance = normIncome - normExpense;

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

      <div className="normalized-section">
        <h4 className="normalized-title">סיכום חודשי מנורמל</h4>
        <div className="normalized-grid">
          <NormalizedItem
            label="סה״כ הכנסות מנורמל"
            amount={normIncome}
            colorClass="norm-income"
            tooltip={
              <>
                <strong>סה״כ הכנסות פחות הכנסות מיוחדות</strong><br />
                {fmt(summary.total_income ?? 0)} − {fmt(sum(largeIncomes, 'credit'))} = {fmt(normIncome)}
              </>
            }
          />
          <NormalizedItem
            label="סה״כ הוצאות מנורמל"
            amount={normExpense}
            colorClass="norm-expense"
            tooltip={
              <>
                <strong>סה״כ הוצאות פחות הוצאות מיוחדות</strong><br />
                {fmt(summary.total_expenses ?? 0)} − {fmt(sum(largeExpenses, 'debit'))} = {fmt(normExpense)}
              </>
            }
          />
          <NormalizedItem
            label="מאזן מנורמל"
            amount={normBalance}
            colorClass={normBalance >= 0 ? 'norm-balance-pos' : 'norm-balance-neg'}
            tooltip={
              <>
                <strong>הכנסות מנורמלות פחות הוצאות מנורמלות</strong><br />
                {fmt(normIncome)} − {fmt(normExpense)} = {fmt(normBalance)}
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
