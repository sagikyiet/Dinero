import { useState } from 'react';
import TransactionTable from './TransactionTable';
import CreditCardTransactionsView from './CreditCardTransactionsView';

const LS_KEY = 'peulot_active_tab';

export default function PeulotView({ transactions, monthId, monthKey, demoNames, onUpdate }) {
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem(LS_KEY) || 'bank'
  );

  function switchTab(tab) {
    setActiveTab(tab);
    localStorage.setItem(LS_KEY, tab);
  }

  return (
    <div className="peulot-view">
      <div className="peulot-tabs">
        <button
          className={`peulot-tab${activeTab === 'cc' ? ' active' : ''}`}
          onClick={() => switchTab('cc')}
        >
          כרטיסי אשראי
        </button>
        <button
          className={`peulot-tab${activeTab === 'bank' ? ' active' : ''}`}
          onClick={() => switchTab('bank')}
        >
          עו&quot;ש
        </button>
      </div>

      {activeTab === 'bank' && (
        <TransactionTable
          transactions={transactions}
          monthId={monthId}
          onUpdate={onUpdate}
          demoNames={demoNames}
        />
      )}
      {activeTab === 'cc' && (
        <CreditCardTransactionsView initialMonthKey={monthKey} demoNames={demoNames} />
      )}
    </div>
  );
}
