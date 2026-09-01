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

export default function Sidebar() {
  const { signOut } = useAuth();
  const location = useLocation();
  // Manually-toggled groups, keyed by section label — separate from
  // "contains the active route," same as the vanilla sidebar where a
  // group auto-expands on navigation but can also be toggled by hand.
  const [toggled, setToggled] = useState(() => new Set());

  function toggleGroup(label) {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  return (
    <aside className="sidebar">
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
              >
                {Icon && <Icon className="lucide-nav-icon" size={18} />} {section.label}
              </NavLink>
            );
          }

          const Icon = ICONS[section.icon];
          const containsActive = [section.path, ...section.children.map((c) => c.path)]
            .some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));
          const expanded = containsActive || toggled.has(section.label);

          return (
            <div className={`nav-group${expanded ? ' expanded' : ''}`} key={section.label}>
              <div className="nav-item nav-group-toggle">
                <NavLink to={section.path} className="nav-group-label" end>
                  {Icon && <Icon className="lucide-nav-icon" size={18} />} {section.label}
                </NavLink>
                <button
                  type="button"
                  className={`nav-group-caret-btn${expanded ? ' active' : ''}`}
                  onClick={() => toggleGroup(section.label)}
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

        <a className="nav-item" href="/resources/" target="_blank" rel="noopener noreferrer">
          <LibraryBig className="lucide-nav-icon" size={18} /> Resource Library
        </a>
      </nav>

      <div className="sidebar-footer">
        <button className="btn-signout" onClick={signOut}>Sign Out</button>
      </div>
    </aside>
  );
}
