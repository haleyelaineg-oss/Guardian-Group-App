import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import MultiSelectPills from '../../components/MultiSelectPills.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { formatDate, formatLabel, formatShortDate } from '../../utils/format.js';
import { fetchEventHubRows } from './eventsService.js';

const TYPE_LABELS = {
  training: 'Training',
  speaking: 'Speaking Engagement',
  event: 'Other Event',
};
const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

function typeLabel(row) {
  if (row.kind !== 'event') return TYPE_LABELS[row.kind];
  return row.subtype ? formatLabel(row.subtype) : TYPE_LABELS.event;
}

function rowStatusLabel(row) {
  return row.statusLabel || formatLabel(row.status);
}

function rowDate(row) {
  if (row.startsAt) {
    const date = row.startsAt.slice(0, 10);
    return <><span className="date-full">{formatDate(date)}</span><span className="date-short">{formatShortDate(date)}</span></>;
  }
  if (row.dateFallback) return `CFP due ${formatDate(row.dateFallback)}`;
  return '—';
}

const SORT_VALUE = {
  title: (row) => row.title || '',
  type: (row) => typeLabel(row) || '',
  organization: (row) => row.organization || '',
  date: (row) => row.startsAt || row.dateFallback || '',
  status: (row) => rowStatusLabel(row) || '',
  location: (row) => row.location || '',
};

function SortableHeader({ label, sortKey, activeKey, direction, onSort }) {
  const active = sortKey === activeKey;
  return <th aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" className={`event-sort-header ${active ? 'active' : ''}`} onClick={() => onSort(sortKey)}><span>{label}</span><span className="event-sort-indicator" aria-hidden="true">{active ? (direction === 'asc' ? '▲' : '▼') : '↕'}</span></button></th>;
}

export default function EventsListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilters, setTypeFilters] = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);
  const [sortKey, setSortKey] = useState('date');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showCancelled, setShowCancelled] = useState(false);
  const navigate = useNavigate();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchEventHubRows());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const statusOptions = useMemo(() => {
    const options = new Map();
    rows.forEach((row) => {
      const label = rowStatusLabel(row);
      if (!options.has(label)) options.set(label, { value: label, label, cancelled: row.cancelled });
    });
    return [...options.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [rows]);

  const cancelledStatusFilters = new Set(statusOptions.filter((option) => option.cancelled && statusFilters.includes(option.value)).map((option) => option.value));
  const visibleRows = rows
    .filter((row) => (
      (showCancelled || cancelledStatusFilters.has(rowStatusLabel(row)) || !row.cancelled)
      && (typeFilters.length === 0 || typeFilters.includes(row.kind))
      && (statusFilters.length === 0 || statusFilters.includes(rowStatusLabel(row)))
    ))
    .sort((left, right) => {
      const valueFor = SORT_VALUE[sortKey];
      const leftValue = valueFor(left);
      const rightValue = valueFor(right);
      if (!leftValue && rightValue) return 1;
      if (leftValue && !rightValue) return -1;
      const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const changeSort = (nextKey) => {
    if (nextKey === sortKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(nextKey);
      setSortDirection('asc');
    }
  };

  const open = (row) => navigate(row.path, { state: { returnTo: '/admin/events' } });
  const onRowKeyDown = (keyEvent, row) => {
    if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
      keyEvent.preventDefault();
      open(row);
    }
  };
  const start = (path) => navigate(path, { state: { returnTo: '/admin/events' } });

  return <div className="view active">
    <div className="view-header">
      <div><h1 className="view-title">Events</h1><p className="view-sub">Trainings, speaking engagements, and standalone events in one place.</p></div>
      <div className="event-create-actions">
        <button className="btn btn-ghost" onClick={() => start('/admin/events/new')}>+ Other Event</button>
        <button className="btn btn-primary" onClick={() => start('/admin/speaking/new')}>+ Speaking Engagement</button>
        <button className="btn btn-primary" onClick={() => start('/admin/trainings/new')}>+ Training</button>
      </div>
    </div>
    <div className="event-list-controls" aria-label="Event list controls">
      <div className="event-filter-group"><span className="event-filter-label">Type</span><MultiSelectPills options={TYPE_OPTIONS} value={typeFilters} onChange={setTypeFilters} ariaLabel="Filter events by type" /></div>
      <div className="event-filter-group"><span className="event-filter-label">Status</span><MultiSelectPills options={statusOptions} value={statusFilters} onChange={setStatusFilters} ariaLabel="Filter events by status" /></div>
      <button type="button" className={`pill-btn event-cancelled-filter ${showCancelled ? 'active' : ''}`} aria-pressed={showCancelled} onClick={() => setShowCancelled((current) => !current)}>Show Cancelled</button>
      {(typeFilters.length > 0 || statusFilters.length > 0 || showCancelled) && <button type="button" className="btn-sm btn-sm-ghost event-clear-filters" onClick={() => { setTypeFilters([]); setStatusFilters([]); setShowCancelled(false); }}>Clear Filters</button>}
    </div>
    {error ? <section className="empty-hint" role="alert">Couldn’t load events. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : loading ? <LoadingIndicator label="Loading events…" /> : <div className="responses-table-wrap"><table className="responses-table event-list-table"><thead><tr><SortableHeader label="Event" sortKey="title" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /><SortableHeader label="Type" sortKey="type" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /><SortableHeader label="Organization / Client" sortKey="organization" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /><SortableHeader label="Date" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /><SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /><SortableHeader label="Location" sortKey="location" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></tr></thead><tbody>{visibleRows.length ? visibleRows.map((row) => <tr className="client-list-row clickable-row" key={row.key} tabIndex="0" role="button" aria-label={`Open ${row.title}`} onClick={() => open(row)} onKeyDown={(keyEvent) => onRowKeyDown(keyEvent, row)}><td>{row.title}</td><td>{typeLabel(row)}</td><td>{row.organization || '—'}</td><td>{rowDate(row)}</td><td><StatusBadge status={row.status} label={rowStatusLabel(row)} /></td><td>{row.location || '—'}</td></tr>) : <tr><td colSpan="6">No events match these filters.</td></tr>}</tbody></table></div>}
  </div>;
}
