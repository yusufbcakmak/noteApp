import React, { useEffect, useState, useRef } from 'react';
import { useGroups } from '../../contexts/GroupsContext';
import { useNotes } from '../../contexts/NotesContext';
import GroupCard from './GroupCard';
import GroupModal from './GroupModal';
import GroupFilter from './GroupFilter';
import { Plus, FolderOpen } from 'lucide-react';
import './Groups.css';

const Groups = () => {
  const { groups, loading, error, fetchGroups, clearError } = useGroups();
  const { notes, fetchNotes } = useNotes();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      fetchGroups();
      fetchNotes();
      hasLoadedRef.current = true;
    }
  }, [fetchGroups, fetchNotes]);

  const handleCreateGroup = () => {
    setEditingGroup(null);
    setIsModalOpen(true);
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGroup(null);
  };

  const getNotesForGroup = (groupId) => {
    return notes.filter(note => note.groupId === groupId);
  };

  const getUngroupedNotes = () => {
    return notes.filter(note => !note.groupId);
  };

  const filteredGroups = selectedGroupId 
    ? groups.filter(group => group.id === selectedGroupId)
    : groups;

  if (loading && groups.length === 0) {
    return (
      <div className="groups-loading">
        <div className="loading-spinner">Loading groups...</div>
      </div>
    );
  }

  return (
    <div className="groups-page">
      <div className="groups-header">
        <div>
          <h1>Groups</h1>
          <p>Organize your notes into groups for better management</p>
        </div>
        <button 
          className="create-group-btn"
          onClick={handleCreateGroup}
        >
          <Plus size={20} />
          Create Group
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      <GroupFilter
        groups={groups}
        selectedGroupId={selectedGroupId}
        onGroupSelect={setSelectedGroupId}
      />

      <div className="groups-grid">
        {/* Ungrouped notes */}
        {(!selectedGroupId || selectedGroupId === 'ungrouped') && (
          <div className="ungrouped-section">
            <div className="ungrouped-header">
              <FolderOpen size={24} />
              <h3>Ungrouped Notes</h3>
              <span className="note-count">{getUngroupedNotes().length}</span>
            </div>
            <div className="ungrouped-notes">
              {getUngroupedNotes().length > 0 ? (
                <div className="notes-list">
                  {getUngroupedNotes().map(note => (
                    <div key={note.id} className="note-item">
                      <h4>{note.title}</h4>
                      <p>{note.description}</p>
                      <span className={`status-badge ${note.status}`}>
                        {note.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-message">No ungrouped notes</p>
              )}
            </div>
          </div>
        )}

        {/* Groups */}
        {filteredGroups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            notes={getNotesForGroup(group.id)}
            onEdit={handleEditGroup}
          />
        ))}

        {groups.length === 0 && !loading && (
          <div className="empty-state">
            <FolderOpen size={48} />
            <h3>No groups yet</h3>
            <p>Create your first group to organize your notes</p>
            <button 
              className="create-group-btn"
              onClick={handleCreateGroup}
            >
              <Plus size={20} />
              Create Group
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <GroupModal
          group={editingGroup}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default Groups;