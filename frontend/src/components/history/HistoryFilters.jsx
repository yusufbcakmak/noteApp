import React, { useState } from 'react';
import { Calendar, Filter, X } from 'lucide-react';
import './HistoryFilters.css';

const HistoryFilters = ({ dateRange, onDateRangeChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDateChange = (field, value) => {
    onDateRangeChange({
      ...dateRange,
      [field]: value
    });
  };

  const clearFilters = () => {
    onDateRangeChange({
      startDate: '',
      endDate: ''
    });
  };

  const setPresetRange = (days) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    onDateRangeChange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
  };

  const hasActiveFilters = dateRange.startDate || dateRange.endDate;

  return (
    <div className="history-filters">
      <div className="filters-header">
        <button
          className="filters-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Filter size={16} />
          <span>Filters</span>
          {hasActiveFilters && <span className="active-indicator" />}
        </button>
        
        {hasActiveFilters && (
          <button 
            className="clear-filters-btn"
            onClick={clearFilters}
            title="Clear all filters"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="filters-content">
          <div className="date-filters">
            <div className="date-input-group">
              <label htmlFor="startDate">From</label>
              <input
                type="date"
                id="startDate"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
              />
            </div>
            
            <div className="date-input-group">
              <label htmlFor="endDate">To</label>
              <input
                type="date"
                id="endDate"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="preset-filters">
            <span className="preset-label">Quick filters:</span>
            <div className="preset-buttons">
              <button onClick={() => setPresetRange(7)}>Last 7 days</button>
              <button onClick={() => setPresetRange(30)}>Last 30 days</button>
              <button onClick={() => setPresetRange(90)}>Last 3 months</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryFilters;