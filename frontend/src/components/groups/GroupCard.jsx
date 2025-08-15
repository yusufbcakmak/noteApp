import React from 'react';
import { Edit, Trash2, FolderOpen } from 'lucide-react';
import { useGroups } from '../../contexts/GroupsContext';
import './GroupCard.css';

const GroupCard = ({ group, notes, onEdit }) => {
  const { deleteGroup } = useGroups();

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(group);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the group "${group.name}"? Notes in this group will be moved to ungrouped.`)) {
      try {
        await deleteGroup(group.id);
      } catch (error) {
        console.error('Failed to delete group:', error);
      }
    }
  };

  const getStatusCounts = () => {
    const counts = {
      todo: 0,
      in_progress: 0,
      done: 0
    };
    
    notes.forEach(note => {
      counts[note.status] = (counts[note.status] || 0) + 1;
    });
    
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="group-card">
      <div className="group-header">
        <div 
          className="group-color-indicator"
          style={{ backgroundColor: group.color }}
        />
        <div className="group-info">
          <h3 className="group-name">{group.name}</h3>
          {group.description && (
            <p className="group-description">{group.description}</p>
          )}
        </div>
        <div className="group-actions">
          <button
            className="group-action-btn edit-btn"
            onClick={handleEdit}
            title="Edit group"
          >
            <Edit size={18} />
          </button>
          <button
            className="group-action-btn delete-btn"
            onClick={handleDelete}
            title="Delete group"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="group-stats">
        <div className="total-notes">
          <FolderOpen size={16} />
          <span>{notes.length} notes</span>
        </div>
        
        <div className="status-breakdown">
          <div className="status-item">
            <span className="status-dot todo"></span>
            <span>To Do: {statusCounts.todo}</span>
          </div>
          <div className="status-item">
            <span className="status-dot in-progress"></span>
            <span>In Progress: {statusCounts.in_progress}</span>
          </div>
          <div className="status-item">
            <span className="status-dot done"></span>
            <span>Done: {statusCounts.done}</span>
          </div>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="group-notes-preview">
          <h4>Recent Notes</h4>
          <div className="notes-preview-list">
            {notes.slice(0, 3).map(note => (
              <div key={note.id} className="note-preview">
                <span className="note-title">{note.title}</span>
                <span className={`status-badge ${note.status}`}>
                  {note.status.replace('_', ' ')}
                </span>
              </div>
            ))}
            {notes.length > 3 && (
              <div className="more-notes">
                +{notes.length - 3} more notes
              </div>
            )}
          </div>
        </div>
      )}

      {notes.length === 0 && (
        <div className="empty-group">
          <p>No notes in this group yet</p>
        </div>
      )}
    </div>
  );
};

export default GroupCard;