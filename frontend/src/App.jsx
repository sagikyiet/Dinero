import { useState, useEffect, useCallback } from 'react';
import { fetchMonths, fetchDashboard, fetchTransactions, fetchHistory, updateMonth, fetchDemoStatus, loadDemo, clearDemo } from './api';
import UploadPanel from './components/UploadPanel';
import MonthlySummary from './components/MonthlySummary';
import CreditCardBreakdown from './components/CreditCardBreakdown';
import HistoryView from './components/HistoryView';
import FilesView from './components/FilesView';
import SpecialTransactions from './components/SpecialTransactions';
import MonthSelector from './components/MonthSelector';
import PeulotView from './components/PeulotView';
import DemoBanner from './components/DemoBanner';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function App() {
  const [view, setView] = useState('dashboard');
  const [months, setMonths] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUpload,    setShowUpload]    = useState(false);
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoNames, setDemoNames] = useState({ male: 'שגיא', female: 'מאיה' });

  const checkDemoStatus = useCallback(async () => {
    try {
      const { demo_mode, demo_male_name, demo_female_name } = await fetchDemoStatus();
      setIsDemoMode(demo_mode);
      setDemoNames({
        male:   (demo_mode && demo_male_name)   ? demo_male_name   : 'שגיא',
        female: (demo_mode && demo_female_name) ? demo_female_name : 'מאיה',
      });
    } catch (_) {}
  }, []);

  const loadMonths = useCallback(async () => {
    try {
      const data = await fetchMonths();
      setMonths(data);
      return data;
    } catch (e) {
      setError(e.message);
      return [];
    }
  }, []);

  const loadDashboard = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const [dash, txData] = await Promise.all([
        fetchDashboard(id),
        fetchTransactions({ month_id: id }),
      ]);
      setDashboard(dash);
      setTransactions(txData.transactions);
      setNotesText(dash.month.notes || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkDemoStatus();
    loadMonths().then((data) => {
      if (data.length > 0) setSelectedId(data[0].id);
    });
  }, [loadMonths, checkDemoStatus]);

  useEffect(() => {
    if (selectedId) loadDashboard(selectedId);
  }, [selectedId, loadDashboard]);

  async function handleViewChange(v) {
    setView(v);
    if (v === 'history') {
      try {
        const data = await fetchHistory();
        setHistory(data);
      } catch (e) {
        setError(e.message);
      }
    }
    if (v === 'dashboard' && selectedId) {
      loadDashboard(selectedId);
    }
  }

  async function handleUploadSuccess(result) {
    setShowUpload(false);
    if (result.type === 'cc') {
      setFilesRefreshKey(k => k + 1);
      setView('files');
    } else {
      const data = await loadMonths();
      const uploaded = data.find(m => m.id === result.monthId);
      if (uploaded) {
        setSelectedId(uploaded.id);
        setView('dashboard');
      }
    }
  }

  function handleRefresh() {
    if (selectedId) loadDashboard(selectedId);
  }

  async function handleDemoLoad() {
    setDemoLoading(true);
    setError(null);
    try {
      await loadDemo();
      await checkDemoStatus();
      const data = await loadMonths();
      if (data.length > 0) {
        setSelectedId(data[0].id);
        setView('dashboard');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleDemoClear() {
    setDemoLoading(true);
    setError(null);
    try {
      await clearDemo();
      setIsDemoMode(false);
      setDemoNames({ male: 'שגיא', female: 'מאיה' });
      setMonths([]);
      setSelectedId(null);
      setDashboard(null);
      setTransactions([]);
      setView('dashboard');
    } catch (e) {
      setError(e.message);
    } finally {
      setDemoLoading(false);
    }
  }

  const selectedMonth = months.find(m => m.id === selectedId);
  const selectedMonthKey = selectedMonth
    ? `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`
    : null;

  return (
    <div className="app" dir="rtl">
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">₪</span>
          <div>
            <h1 className="header-title">Dinero</h1>
            <p className="header-sub">לוח הבקרה הפיננסי שלנו</p>
          </div>
        </div>
        <nav className="header-nav">
          <button
            className={`nav-btn${view === 'dashboard' ? ' active' : ''}`}
            onClick={() => handleViewChange('dashboard')}
          >
            סטטוס
          </button>
          <button
            className={`nav-btn${view === 'peulot' ? ' active' : ''}`}
            onClick={() => handleViewChange('peulot')}
          >
            פעולות
          </button>
          <button
            className={`nav-btn${view === 'history' ? ' active' : ''}`}
            onClick={() => handleViewChange('history')}
          >
            תובנות
          </button>
          <button
            className={`nav-btn${view === 'files' ? ' active' : ''}`}
            onClick={() => handleViewChange('files')}
          >
            קבצים
          </button>
        </nav>
        {!isDemoMode && (
          <button
            className="btn-demo"
            disabled={demoLoading}
            onClick={handleDemoLoad}
          >
            {demoLoading ? 'טוען...' : 'נסה דמו'}
          </button>
        )}
        <button
          className="btn-upload"
          disabled={isDemoMode}
          onClick={isDemoMode ? undefined : () => setShowUpload(true)}
          title={isDemoMode ? 'במצב דמו לא ניתן להעלות קבצים' : undefined}
        >
          + העלאת קבצים
        </button>
      </header>

      {isDemoMode && (
        <DemoBanner onReset={handleDemoLoad} onExit={handleDemoClear} />
      )}

      {showUpload && (
        <UploadPanel
          onSuccess={handleUploadSuccess}
          onClose={() => setShowUpload(false)}
          demoNames={demoNames}
        />
      )}

      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          {error} <span className="error-close">✕</span>
        </div>
      )}

      <div className="body">
        {view === 'dashboard' && (
          <>
            <aside className="sidebar">
              <MonthSelector
                months={months}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDeleted={async () => {
                  const data = await loadMonths();
                  setSelectedId(data[0]?.id ?? null);
                  setDashboard(null);
                  setTransactions([]);
                }}
              />
            </aside>

            <main className="main">
              {loading && <div className="loading">טוען...</div>}

              {!loading && months.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">₪</div>
                  <h2>ברוכים הבאים ל-Dinero!</h2>
                  <p>העלה את קבצי הבנק שלך כדי להתחיל לעקוב אחר ההוצאות שלכם</p>
                  <button className="btn-primary" onClick={() => setShowUpload(true)}>
                    העלאת קבצים ראשונה
                  </button>
                </div>
              )}

              {!loading && dashboard && selectedMonth && (
                <>
                  <div className="month-heading">
                    <h2>{MONTH_NAMES[selectedMonth.month - 1]} {selectedMonth.year}</h2>
                    <span className="tx-badge">{dashboard.summary.transaction_count} פעולות</span>
                    <button
                      className={`notes-toggle-btn${showNotes ? ' active' : ''}${dashboard.month.notes ? ' has-notes' : ''}`}
                      onClick={() => setShowNotes(v => !v)}
                      title="הערות לחודש"
                    >
                      📝 הערות{dashboard.month.notes ? ' ●' : ''}
                    </button>
                  </div>

                  {showNotes && (
                    <div className="notes-inline">
                      <textarea
                        className="notes-input"
                        placeholder="הערות, אירועים מיוחדים..."
                        value={notesText}
                        onChange={e => setNotesText(e.target.value)}
                        rows={2}
                      />
                      <button
                        className="btn-primary"
                        disabled={notesSaving}
                        onClick={async () => {
                          setNotesSaving(true);
                          try { await updateMonth(selectedId, { notes: notesText }); handleRefresh(); }
                          catch (e) { alert('שגיאה: ' + e.message); }
                          finally { setNotesSaving(false); }
                        }}
                      >
                        {notesSaving ? 'שומר...' : 'שמור'}
                      </button>
                    </div>
                  )}

                  <MonthlySummary summary={dashboard.summary} transactions={transactions} demoNames={demoNames} />

                  <SpecialTransactions transactions={[...transactions, ...(dashboard.ccTagged || [])]} summary={dashboard.summary} />

                  {dashboard.creditCards.length > 0 && (
                    <CreditCardBreakdown
                      cards={dashboard.creditCards}
                      bankCCTotal={dashboard.bankCCTotal ?? 0}
                      ccFilesTotal={dashboard.ccFilesTotal ?? 0}
                      ccFilesCount={dashboard.ccFilesCount ?? 0}
                      onUpdate={handleRefresh}
                      demoNames={demoNames}
                    />
                  )}

                </>
              )}
            </main>
          </>
        )}

        {view === 'history' && (
          <main className="main full">
            <HistoryView history={history} demoNames={demoNames} />
          </main>
        )}

        {view === 'files' && (
          <main className="main full">
            <FilesView key={filesRefreshKey} months={months} onChanged={loadMonths} demoNames={demoNames} />
          </main>
        )}

        {view === 'peulot' && (
          <>
            <aside className="sidebar">
              <MonthSelector
                months={months}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDeleted={async () => {
                  const data = await loadMonths();
                  setSelectedId(data[0]?.id ?? null);
                  setDashboard(null);
                  setTransactions([]);
                }}
              />
            </aside>
            <main className="main">
              <PeulotView
                transactions={transactions}
                monthId={selectedId}
                monthKey={selectedMonthKey}
                demoNames={demoNames}
                onUpdate={handleRefresh}
              />
            </main>
          </>
        )}
      </div>
    </div>
  );
}
