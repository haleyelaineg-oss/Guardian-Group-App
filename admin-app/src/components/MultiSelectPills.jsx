export default function MultiSelectPills({ options, value = [], onChange, ariaLabel = 'Options', className = '' }) {
  const optionValue = (option) => typeof option === 'string' ? option : option.value;
  const optionLabel = (option) => typeof option === 'string' ? option : option.label;
  function toggle(option) {
    const nextValue = optionValue(option);
    onChange(value.includes(nextValue) ? value.filter((item) => item !== nextValue) : [...value, nextValue]);
  }
  return <div className={`pill-group ${className}`.trim()} role="group" aria-label={ariaLabel}>{options.map((option) => {
    const nextValue = optionValue(option);
    const selected = value.includes(nextValue);
    return <button key={nextValue} type="button" className={`pill-btn ${selected ? 'active' : ''}`} aria-pressed={selected} onClick={() => toggle(option)}>{optionLabel(option)}</button>;
  })}</div>;
}
