import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ShieldCheck, CalendarDays, Receipt, UsersRound, Presentation,
  GraduationCap, ChevronDown, LibraryBig,
} from 'lucide-react';
import { navSections } from '../app/router.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

const ICONS = {
  'shield-check': ShieldCheck,
  'calendar-days': CalendarDays,
  receipt: Receipt,
  'users-round': UsersRound,
  presentation: Presentation,
  'graduation-cap': GraduationCap,
  'library-big': LibraryBig,
};

export default function Sidebar({ isOpen = false, onNavigate }) {
  const { signOut } = useAuth();
  const location = useLocation();
  // A group with no override follows the active route. Once manually
  // toggled, its explicit state wins so even the active section can close.
  const [groupOverrides, setGroupOverrides] = useState({});

  function toggleGroup(label, expanded) {
    setGroupOverrides((previous) => ({ ...previous, [label]: !expanded }));
  }

  return (
    <aside className={`sidebar${isOpen ? ' mobile-open' : ''}`} id="admin-navigation">
      <div className="sidebar-logo">
        <img
          src="/assets/logo-white.png"
          alt=""
          className="sidebar-logo-img"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div>
          <div className="sidebar-brand">GUARDIAN GROUP</div>
          <div className="sidebar-tag">Admin Dashboard</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navSections.map((section) => {
          if (!section.children) {
            const Icon = ICONS[section.icon];
            return (
              <NavLink
                key={section.path}
                to={section.path}
                end={section.path === '/admin'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={onNavigate}
              >
                {Icon && <Icon className="lucide-nav-icon" size={18} />} {section.label}
              </NavLink>
            );
          }

          const Icon = ICONS[section.icon];
          const containsActive = [section.path, ...section.children.map((c) => c.path)]
            .some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));
          const expanded = groupOverrides[section.label] ?? containsActive;

          return (
            <div className={`nav-group${expanded ? ' expanded' : ''}`} key={section.label}>
              <div className="nav-item nav-group-toggle">
                <NavLink to={section.path} className="nav-group-label" end onClick={onNavigate}>
                  {Icon && <Icon className="lucide-nav-icon" size={18} />} {section.label}
                </NavLink>
                <button
                  type="button"
                  className={`nav-group-caret-btn${expanded ? ' active' : ''}`}
                  onClick={() => toggleGroup(section.label, expanded)}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${section.label}`}
                >
                  <ChevronDown className="nav-group-caret" size={16} />
                </button>
              </div>
              <div className="nav-submenu">
                {section.children.map((child) => (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    className={({ isActive }) => `nav-subitem${isActive ? ' active' : ''}`}
                    onClick={() => {
                      onNavigate?.();
                      if (child.path === '/admin/quotes' && location.pathname === child.path) {
                        window.dispatchEvent(new Event('quote-tool:all-documents'));
                      }
                    }}
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}

        <a className="nav-item" href="/resources/" target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
          <LibraryBig className="lucide-nav-icon" size={18} /> Resource Library
        </a>
      </nav>

      <div className="sidebar-footer">
        <button className="btn-signout" onClick={signOut}>Sign Out</button>
      </div>
    </aside>
  );
}
