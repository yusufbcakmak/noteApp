import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderOpen, 
  History, 
  Archive,
  User 
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const navItems = [
    {
      path: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard'
    },
    {
      path: '/groups',
      icon: FolderOpen,
      label: 'Groups'
    },
    {
      path: '/history',
      icon: History,
      label: 'History'
    },
    {
      path: '/archive',
      icon: Archive,
      label: 'Archive'
    },
    {
      path: '/profile',
      icon: User,
      label: 'Profile'
    }
  ];

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;