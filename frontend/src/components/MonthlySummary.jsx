import { useState, useMemo } from 'react';

const fmt = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtExact = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2 }).format(n ?? 0);

function computeBreakdown(transactions) {
  let creditCards = 0, leumiDirect = 0, haDirect = 0;
  let salarySagi = 0, salaryMaya = 0, incomeLeumi = 0, incomeHapoalim = 0;

  for (const tx of transactions) {
    const debit  = tx.debit  ?? 0;
    const credit = tx.credit ?? 0;

    if (debit > 0) {
      if (tx.is_credit_card)        creditCards  += debit;
      else if (tx.bank === 'leumi') leumiDirect  += debit;
      else                          haDirect     += debit;
    }

    if (credit > 0) {
      if (tx.tag === 'salary_sagi') salarySagi += credit;
      if (tx.tag === 'salary_maya') salaryMaya += credit;
      if (tx.bank === 'leumi') incomeLeumi    += credit;
      else                     incomeHapoalim += credit;
    }
  }

  return {
    expenses: { creditCards, leumiDirect, haDirect },
    income:   { salarySagi, salaryMaya, incomeLeumi, incomeHapoalim },
  };
}

function BreakdownRow({ label, amount, color, alwaysShow }) {
  if (!amount && !alwaysShow) return null;
  return (
    <div className="breakdown-row">
      <span className="breakdown-dot" style={{ background: color }} />
      <span className="breakdown-label">{label}</span>
      <span className="breakdown-amount" style={{ color }}>{fmt(amount)}</span>
    </div>
  );
}

export default function MonthlySummary({ summary, transactions = [], demoNames = {} }) {
  const maleName   = demoNames.male   || 'שגיא';
  const femaleName = demoNames.female || 'מאיה';
  const [expandIncome,   setExpandIncome]   = useState(false);
  const [expandExpenses, setExpandExpenses] = useState(false);
  const [expandSavings,  setExpandSavings]  = useState(false);

  const balance = summary.total_income - summary.total_expenses;
  const bd      = useMemo(() => computeBreakdown(transactions), [transactions]);

  const savingsTxs = useMemo(
    () => transactions.filter(tx => tx.tag === 'savings'),
    [transactions]
  );
  const savingsTotal = useMemo(
    () => savingsTxs.reduce((s, tx) => s + (tx.debit || 0) + (tx.credit || 0), 0),
    [savingsTxs]
  );

  return (
    <div className="card summary-card-wrap">
      <h3 className="card-title">סיכום חודשי</h3>
      <div className="summary-row">

        {/* Income */}
        <div
          className="summary-item income expandable"
          onClick={() => setExpandIncome(v => !v)}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setExpandIncome(v => !v)}
        >
          <div className="summary-item-header">
            <span className="summary-label">הכנסות</span>
            <span className={`expand-arrow${expandIncome ? ' open' : ''}`}>›</span>
          </div>
          <span className="summary-amount">{fmt(summary.total_income)}</span>
          {expandIncome && (
            <div className="breakdown-list" onClick={e => e.stopPropagation()}>
              <BreakdownRow label={`משכורת ${maleName}`}   amount={bd.income.salarySagi} color="var(--green)" alwaysShow />
              <BreakdownRow label={`משכורת ${femaleName}`} amount={bd.income.salaryMaya} color="var(--green)" alwaysShow />
              <BreakdownRow label="עו״ש לאומי"   amount={bd.income.incomeLeumi}    color="var(--leumi)" />
              <BreakdownRow label="עו״ש פועלים"  amount={bd.income.incomeHapoalim} color="var(--hapoalim)" />
            </div>
          )}
        </div>

        {/* Expenses */}
        <div
          className="summary-item expense expandable"
          onClick={() => setExpandExpenses(v => !v)}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setExpandExpenses(v => !v)}
        >
          <div className="summary-item-header">
            <span className="summary-label">הוצאות</span>
            <span className={`expand-arrow${expandExpenses ? ' open' : ''}`}>›</span>
          </div>
          <span className="summary-amount">{fmt(summary.total_expenses)}</span>
          {expandExpenses && (
            <div className="breakdown-list" onClick={e => e.stopPropagation()}>
              <BreakdownRow label="כרטיסי אשראי"  amount={bd.expenses.creditCards}  color="var(--red)" />
              <BreakdownRow label="עו״ש לאומי"     amount={bd.expenses.leumiDirect}  color="var(--leumi)" />
              <BreakdownRow label="עו״ש פועלים"    amount={bd.expenses.haDirect}     color="var(--hapoalim)" />
            </div>
          )}
        </div>

        {/* Savings */}
        <div
          className="summary-item savings-card expandable"
          onClick={() => setExpandSavings(v => !v)}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setExpandSavings(v => !v)}
        >
          <div className="summary-item-header">
            <span className="summary-label">חיסכון</span>
            <span className={`expand-arrow${expandSavings ? ' open' : ''}`}>›</span>
          </div>
          <span className="summary-amount">{fmt(savingsTotal)}</span>
          {expandSavings && (
            <div className="breakdown-list" onClick={e => e.stopPropagation()}>
              {savingsTxs.length === 0 && (
                <span className="breakdown-label" style={{ fontSize: '0.75rem', padding: '0.1rem 0' }}>
                  אין פעולות מתויגות עדיין
                </span>
              )}
              {savingsTxs.map(tx => (
                <div key={tx.id} className="breakdown-row">
                  <span className="breakdown-dot" style={{ background: 'var(--purple)' }} />
                  <span className="breakdown-label">
                    <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                      {tx.date?.slice(0, 10)}
                    </span>
                    {tx.description}
                  </span>
                  <span className="breakdown-amount" style={{ color: 'var(--purple)' }}>
                    {fmtExact((tx.debit || 0) + (tx.credit || 0))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Balance */}
        <div className={`summary-item balance ${balance >= 0 ? 'positive' : 'negative'}`}>
          <span className="summary-label">מאזן</span>
          <span className="summary-amount">{fmt(balance)}</span>
        </div>

      </div>
    </div>
  );
}
