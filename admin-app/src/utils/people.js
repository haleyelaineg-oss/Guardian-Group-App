export const PERSON_CHOICES = [
  { value: 'haley', label: 'Haley', people: ['Haley'] },
  { value: 'dave', label: 'Dave', people: ['Dave'] },
  { value: 'both', label: 'Both', people: ['Haley', 'Dave'] },
];

export const PERSON_FILTER_OPTIONS = PERSON_CHOICES
  .filter((choice) => choice.value !== 'both')
  .map((choice) => ({ value: choice.label, label: choice.label }));

function storedName(person) {
  if (typeof person === 'string') return person;
  return person?.name || '';
}

export function peopleFromValue(value) {
  const names = Array.isArray(value) ? value.map(storedName) : [];
  const selected = new Set();

  names.forEach((name) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return;
    if (normalized === 'both') {
      selected.add('Haley');
      selected.add('Dave');
      return;
    }
    if (normalized.includes('haley')) selected.add('Haley');
    if (normalized.includes('dave') || normalized.includes('david')) selected.add('Dave');
  });

  return ['Haley', 'Dave'].filter((name) => selected.has(name));
}

export function peopleChoice(value) {
  const people = peopleFromValue(value);
  if (people.length === 2) return 'both';
  if (people[0] === 'Haley') return 'haley';
  if (people[0] === 'Dave') return 'dave';
  return '';
}

export function peopleForChoice(choice) {
  return PERSON_CHOICES.find((option) => option.value === choice)?.people || [];
}

export function peopleLabel(value) {
  const people = peopleFromValue(value);
  return people.length === 2 ? 'Both' : people[0] || '';
}
