import React, { useEffect, useState, useRef } from 'react';
import { useNotes } from '../../contexts/NotesContext';
import { useGroups } from '../../contexts/GroupsContext';
import KanbanBoard from './KanbanBoard';
import NoteModal from './NoteModal';
import { Plus } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const { notes, loading, error, fetchNotes, clearError } = useNotes();
  const { fetchGroups } = useGroups();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      fetchNotes();
      fetchGroups();
      hasLoadedRef.current = true;
    }
  }, [fetchNotes, fetchGroups]);

  const handleCreateNote = () => {
    setEditingNote(null);
    setIsModalOpen(true);
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner">Loading notes...</div>
      </div>
    );
  }

  // Filter out archived notes from dashboard
  const activeNotes = notes.filter(note => note.status !== 'archived');

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Manage your notes with a Kanban-style board</p>
        </div>
        <button 
          className="create-note-btn"
          onClick={handleCreateNote}
        >
          <Plus size={20} />
          Create Note
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      <KanbanBoard 
        notes={activeNotes}
        onEditNote={handleEditNote}
      />

      <NoteModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        note={editingNote}
      />
    </div>
  );
};

export default Dashboard;