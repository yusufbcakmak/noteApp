import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotesProvider } from './contexts/NotesContext';
import { GroupsProvider } from './contexts/GroupsContext';
import { HistoryProvider } from './contexts/HistoryContext';
import { ArchiveProvider } from './contexts/ArchiveContext';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/notes/Dashboard';
import Groups from './components/groups/Groups';
import History from './components/history/History';
import ArchivePage from './components/archive/ArchivePage';
import Profile from './components/auth/Profile';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <NotesProvider>
        <GroupsProvider>
          <HistoryProvider>
            <ArchiveProvider>
              <Router>
                <div className="App">
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    
                    {/* Protected routes */}
                    <Route path="/" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Navigate to="/dashboard" replace />} />
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="groups" element={<Groups />} />
                      <Route path="history" element={<History />} />
                      <Route path="archive" element={<ArchivePage />} />
                      <Route path="profile" element={<Profile />} />
                    </Route>
                    
                    {/* Catch all route */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </div>
              </Router>
            </ArchiveProvider>
          </HistoryProvider>
        </GroupsProvider>
      </NotesProvider>
    </AuthProvider>
  );
}

export default App;