import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import NoteCard from './NoteCard';
import './KanbanColumn.css';

const KanbanColumn = ({ id, title, notes, onEditNote, isDragging, isValidDropTarget }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <div className={`kanban-column ${isDragging && isValidDropTarget ? 'drag-target' : ''} ${isOver ? 'drag-over' : ''}`}>
      <div className="kanban-column-header">
        <h3>{title}</h3>
        <span className="note-count">{notes.length}</span>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`kanban-column-content ${isDragging && isValidDropTarget ? 'drop-zone-active' : ''} ${isOver ? 'drop-zone-hover' : ''}`}
      >
        <SortableContext 
          items={notes.map(note => note.id)} 
          strategy={verticalListSortingStrategy}
        >
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={onEditNote}
              totalNotesInColumn={notes.length}
            />
          ))}
        </SortableContext>
        
        {notes.length === 0 && (
          <div className="empty-column">
            <p>
              {isDragging && isValidDropTarget 
                ? `Drop here to move to ${title.toLowerCase()}` 
                : `No notes in ${title.toLowerCase()}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;