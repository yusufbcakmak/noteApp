import React from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState } from 'react';
import KanbanColumn from './KanbanColumn';
import NoteCard from './NoteCard';
import { useNotes } from '../../contexts/NotesContext';
import './KanbanBoard.css';

const columns = [
  { id: 'todo', title: 'To Do', status: 'todo' },
  { id: 'in_progress', title: 'In Progress', status: 'in_progress' },
  { id: 'done', title: 'Done', status: 'done' }
];

const KanbanBoard = ({ notes, onEditNote }) => {
  const { updateNoteStatus } = useNotes();
  const [activeId, setActiveId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getNotesForColumn = (status) => {
    return notes.filter(note => note.status === status);
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    setIsDragging(true);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id;
    const overId = over.id;
    
    // Find the containers
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    
    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    setIsDragging(false);
    
    if (!over) {
      setActiveId(null);
      return;
    }
    
    const activeId = active.id;
    const overId = over.id;
    
    // Find which column the note was dropped in
    const overContainer = findContainer(overId);
    
    if (overContainer) {
      const note = notes.find(n => n.id === activeId);
      if (note && note.status !== overContainer) {
        try {
          await updateNoteStatus(activeId, overContainer);
        } catch (error) {
          console.error('Failed to update note status:', error);
        }
      }
    }
    
    setActiveId(null);
  };

  const findContainer = (id) => {
    // Check if id is a column
    const column = columns.find(col => col.id === id);
    if (column) return column.status;
    
    // Check if id is a note
    const note = notes.find(note => note.id === id);
    if (note) return note.status;
    
    return null;
  };

  const activeNote = activeId ? notes.find(note => note.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            notes={getNotesForColumn(column.status)}
            onEditNote={onEditNote}
            isDragging={isDragging}
            isValidDropTarget={true}
          />
        ))}
      </div>
      
      <DragOverlay>
        {activeNote ? (
          <NoteCard
            note={activeNote}
            onEdit={() => {}}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;