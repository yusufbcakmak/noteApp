import React from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import './AnalyticsChart.css';

const AnalyticsChart = ({ dailyStats, loading }) => {
  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner">Loading analytics...</div>
      </div>
    );
  }

  if (!dailyStats || dailyStats.length === 0) {
    return (
      <div className="empty-analytics">
        <TrendingUp size={48} />
        <h3>No analytics data available</h3>
        <p>Complete some notes to see your productivity trends</p>
      </div>
    );
  }

  const maxCount = Math.max(...dailyStats.map(stat => stat.count));
  const totalCompleted = dailyStats.reduce((sum, stat) => sum + stat.count, 0);
  const averagePerDay = Math.round(totalCompleted / dailyStats.length * 10) / 10;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getBarHeight = (count) => {
    return maxCount > 0 ? (count / maxCount) * 100 : 0;
  };

  return (
    <div className="analytics-chart">
      <div className="chart-header">
        <h3>Daily Completion Trends</h3>
        <div className="chart-stats">
          <div className="stat-item">
            <span className="stat-value">{totalCompleted}</span>
            <span className="stat-label">Total Completed</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{averagePerDay}</span>
            <span className="stat-label">Average per Day</span>
          </div>
        </div>
      </div>

      <div className="chart-container">
        <div className="chart-bars">
          {dailyStats.map((stat) => (
            <div key={stat.date} className="bar-container">
              <div 
                className="bar"
                style={{ height: `${getBarHeight(stat.count)}%` }}
                title={`${stat.count} notes completed on ${formatDate(stat.date)}`}
              >
                <span className="bar-value">{stat.count}</span>
              </div>
              <div className="bar-label">
                {formatDate(stat.date)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-insights">
        <h4>Insights</h4>
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-icon">
              <Calendar size={24} />
            </div>
            <div className="insight-content">
              <h5>Most Productive Day</h5>
              <p>
                {dailyStats.length > 0 && 
                  formatDate(dailyStats.reduce((max, stat) => 
                    stat.count > max.count ? stat : max
                  ).date)
                }
              </p>
            </div>
          </div>
          
          <div className="insight-card">
            <div className="insight-icon">
              <TrendingUp size={24} />
            </div>
            <div className="insight-content">
              <h5>Completion Rate</h5>
              <p>
                {dailyStats.filter(stat => stat.count > 0).length} of {dailyStats.length} days active
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsChart;