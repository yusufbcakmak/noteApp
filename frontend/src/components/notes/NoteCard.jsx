import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Edit, Trash2, Calendar, Tag, Archive, Check, Clock, AlertCircle } from 'lucide-react';
import { useNotes } from '../../contexts/NotesContext';
import { useArchive } from '../../contexts/ArchiveContext';
import { useGroups } from '../../contexts/GroupsContext';
import ConfirmationModal from '../common/ConfirmationModal';
import './NoteCard.css';

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

const statusConfig = {
  'pending': {
    label: 'Pending',
    icon: Clock,
    color: '#6b7280', // gray
    bgColor: '#f9fafb'
  },
  'in-progress': {
    label: 'In Progress',
    icon: AlertCircle,
    color: '#f59e0b', // amber
    bgColor: '#fef3c7'
  },
  'done': {
    label: 'Done',
    icon: Check,
    color: '#ffffff', // white text
    bgColor: '#10b981' // green background
  },
  'archived': {
    label: 'Archived',
    icon: Archive,
    color: '#6b7280', // gray text
    bgColor: '#f3f4f6' // gray background
  }
};

const NoteCard = ({ note, onEdit, isDragging = false, totalNotesInColumn = 0 }) => {
  const { deleteNote, removeArchivedNote, fetchNotes } = useNotes();
  const { archiveNote } = useArchive();
  const { groups } = useGroups();
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isUltraCompact, setIsUltraCompact] = useState(false);
  const cardRef = useRef(null);
  const NORMAL_CARD_HEIGHT = 120; // Normal card yüksekliği (referans)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: note.id });

  // Kart yüksekliğini kontrol et ve compact mode'u ayarla
  useEffect(() => {
    const checkCardHeight = () => {
      if (cardRef.current) {
        const cardHeight = cardRef.current.offsetHeight;
        const halfNormalHeight = NORMAL_CARD_HEIGHT / 2;
        const quarterNormalHeight = NORMAL_CARD_HEIGHT / 4;
        
        if (cardHeight <= quarterNormalHeight) {
          setIsUltraCompact(true);
          setIsCompact(false);
        } else if (cardHeight <= halfNormalHeight) {
          setIsCompact(true);
          setIsUltraCompact(false);
        } else {
          setIsCompact(false);
          setIsUltraCompact(false);
        }
      }
    };

    // İlk render'da kontrol et
    checkCardHeight();

    // Resize observer ile sürekli kontrol et
    const resizeObserver = new ResizeObserver(checkCardHeight);
    if (cardRef.current) {
      resizeObserver.observe(cardRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [totalNotesInColumn]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  // Card boyutunu ayarla
  const getCardClasses = () => {
    let classes = 'note-card';
    
    if (isDragging) classes += ' dragging';
    if (note.status === 'done') classes += ' note-done';
    
    // Yükseklik bazlı compact mode
    if (isUltraCompact) {
      classes += ' ultra-compact-mode';
    } else if (isCompact) {
      classes += ' compact-mode';
    }
    
    return classes;
  };

  const getGroupInfo = () => {
    if (!note.groupId) {
      return { name: 'Ungrouped', color: '#6b7280' };
    }
    
    const group = groups.find(g => g.id === note.groupId);
    return group ? { name: group.name, color: group.color } : { name: 'Unknown Group', color: '#6b7280' };
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit(note);
  };

  const handleArchive = async () => {
    try {
      console.log('Starting archive process for note:', note.id);
      console.log('Note details:', { id: note.id, title: note.title, status: note.status });
      
      console.log('Calling archiveNote API');
      const result = await archiveNote(note.id);
      console.log('archiveNote API successful, result:', result);
      
      // Close modal first
      setShowArchiveModal(false);
      
      // Remove the note from current context since it's now archived
      console.log('Removing archived note from dashboard');
      removeArchivedNote(note.id);
      
      // Refresh notes list to ensure consistency
      console.log('Refreshing notes list');
      await fetchNotes();
      console.log('Notes refreshed');
      
    } catch (error) {
      console.error('Failed to archive note:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteNote(note.id);
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const showArchiveConfirmation = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setShowArchiveModal(true);
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

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        cardRef.current = node;
      }}
      style={style}
      className={getCardClasses()}
    >
      <div 
        className="priority-indicator"
        style={{ backgroundColor: priorityColors[note.priority] }}
        title={`Priority: ${priorityLabels[note.priority]}`}
      />
      
      <div 
        className="note-content"
        {...attributes}
        {...listeners}
      >
        {/* Top row: Title (left) and Status Badge (right) */}
        <div className="note-header">
          <h4 className="note-title">{note.title}</h4>
          <div 
            className="status-badge"
            style={{ 
              backgroundColor: statusConfig[note.status]?.bgColor || statusConfig.pending.bgColor,
              color: statusConfig[note.status]?.color || statusConfig.pending.color
            }}
          >
            {React.createElement(statusConfig[note.status]?.icon || statusConfig.pending.icon, { size: 14 })}
            <span>{statusConfig[note.status]?.label || 'Pending'}</span>
          </div>
        </div>

        {/* Middle: Description */}
        {note.description && (
          <div className="note-description-container">
            <p className="note-description">{note.description}</p>
          </div>
        )}

        {/* Bottom left: Date above Group */}
        <div className="note-date-absolute">
          <Calendar size={12} />
          <span>{formatDate(note.createdAt)}</span>
        </div>

        {/* Bottom left corner: Group info - only show if note has a group */}
        {note.groupId && (
          <div 
            className="note-group"
            style={{ color: getGroupInfo().color }}
          >
            <Tag size={12} />
            <span className="group-name">
              {getGroupInfo().name}
            </span>
          </div>
        )}
      </div>
      
      <div className="note-actions">
        <button
          className="note-action-btn edit-btn"
          onClick={handleEdit}
          title="Edit note"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Edit size={16} />
        </button>
        
        {note.status === 'done' && (
          <button
            className="note-action-btn archive-btn"
            onClick={showArchiveConfirmation}
            title="Archive note"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <Archive size={16} />
          </button>
        )}
        
        <button
          className="note-action-btn delete-btn"
          onClick={showDeleteConfirmation}
          title="Delete note"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <ConfirmationModal
          isOpen={showArchiveModal}
          onClose={() => setShowArchiveModal(false)}
          onConfirm={handleArchive}
          title="Archive Note"
          message="Are you sure you want to archive this completed note? It will be moved to the archive and removed from your active notes."
          confirmText="Archive"
          cancelText="Cancel"
          type="warning"
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Note"
          message="Are you sure you want to delete this note? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
        />
      )}
    </div>
  );
};

export default NoteCard;