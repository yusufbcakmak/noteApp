import React, { useState } from 'react';
import { Calendar, Tag, Trash2, Archive, Clock, RotateCcw } from 'lucide-react';
import { useArchive } from '../../contexts/ArchiveContext';
import { useNotes } from '../../contexts/NotesContext';
import ConfirmationModal from '../common/ConfirmationModal';
import './ArchivedNoteCard.css';

const priorityColors = {
  high: '#ef4444', // red
  medium: '#f59e0b', // yellow/amber
  low: '#10b981' // green
};

const priorityLabels = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const ArchivedNoteCard = ({ archivedNote }) => {
  const { deleteArchivedNote, unarchiveNote } = useArchive();
  const { addNote, fetchNotes } = useNotes();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUnarchiveModal, setShowUnarchiveModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      await deleteArchivedNote(archivedNote.id);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Failed to delete archived note:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnarchive = async () => {
    setIsProcessing(true);
    try {
      const restoredNote = await unarchiveNote(archivedNote.id);
      await addNote(restoredNote);
      // Refresh notes to ensure UI is in sync with backend
      setTimeout(() => {
        fetchNotes();
      }, 100);
      setShowUnarchiveModal(false);
    } catch (error) {
      console.error('Failed to unarchive note:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const showUnarchiveConfirmation = (e) => {
    e.stopPropagation();
    setShowUnarchiveModal(true);
  };

  const showDeleteConfirmation = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowDeleteModal(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="archived-note-card">
      <div 
        className="priority-indicator"
        style={{ backgroundColor: priorityColors[archivedNote.priority] }}
        title={`Priority: ${priorityLabels[archivedNote.priority]}`}
      />
      
      <div className="archived-note-content">
        <div className="archived-note-main">
          <div className="archived-note-header">
            <h4 className="archived-note-title">{archivedNote.title}</h4>
            <div className="archived-badge">
              <Archive size={12} />
              <span>Archived</span>
            </div>
          </div>
          
          {archivedNote.description && (
            <p className="archived-note-description">{archivedNote.description}</p>
          )}
        </div>
        
        <div className="archived-note-info">
          <div className="archived-note-meta">
            <div className="archived-note-dates">
              <div className="archived-note-date">
                <Calendar size={12} />
                <span>Created: {formatDate(archivedNote.createdAt)}</span>
              </div>
              <div className="archived-note-date">
                <Clock size={12} />
                <span>Completed: {formatDate(archivedNote.completedAt)}</span>
              </div>
              <div className="archived-note-date">
                <Archive size={12} />
                <span>Archived: {formatDateTime(archivedNote.archivedAt)}</span>
              </div>
            </div>
            
            <div className="archived-note-priority">
              <span 
                className="priority-badge"
                style={{ 
                  backgroundColor: priorityColors[archivedNote.priority],
                  color: 'white'
                }}
              >
                {priorityLabels[archivedNote.priority]}
              </span>
            </div>
          </div>
          
          {archivedNote.groupName && (
            <div className="archived-note-group">
              <Tag size={12} />
              <span className="group-name">{archivedNote.groupName}</span>
            </div>
          )}
          
          <div className="archived-note-actions">
            <button
              className="archived-note-action-btn unarchive-btn"
              onClick={showUnarchiveConfirmation}
              title="Restore to notes"
              disabled={isProcessing}
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="archived-note-action-btn delete-btn"
              onClick={showDeleteConfirmation}
              title="Delete permanently"
              disabled={isProcessing}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Unarchive Confirmation Modal */}
      {showUnarchiveModal && (
        <ConfirmationModal
          isOpen={showUnarchiveModal}
          onClose={() => setShowUnarchiveModal(false)}
          onConfirm={handleUnarchive}
          title="Restore Note"
          message="Are you sure you want to restore this note back to your active notes list?"
          confirmText="Restore Note"
          cancelText="Cancel"
          type="success"
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Archived Note"
          message="Are you sure you want to permanently delete this archived note? This action cannot be undone."
          confirmText="Delete Permanently"
          cancelText="Cancel"
          type="danger"
        />
      )}
    </div>
  );
};

export default ArchivedNoteCard;
