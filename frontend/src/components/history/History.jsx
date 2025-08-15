import React, { useEffect, useState, useRef } from 'react';
import { useHistory } from '../../contexts/HistoryContext';
import HistoryFilters from './HistoryFilters';
import CompletedNotesList from './CompletedNotesList';
import AnalyticsChart from './AnalyticsChart';
import StatsCards from './StatsCards';
import { Calendar, TrendingUp, CheckCircle } from 'lucide-react';
import './History.css';

const History = () => {
  const { 
    completedNotes, 
    dailyStats, 
    loading, 
    error, 
    fetchHistory, 
    fetchDailyStats, 
    clearError 
  } = useHistory();
  
  const [activeTab, setActiveTab] = useState('timeline');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      fetchHistory(dateRange);
      fetchDailyStats(dateRange);
      hasLoadedRef.current = true;
    }
  }, [fetchHistory, fetchDailyStats]);

  useEffect(() => {
    if (hasLoadedRef.current) {
      fetchHistory(dateRange);
      fetchDailyStats(dateRange);
    }
  }, [dateRange, fetchHistory, fetchDailyStats]);

  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
  };

  const tabs = [
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'stats', label: 'Statistics', icon: CheckCircle }
  ];

  if (loading && completedNotes.length === 0 && dailyStats.length === 0) {
    return (
      <div className="history-loading">
        <div className="loading-spinner">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1>History & Analytics</h1>
          <p>Track your completed notes and productivity insights</p>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      <HistoryFilters
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
      />

      <div className="history-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={20} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="history-content">
        {activeTab === 'timeline' && (
          <CompletedNotesList 
            completedNotes={completedNotes}
            loading={loading}
          />
        )}
        
        {activeTab === 'analytics' && (
          <AnalyticsChart 
            dailyStats={dailyStats}
            loading={loading}
          />
        )}
        
        {activeTab === 'stats' && (
          <StatsCards 
            completedNotes={completedNotes}
            dailyStats={dailyStats}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default History;