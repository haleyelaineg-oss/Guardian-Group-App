// Shared formatting helpers, ported 1:1 from js/admin.js so every feature
// renders dates/etc. identically to the vanilla app. Add to this file only
// when a second feature actually needs the same helper — don't pre-populate
// it with formatters nothing calls yet.

export function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
