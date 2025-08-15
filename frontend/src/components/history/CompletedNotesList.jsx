import React from 'react';
import { CheckCircle, Calendar, FolderOpen } from 'lucide-react';
import './CompletedNotesList.css';

const priorityColors = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981'
};

const priorityLabels = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const CompletedNotesList = ({ completedNotes, loading }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const groupNotesByDate = (notes) => {
    const grouped = {};
    notes.forEach(note => {
      const date = new Date(note.completedAt).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(note);
    });
    return grouped;
  };

  const groupedNotes = groupNotesByDate(completedNotes);
  const sortedDates = Object.keys(groupedNotes).sort((a, b) => new Date(b) - new Date(a));

  if (loading) {
    return (
      <div className="completed-notes-loading">
        <div className="loading-spinner">Loading completed notes...</div>
      </div>
    );
  }

  if (completedNotes.length === 0) {
    return (
      <div className="empty-history">
        <CheckCircle size={48} />
        <h3>No completed notes yet</h3>
        <p>Complete some notes to see them appear in your history</p>
      </div>
    );
  }

  return (
    <div className="completed-notes-list">
      {sortedDates.map(date => (
        <div key={date} className="date-group">
          <div className="date-header">
            <Calendar size={20} />
            <h3>{formatDate(date)}</h3>
            <span className="notes-count">
              {groupedNotes[date].length} note{groupedNotes[date].length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="notes-for-date">
            {groupedNotes[date].map(note => (
              <div key={note.id} className="completed-note-card">
                <div 
                  className="priority-indicator"
                  style={{ backgroundColor: priorityColors[note.priority] }}
                />
                
                <div className="note-content">
                  <div className="note-header">
                    <h4 className="note-title">{note.title}</h4>
                    <span className="completion-time">
                      {formatTime(note.completedAt)}
                    </span>
                  </div>
                  
                  {note.description && (
                    <p className="note-description">{note.description}</p>
                  )}
                  
                  <div className="note-meta">
                    {note.groupName && (
                      <div className="note-group">
                        <FolderOpen size={14} />
                        <span>{note.groupName}</span>
                      </div>
                    )}
                    
                    <div className="note-priority">
                      <span 
                        className="priority-badge"
                        style={{ 
                          backgroundColor: priorityColors[note.priority],
                          color: 'white'
                        }}
                      >
                        {priorityLabels[note.priority]}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="completion-indicator">
                  <CheckCircle size={20} color="#10b981" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CompletedNotesList;