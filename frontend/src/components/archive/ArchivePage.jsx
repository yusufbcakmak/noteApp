import React, { useEffect, useState } from 'react';
import { Archive, Search, Filter, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { useArchive } from '../../contexts/ArchiveContext';
import ArchivedNoteCard from './ArchivedNoteCard';
import './ArchivePage.css';

const ArchivePage = () => {
  const {
    archivedNotes,
    loading,
    error,
    filters,
    pagination,
    stats,
    fetchArchivedNotes,
    fetchStats,
    setFilters,
    changePage,
    clearError
  } = useArchive();

  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    
    const loadData = async () => {
      if (isSubscribed) {
        try {
          await fetchArchivedNotes(filters, pagination.page);
          await fetchStats();
        } catch (error) {
          console.error('Error loading archive data:', error);
        }
      }
    };
    
    loadData();
    
    return () => {
      isSubscribed = false;
    };
  }, [filters.priority, filters.groupName, filters.search, pagination.page]); // Only depend on specific filter values

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim() !== filters.search) {
      setFilters({ ...filters, search: searchTerm.trim() });
      changePage(1);
    }
  };

  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    setFilters(newFilters);
    changePage(1);
  };

  const handleClearFilters = () => {
    const newFilters = { priority: null, groupName: null, search: '' };
    setFilters(newFilters);
    setSearchTerm('');
    changePage(1);
  };

  const handlePageChange = (newPage) => {
    changePage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters = filters.priority || filters.groupName || filters.search;

  // Get unique group names for filter dropdown
  const uniqueGroups = [...new Set(archivedNotes.map(note => note.groupName).filter(Boolean))];

  return (
    <div className="archive-page">
      <div className="archive-header">
        <div className="archive-title-section">
          <div className="archive-title-container">
            <Archive className="archive-icon" size={32} />
            <div>
              <h1 className="archive-title">Archive</h1>
              <p className="archive-subtitle">
                {pagination.total > 0 
                  ? `${pagination.total} archived note${pagination.total !== 1 ? 's' : ''}`
                  : 'No archived notes'
                }
              </p>
            </div>
          </div>
          
          {stats.priorityCounts.total > 0 && (
            <div className="archive-stats">
              <div className="stat-item">
                <BarChart3 size={16} />
                <span>{stats.priorityCounts.total} Total</span>
              </div>
              <div className="stat-item high">
                <span>{stats.priorityCounts.high} High</span>
              </div>
              <div className="stat-item medium">
                <span>{stats.priorityCounts.medium} Medium</span>
              </div>
              <div className="stat-item low">
                <span>{stats.priorityCounts.low} Low</span>
              </div>
            </div>
          )}
        </div>

        <div className="archive-controls">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-container">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                placeholder="Search archived notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <button type="submit" className="search-btn">
              Search
            </button>
          </form>

          <div className="filter-section">
            <button 
              className={`filter-toggle ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={18} />
              Filters
              {hasActiveFilters && <span className="filter-indicator" />}
            </button>

            {showFilters && (
              <div className="filter-dropdown">
                <div className="filter-group">
                  <label>Priority:</label>
                  <select 
                    value={filters.priority || ''} 
                    onChange={(e) => handleFilterChange('priority', e.target.value || null)}
                  >
                    <option value="">All priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                {uniqueGroups.length > 0 && (
                  <div className="filter-group">
                    <label>Group:</label>
                    <select 
                      value={filters.groupName || ''} 
                      onChange={(e) => handleFilterChange('groupName', e.target.value || null)}
                    >
                      <option value="">All groups</option>
                      {uniqueGroups.map(groupName => (
                        <option key={groupName} value={groupName}>
                          {groupName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {hasActiveFilters && (
                  <button 
                    className="clear-filters-btn"
                    onClick={handleClearFilters}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      <div className="archive-content">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Loading archived notes...</p>
          </div>
        ) : archivedNotes.length === 0 ? (
          <div className="empty-state">
            <Archive size={64} className="empty-icon" />
            <h3>No archived notes found</h3>
            <p>
              {hasActiveFilters 
                ? 'Try adjusting your filters or search terms.'
                : 'Complete some notes to see them here when archived.'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="archived-notes-list">
              {archivedNotes.map((archivedNote) => (
                <ArchivedNoteCard 
                  key={archivedNote.id} 
                  archivedNote={archivedNote} 
                />
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>

                <div className="pagination-info">
                  <span>
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <span className="pagination-total">
                    ({pagination.total} total)
                  </span>
                </div>

                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ArchivePage;
