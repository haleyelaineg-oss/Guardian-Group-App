export default function SingleSelectPills({ options, value, onChange, ariaLabel = 'Options' }) {
  return <div className="pill-select" role="group" aria-label={ariaLabel}>{options.map((option) => <button key={option} type="button" className={`pill ${value === option ? 'active' : ''}`} onClick={() => onChange(value === option ? '' : option)}>{option}</button>)}</div>;
}
