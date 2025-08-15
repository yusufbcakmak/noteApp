import React from 'react';
import { CheckCircle, Target, TrendingUp, Award } from 'lucide-react';
import './StatsCards.css';

const StatsCards = ({ completedNotes, dailyStats, loading }) => {
  if (loading) {
    return (
      <div className="stats-loading">
        <div className="loading-spinner">Loading statistics...</div>
      </div>
    );
  }

  const calculateStats = () => {
    const totalCompleted = completedNotes.length;
    const totalDays = dailyStats.length;
    const activeDays = dailyStats.filter(stat => stat.count > 0).length;
    const averagePerDay = totalDays > 0 ? Math.round(totalCompleted / totalDays * 10) / 10 : 0;
    
    // Priority breakdown
    const priorityBreakdown = completedNotes.reduce((acc, note) => {
      acc[note.priority] = (acc[note.priority] || 0) + 1;
      return acc;
    }, {});

    // Group breakdown
    const groupBreakdown = completedNotes.reduce((acc, note) => {
      const groupName = note.groupName || 'Ungrouped';
      acc[groupName] = (acc[groupName] || 0) + 1;
      return acc;
    }, {});

    // Best streak
    let currentStreak = 0;
    let bestStreak = 0;
    const sortedStats = [...dailyStats].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (const stat of sortedStats) {
      if (stat.count > 0) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return {
      totalCompleted,
      totalDays,
      activeDays,
      averagePerDay,
      priorityBreakdown,
      groupBreakdown,
      bestStreak,
      completionRate: totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0
    };
  };

  const stats = calculateStats();

  const priorityColors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981'
  };

  return (
    <div className="stats-cards">
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">
            <CheckCircle size={32} />
          </div>
          <div className="stat-content">
            <h3>{stats.totalCompleted}</h3>
            <p>Total Completed</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Target size={32} />
          </div>
          <div className="stat-content">
            <h3>{stats.averagePerDay}</h3>
            <p>Average per Day</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <TrendingUp size={32} />
          </div>
          <div className="stat-content">
            <h3>{stats.completionRate}%</h3>
            <p>Active Days</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Award size={32} />
          </div>
          <div className="stat-content">
            <h3>{stats.bestStreak}</h3>
            <p>Best Streak</p>
          </div>
        </div>
      </div>

      <div className="breakdown-section">
        <div className="breakdown-card">
          <h4>Priority Breakdown</h4>
          <div className="breakdown-list">
            {Object.entries(stats.priorityBreakdown).map(([priority, count]) => (
              <div key={priority} className="breakdown-item">
                <div className="breakdown-label">
                  <span 
                    className="priority-dot"
                    style={{ backgroundColor: priorityColors[priority] }}
                  />
                  <span className="capitalize">{priority}</span>
                </div>
                <div className="breakdown-value">
                  <span className="count">{count}</span>
                  <span className="percentage">
                    ({Math.round((count / stats.totalCompleted) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="breakdown-card">
          <h4>Group Breakdown</h4>
          <div className="breakdown-list">
            {Object.entries(stats.groupBreakdown)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([group, count]) => (
              <div key={group} className="breakdown-item">
                <div className="breakdown-label">
                  <span className="group-name">{group}</span>
                </div>
                <div className="breakdown-value">
                  <span className="count">{count}</span>
                  <span className="percentage">
                    ({Math.round((count / stats.totalCompleted) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats.totalCompleted === 0 && (
        <div className="empty-stats">
          <CheckCircle size={48} />
          <h3>No statistics available</h3>
          <p>Complete some notes to see detailed statistics</p>
        </div>
      )}
    </div>
  );
};

export default StatsCards;