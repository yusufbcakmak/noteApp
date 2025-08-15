import React from 'react';
import { Filter, X } from 'lucide-react';
import './GroupFilter.css';

const GroupFilter = ({ groups, selectedGroupId, onGroupSelect }) => {
  const handleFilterChange = (groupId) => {
    onGroupSelect(groupId === selectedGroupId ? null : groupId);
  };

  const clearFilter = () => {
    onGroupSelect(null);
  };

  return (
    <div className="group-filter">
      <div className="filter-header">
        <Filter size={16} />
        <span>Filter by Group</span>
        {selectedGroupId && (
          <button 
            className="clear-filter-btn"
            onClick={clearFilter}
            title="Clear filter"
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      <div className="filter-options">
        <button
          className={`filter-option ${selectedGroupId === 'ungrouped' ? 'active' : ''}`}
          onClick={() => handleFilterChange('ungrouped')}
        >
          <span className="filter-color" style={{ backgroundColor: '#6b7280' }} />
          Ungrouped
        </button>
        
        {groups.map(group => (
          <button
            key={group.id}
            className={`filter-option ${selectedGroupId === group.id ? 'active' : ''}`}
            onClick={() => handleFilterChange(group.id)}
          >
            <span 
              className="filter-color" 
              style={{ backgroundColor: group.color }} 
            />
            {group.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GroupFilter;