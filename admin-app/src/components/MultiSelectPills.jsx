export default function MultiSelectPills({ options, value = [], onChange, ariaLabel = 'Options' }) {
  function toggle(option) { onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]); }
  return <div className="pill-select" role="group" aria-label={ariaLabel}>{options.map((option) => <button key={option} type="button" className={`pill ${value.includes(option) ? 'active' : ''}`} onClick={() => toggle(option)}>{option}</button>)}</div>;
}
