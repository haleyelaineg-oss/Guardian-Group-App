// ============================================================
// GUARDIAN GROUP — workshops.js
// Loads upcoming workshops from Supabase and renders the listing
// ============================================================

(async function () {
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const loadingScreen = document.getElementById('loadingScreen');
  const workshopsMain = document.getElementById('workshopsMain');
  const workshopsGrid = document.getElementById('workshopsGrid');
  const emptyState    = document.getElementById('emptyState');

  // ── Load workshops ────────────────────────────────────────
  const { data: workshops, error } = await supabase
    .from('workshops')
    .select('*')
    .in('status', ['upcoming', 'registration_open'])
    .eq('is_active', true)
    .order('scheduled_at', { ascending: true });

  loadingScreen.style.display = 'none';
  workshopsMain.style.display = '';

  if (error || !workshops || workshops.length === 0) {
    emptyState.style.display = '';
    return;
  }

  // ── Load seat counts for all workshops ───────────────────
  const workshopIds = workshops.map(w => w.id);
  const { data: seatData } = await supabase
    .from('registrations')
    .select('workshop_id, seats_purchased')
    .in('workshop_id', workshopIds);

  const seatsSold = {};
  if (seatData) {
    for (const row of seatData) {
      seatsSold[row.workshop_id] = (seatsSold[row.workshop_id] || 0) + (row.seats_purchased || 0);
    }
  }

  // ── Render cards ─────────────────────────────────────────
  for (const w of workshops) {
    const card = buildCard(w, seatsSold[w.id] || 0);
    workshopsGrid.appendChild(card);
  }
})();

// ── Build a single workshop card ──────────────────────────
function buildCard(w, seatsSold) {
  const card = document.createElement('div');
  card.className = 'workshop-card';

  const accentColor = w.accent_color || '#2A5C76';
  const seatsRemaining = w.max_seats ? w.max_seats - seatsSold : null;
  const isFull = seatsRemaining !== null && seatsRemaining <= 0;
  const isOpen = w.status === 'registration_open';

  // Accent strip
  const accent = document.createElement('div');
  accent.className = 'workshop-card-accent';
  accent.style.background = accentColor;
  card.appendChild(accent);

  // Card body
  const body = document.createElement('div');
  body.className = 'workshop-card-body';

  // Status badge
  const statusBadge = document.createElement('div');
  statusBadge.className = 'workshop-card-status' + (isOpen ? ' open' : '');
  statusBadge.textContent = isFull ? 'Sold Out' : (isOpen ? 'Registration Open' : 'Upcoming');
  body.appendChild(statusBadge);

  // Title
  const title = document.createElement('div');
  title.className = 'workshop-card-title';
  title.textContent = w.title;
  body.appendChild(title);

  // Subtitle
  if (w.subtitle) {
    const sub = document.createElement('div');
    sub.className = 'workshop-card-subtitle';
    sub.textContent = w.subtitle;
    body.appendChild(sub);
  }

  // Meta rows
  const meta = document.createElement('div');
  meta.className = 'workshop-card-meta';

  if (w.scheduled_at) {
    meta.appendChild(metaRow('📅', 'Date', formatDateTime(w.scheduled_at, w.duration_minutes)));
  } else if (w.workshop_date) {
    meta.appendChild(metaRow('📅', 'Date', formatDate(w.workshop_date)));
  }

  if (w.facilitator) {
    meta.appendChild(metaRow('👤', 'Lead By', w.facilitator));
  }

  if (seatsRemaining !== null) {
    const seatsEl = metaRow('◉', 'Seats Remaining', '');
    const valEl = seatsEl.querySelector('.card-meta-value');
    if (isFull) {
      valEl.textContent = 'Sold Out';
      valEl.className = 'card-meta-value card-meta-seats-none';
    } else if (seatsRemaining < 10) {
      valEl.textContent = `${seatsRemaining} seat${seatsRemaining === 1 ? '' : 's'} left`;
      valEl.className = 'card-meta-value card-meta-seats-low';
    } else {
      valEl.textContent = `${seatsRemaining}`;
    }
    meta.appendChild(seatsEl);
  }

  body.appendChild(meta);

  // Price
  if (w.price_per_seat != null) {
    const price = document.createElement('div');
    price.className = 'workshop-card-price';
    price.innerHTML = formatCurrency(w.price_per_seat) + ' <span>per seat</span>';
    body.appendChild(price);
  }

  card.appendChild(body);

  // Footer / CTA
  const footer = document.createElement('div');
  footer.className = 'workshop-card-footer';

  const learnBtn = document.createElement('button');
  learnBtn.className = 'btn btn-ghost';
  learnBtn.textContent = 'Learn More';
  learnBtn.addEventListener('click', () => openWsModal(w, seatsSold));
  footer.appendChild(learnBtn);

  if (isFull) {
    const btn = document.createElement('span');
    btn.className = 'btn btn-disabled';
    btn.textContent = 'Sold Out';
    footer.appendChild(btn);
  } else {
    const btn = document.createElement('a');
    btn.className = 'btn btn-primary';
    btn.href = `/register/?workshop=${encodeURIComponent(w.slug)}`;
    btn.textContent = 'Register Now →';
    footer.appendChild(btn);
  }

  card.appendChild(footer);
  return card;
}

// ── Workshop detail modal ─────────────────────────────────
function openWsModal(w, seatsSold) {
  const seatsRemaining = w.max_seats ? w.max_seats - seatsSold : null;
  const isFull = seatsRemaining !== null && seatsRemaining <= 0;
  const isOpen = w.status === 'registration_open';
  const accentColor = w.accent_color || '#2A5C76';

  document.getElementById('wsModalAccent').style.background = accentColor;
  document.getElementById('wsModalTitle').textContent = w.title;
  document.getElementById('wsModalSubtitle').textContent = w.subtitle || '';
  document.getElementById('wsModalSubtitle').style.display = w.subtitle ? '' : 'none';
  document.getElementById('wsModalDescription').textContent = w.description || '';
  document.getElementById('wsModalDescription').style.display = w.description ? '' : 'none';

  const statusEl = document.getElementById('wsModalStatus');
  statusEl.textContent = isFull ? 'Sold Out' : (isOpen ? 'Registration Open' : 'Upcoming');
  statusEl.className = 'ws-modal-status' + (isOpen && !isFull ? ' open' : '');

  const meta = document.getElementById('wsModalMeta');
  const rows = [];
  if (w.scheduled_at) rows.push(['📅', 'Date', formatDateTime(w.scheduled_at, w.duration_minutes)]);
  else if (w.workshop_date) rows.push(['📅', 'Date', formatDate(w.workshop_date)]);
  if (w.facilitator) rows.push(['👤', 'Lead By', w.facilitator]);
  if (seatsRemaining !== null) {
    const seatsText = isFull ? 'Sold out' : (seatsRemaining < 10 ? `${seatsRemaining} seat${seatsRemaining === 1 ? '' : 's'} left` : `${seatsRemaining} seats available`);
    rows.push(['◉', 'Availability', seatsText]);
  }
  meta.innerHTML = rows.map(([icon, label, value]) =>
    `<div class="card-meta-row"><span class="card-meta-icon">${icon}</span><span class="card-meta-label" style="color:var(--gg-muted);font-size:13px">${label}:</span><span class="card-meta-value">${value}</span></div>`
  ).join('');

  const priceEl = document.getElementById('wsModalPrice');
  if (w.price_per_seat != null) {
    priceEl.innerHTML = formatCurrency(w.price_per_seat) + ' <span>per seat</span>';
    priceEl.style.display = '';
  } else {
    priceEl.style.display = 'none';
  }

  const registerBtn = document.getElementById('wsModalRegister');
  if (isFull) {
    registerBtn.textContent = 'Sold Out';
    registerBtn.className = 'btn btn-disabled ws-modal-register';
    registerBtn.removeAttribute('href');
  } else {
    registerBtn.textContent = 'Register Now →';
    registerBtn.className = 'btn btn-primary ws-modal-register';
    registerBtn.href = `/register/?workshop=${encodeURIComponent(w.slug)}`;
  }

  document.getElementById('wsModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeWsModal() {
  document.getElementById('wsModal').style.display = 'none';
  document.body.style.overflow = '';
}

function handleWsModalClick(e) {
  if (e.target === document.getElementById('wsModal')) closeWsModal();
}

// ── Helper: single meta row element ──────────────────────
function metaRow(icon, label, value) {
  const row = document.createElement('div');
  row.className = 'card-meta-row';
  row.innerHTML = `
    <span class="card-meta-icon">${icon}</span>
    <span class="card-meta-label" style="color:var(--gg-muted);font-size:13px">${label}:</span>
    <span class="card-meta-value">${value}</span>
  `;
  return row;
}

// ── Helpers: date formatting ──────────────────────────────
function formatDateTime(isoString, durationMinutes) {
  const d = new Date(isoString);
  const dateStr = d.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const dur = durationMinutes ? ` (${Math.round(durationMinutes / 60)}h)` : '';
  return `${dateStr} · ${timeStr}${dur}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}
