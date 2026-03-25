// ============================================================
// GUARDIAN GROUP — register.js
// Multi-step registration flow with Square payment + Supabase
//
// SQUARE SETUP REQUIRED:
//   1. Replace SQUARE_APP_ID and SQUARE_LOCATION_ID below
//   2. Create a Netlify function at /api/create-payment that
//      accepts { nonce, amountCents, note } and returns
//      { transactionId, orderId } after charging the card.
//      (Square charges must happen server-side — not in the browser.)
//   3. Switch register/index.html Square SDK URL from sandbox
//      to production when you go live.
// ============================================================

const SQUARE_APP_ID      = 'sandbox-sq0idb-sQ9SUrQ4y7O3ivE9FEWFQA';       // e.g. sq0idp-xxxxx
const SQUARE_LOCATION_ID = 'LZKX2ZGRJBQQ7';  // e.g. LXXXXXXXXX

// ── State ────────────────────────────────────────────────────
let db            = null;
let workshop      = null;
let currentStep   = 1;
const TOTAL_STEPS = 4;
let registrationType = null; // 'myself' | 'myself_and_others' | 'others_only'
let squareCard    = null;
let isSubmitting  = false;

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const params = new URLSearchParams(window.location.search);
  const slug   = params.get('workshop');

  if (!slug) {
    showError('No workshop was specified in this link.');
    return;
  }

  const { data, error } = await db
    .from('workshops')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  document.getElementById('loadingScreen').style.display = 'none';

  if (error || !data) {
    showError('This workshop could not be found or is no longer active.');
    return;
  }

  workshop = data;
  renderHero();
  wireTypeCards();
  wireSeatCount();
  wireNavButtons();
  showStep(1);
  document.getElementById('registrationContainer').style.display = '';
}

// ── Hero ──────────────────────────────────────────────────────
function renderHero() {
  document.title = `Register — ${workshop.title} — Guardian Group`;
  document.getElementById('regWorkshopTitle').textContent = workshop.title;

  const dateEl = document.getElementById('regHeroDate');
  if (workshop.scheduled_at) {
    dateEl.textContent = formatDateTime(workshop.scheduled_at);
  } else if (workshop.workshop_date) {
    dateEl.textContent = formatDate(workshop.workshop_date);
  }

  const facEl = document.getElementById('regHeroFacilitator');
  if (workshop.facilitator) facEl.textContent = `Facilitator: ${workshop.facilitator}`;

  const priceEl = document.getElementById('regHeroPrice');
  if (workshop.price_per_seat != null) {
    priceEl.textContent = `${formatCurrency(workshop.price_per_seat)} per seat`;
  }
}

// ── Step navigation ───────────────────────────────────────────
function showStep(n) {
  currentStep = n;

  document.querySelectorAll('.reg-step').forEach(s => s.classList.remove('active'));
  const stepEl = document.querySelector(`.reg-step[data-step="${n}"]`);
  if (stepEl) stepEl.classList.add('active');

  // Progress indicators
  document.querySelectorAll('.progress-step').forEach(dot => {
    const d = parseInt(dot.dataset.step);
    dot.classList.remove('active', 'done');
    if (d < n)      dot.classList.add('done');
    else if (d === n) dot.classList.add('active');
  });

  const pct = Math.round(((n - 1) / TOTAL_STEPS) * 100);
  document.getElementById('progressFill').style.width = `${pct + 25}%`;
  document.getElementById('progressLabel').textContent = `Step ${n} of ${TOTAL_STEPS}`;

  // Back button
  document.getElementById('btnBack').style.display = n > 1 ? '' : 'none';

  // Next / Pay buttons
  const btnNext = document.getElementById('btnNext');
  const btnPay  = document.getElementById('btnPay');
  const reqNote = document.getElementById('requiredNote');

  if (n === TOTAL_STEPS) {
    btnNext.style.display = 'none';
    btnPay.style.display  = '';
    reqNote.style.display = 'none';
    populateOrderSummary();
    initSquare();
  } else {
    btnNext.style.display = '';
    btnPay.style.display  = 'none';
    reqNote.style.display = '';
  }

  // Step-specific label on Next button
  btnNext.textContent = n === TOTAL_STEPS - 1 ? 'Review Order →' : 'Continue →';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Nav buttons ───────────────────────────────────────────────
function wireNavButtons() {
  document.getElementById('btnNext').addEventListener('click', () => {
    if (validateStep(currentStep)) showStep(currentStep + 1);
  });

  document.getElementById('btnBack').addEventListener('click', () => {
    if (currentStep > 1) showStep(currentStep - 1);
  });

  document.getElementById('btnPay').addEventListener('click', handlePayment);
}

// ── Validation ────────────────────────────────────────────────
function validateStep(n) {
  if (n === 1) {
    if (!registrationType) {
      alert('Please select a registration type to continue.');
      return false;
    }
    return true;
  }

  if (n === 2) {
    const form = document.getElementById('purchaserForm');
    const required = form.querySelectorAll('[required]');
    let valid = true;
    required.forEach(el => {
      const group = el.closest('.field-group');
      if (!el.value.trim()) {
        el.classList.add('error');
        if (group) group.classList.add('has-error');
        valid = false;
      } else {
        el.classList.remove('error');
        if (group) group.classList.remove('has-error');
      }
    });
    if (!valid) { alert('Please fill in all required fields.'); return false; }

    // If "just myself", skip step 3 — purchaser IS the attendee
    if (registrationType === 'myself') {
      buildAttendeesFromPurchaser();
      currentStep = 2; // will be incremented to 3, then we skip to 4
      showStep(4);
      return false; // prevent default increment
    }

    buildAttendeeCards();
    return true;
  }

  if (n === 3) {
    const cards = document.querySelectorAll('.attendee-card');
    let valid = true;
    cards.forEach(card => {
      const inputs = card.querySelectorAll('[required]');
      inputs.forEach(el => {
        if (!el.value.trim()) {
          el.classList.add('error');
          valid = false;
        } else {
          el.classList.remove('error');
        }
      });
    });
    if (!valid) { alert('Please fill in name and email for every attendee.'); return false; }
    return true;
  }

  return true;
}

// ── Registration type cards ───────────────────────────────────
function wireTypeCards() {
  document.querySelectorAll('.reg-type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.reg-type-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input[type="radio"]').checked = true;
      registrationType = card.dataset.type;
    });
  });
}

// ── Seat count input ──────────────────────────────────────────
function wireSeatCount() {
  const input = document.getElementById('seatCount');
  input.addEventListener('change', () => {
    const n = getSeatCount();
    buildAttendeeCards(n);
  });
}

function getSeatCount() {
  const raw  = parseInt(document.getElementById('seatCount').value, 10);
  const max  = workshop.max_seats || 999;
  const capped = Math.max(1, Math.min(raw || 1, max));
  document.getElementById('seatCount').value = capped;
  return capped;
}

// ── Attendee cards ────────────────────────────────────────────
function buildAttendeeCards(count) {
  const wrap = document.getElementById('seatCountWrap');
  const list = document.getElementById('attendeesList');
  const desc = document.getElementById('step3Desc');

  list.innerHTML = '';

  if (registrationType === 'myself_and_others') {
    wrap.style.display = '';
    desc.textContent   = 'Your info is pre-filled for the first seat. Add your colleagues below.';

    const n = count || getSeatCount();

    for (let i = 0; i < n; i++) {
      const isSelf = i === 0;
      list.appendChild(buildAttendeeCard(i + 1, isSelf));
    }

    // Update seat count max note
    if (workshop.max_seats) {
      document.getElementById('seatAvailNote').textContent = `(max ${workshop.max_seats})`;
    }

  } else if (registrationType === 'others_only') {
    wrap.style.display = '';
    desc.textContent   = 'Enter the name and email for each person attending.';

    const n = count || getSeatCount();
    for (let i = 0; i < n; i++) {
      list.appendChild(buildAttendeeCard(i + 1, false));
    }
  }
}

function buildAttendeeCard(num, isSelf) {
  const card = document.createElement('div');
  card.className = 'attendee-card';
  card.dataset.index = num - 1;

  const hdr = document.createElement('div');
  hdr.className = 'attendee-card-header';

  const lbl = document.createElement('div');
  lbl.className = 'attendee-card-num' + (isSelf ? ' self-label' : '');
  lbl.textContent = isSelf ? 'Attendee 1 — You' : `Attendee ${num}`;
  hdr.appendChild(lbl);

  if (isSelf) {
    const sameBtn = document.createElement('button');
    sameBtn.type = 'button';
    sameBtn.className = 'btn-same-as-me';
    sameBtn.textContent = 'Same as my info';
    sameBtn.addEventListener('click', () => prefillFromPurchaser(card));
    hdr.appendChild(sameBtn);
  }

  card.appendChild(hdr);

  const body = document.createElement('div');
  body.className = 'attendee-card-body';
  body.innerHTML = `
    <div class="fields-grid">
      <div class="field-group half">
        <label class="field-label">Full Name <span class="required">*</span></label>
        <input type="text" class="field-input attendee-name" placeholder="Full name" required />
      </div>
      <div class="field-group half">
        <label class="field-label">Email <span class="required">*</span></label>
        <input type="email" class="field-input attendee-email" placeholder="email@example.com" required />
      </div>
    </div>
  `;
  card.appendChild(body);

  if (isSelf) prefillFromPurchaser(card);
  return card;
}

function prefillFromPurchaser(card) {
  const name  = document.getElementById('purchaserName').value;
  const email = document.getElementById('purchaserEmail').value;
  if (name)  card.querySelector('.attendee-name').value  = name;
  if (email) card.querySelector('.attendee-email').value = email;
}

function buildAttendeesFromPurchaser() {
  // For "just myself" — single attendee = purchaser, built at submit time
}

// ── Read attendees from DOM ───────────────────────────────────
function readAttendees() {
  if (registrationType === 'myself') {
    return [{
      name:   document.getElementById('purchaserName').value.trim(),
      email:  document.getElementById('purchaserEmail').value.trim(),
      isSelf: true
    }];
  }

  const attendees = [];
  document.querySelectorAll('.attendee-card').forEach((card, i) => {
    attendees.push({
      name:   card.querySelector('.attendee-name').value.trim(),
      email:  card.querySelector('.attendee-email').value.trim(),
      isSelf: i === 0 && registrationType === 'myself_and_others'
    });
  });
  return attendees;
}

// ── Order summary ─────────────────────────────────────────────
function populateOrderSummary() {
  const attendees = readAttendees();
  const seats     = attendees.length;
  const price     = workshop.price_per_seat || 0;
  const total     = price * seats;

  document.getElementById('summaryWorkshop').textContent    = workshop.title;
  document.getElementById('summaryDate').textContent        = workshop.scheduled_at
    ? formatDateTime(workshop.scheduled_at)
    : (workshop.workshop_date ? formatDate(workshop.workshop_date) : '—');
  document.getElementById('summaryRegistrant').textContent  =
    `${document.getElementById('purchaserName').value} (${document.getElementById('purchaserEmail').value})`;
  document.getElementById('summarySeats').textContent       = seats;
  document.getElementById('summaryPricePerSeat').textContent = formatCurrency(price);
  document.getElementById('summaryTotal').textContent       = formatCurrency(total);
}

// ── Square setup ──────────────────────────────────────────────
async function initSquare() {
  if (squareCard) return; // already initialized

  if (typeof Square === 'undefined') {
    showPaymentError('Payment system failed to load. Please refresh the page.');
    return;
  }

  if (SQUARE_APP_ID === 'YOUR_SQUARE_APP_ID') {
    // Dev mode — show a notice instead of crashing
    document.getElementById('card-container').innerHTML =
      '<p style="color:var(--gg-muted);font-size:13px;padding:16px 0">⚠ Square not yet configured — set SQUARE_APP_ID and SQUARE_LOCATION_ID in js/register.js</p>';
    return;
  }

  try {
    const payments = Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
    squareCard = await payments.card();
    await squareCard.attach('#card-container');
  } catch (err) {
    showPaymentError('Could not load the payment form. Please refresh and try again.');
    console.error('Square init error:', err);
  }
}

// ── Payment flow ──────────────────────────────────────────────
async function handlePayment() {
  if (isSubmitting) return;

  hidePaymentError();

  // Dev mode bypass (no Square configured)
  if (SQUARE_APP_ID === 'YOUR_SQUARE_APP_ID') {
    showPaymentError('Payment is not yet configured. Set your Square credentials in js/register.js.');
    return;
  }

  if (!squareCard) {
    showPaymentError('Payment form is not ready. Please refresh the page.');
    return;
  }

  isSubmitting = true;
  const btnPay = document.getElementById('btnPay');
  btnPay.disabled = true;
  btnPay.textContent = 'Processing...';

  try {
    // 1. Tokenize card
    const tokenResult = await squareCard.tokenize();
    if (tokenResult.status !== 'OK') {
      const msgs = (tokenResult.errors || []).map(e => e.message).join(' ');
      throw new Error(msgs || 'Card details could not be verified.');
    }

    const nonce      = tokenResult.token;
    const attendees  = readAttendees();
    const amountCents = Math.round((workshop.price_per_seat || 0) * attendees.length * 100);

    // 2. Charge via Netlify function (create this at /netlify/functions/create-payment.js)
    const resp = await fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nonce,
        amountCents,
        note: `${workshop.title} — ${attendees.length} seat(s) — ${document.getElementById('purchaserName').value}`
      })
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.message || 'Payment was declined. Please check your card details.');
    }

    const { transactionId = null, orderId = null } = await resp.json();

    // 3. Write to Supabase
    await writeToSupabase(transactionId, orderId, attendees);

    // 4. Show confirmation
    showSuccess(attendees);

  } catch (err) {
    showPaymentError(err.message || 'An unexpected error occurred. Please try again.');
    console.error('Payment error:', err);
    isSubmitting = false;
    btnPay.disabled = false;
    btnPay.textContent = 'Complete Registration →';
  }
}

// ── Write to Supabase ─────────────────────────────────────────
async function writeToSupabase(transactionId, orderId, attendees) {
  const purchaserName    = document.getElementById('purchaserName').value.trim();
  const purchaserEmail   = document.getElementById('purchaserEmail').value.trim();
  const purchaserCompany = document.getElementById('purchaserCompany').value.trim();

  // 1. Upsert company
  let companyId = null;
  if (purchaserCompany) {
    const { data: existing } = await db
      .from('companies')
      .select('id')
      .eq('name', purchaserCompany)
      .maybeSingle();

    if (existing) {
      companyId = existing.id;
    } else {
      const { data: newCo } = await db
        .from('companies')
        .insert({ name: purchaserCompany, contact_name: purchaserName, contact_email: purchaserEmail })
        .select('id')
        .single();
      companyId = newCo?.id ?? null;
    }
  }

  // 2. Insert purchaser as participant
  const { data: purchaserRecord } = await db
    .from('participants')
    .insert({ full_name: purchaserName, email: purchaserEmail, company_id: companyId })
    .select('id')
    .single();
  const purchaserId = purchaserRecord?.id ?? null;

  // 3. Insert registration
  const { data: registration } = await db
    .from('registrations')
    .insert({
      workshop_id:          workshop.id,
      purchaser_id:         purchaserId,
      registration_type:    registrationType,
      seats_purchased:      attendees.length,
      total_paid:           (workshop.price_per_seat || 0) * attendees.length,
      square_transaction_id: transactionId,
      square_order_id:       orderId
    })
    .select('id')
    .single();
  const registrationId = registration?.id ?? null;

  // 4. Insert attendees + attendance rows
  for (const attendee of attendees) {
    let participantId;

    // If this seat is the purchaser themselves, reuse their participant record
    if (attendee.isSelf && registrationType !== 'others_only') {
      participantId = purchaserId;
    } else {
      const { data: p } = await db
        .from('participants')
        .insert({ full_name: attendee.name, email: attendee.email, company_id: companyId })
        .select('id')
        .single();
      participantId = p?.id ?? null;
    }

    await db.from('attendance').insert({
      registration_id: registrationId,
      workshop_id:     workshop.id,
      participant_id:  participantId,
      status:          'registered'
    });
  }
}

// ── Success screen ────────────────────────────────────────────
function showSuccess(attendees) {
  document.getElementById('registrationContainer').style.display = 'none';

  const details = document.getElementById('confirmationDetails');
  const dateStr = workshop.scheduled_at
    ? formatDateTime(workshop.scheduled_at)
    : (workshop.workshop_date ? formatDate(workshop.workshop_date) : '—');

  details.innerHTML = `
    <div class="confirmation-detail-row">
      <span class="conf-label">Workshop</span>
      <span class="conf-value">${escHtml(workshop.title)}</span>
    </div>
    <div class="confirmation-detail-row">
      <span class="conf-label">Date</span>
      <span class="conf-value">${escHtml(dateStr)}</span>
    </div>
    <div class="confirmation-detail-row">
      <span class="conf-label">Seats</span>
      <span class="conf-value">${attendees.length}</span>
    </div>
    <div class="confirmation-detail-row">
      <span class="conf-label">Attendee${attendees.length > 1 ? 's' : ''}</span>
      <span class="conf-value">${attendees.map(a => escHtml(a.name)).join('<br />')}</span>
    </div>
    <div class="confirmation-detail-row">
      <span class="conf-label">Total paid</span>
      <span class="conf-value">${formatCurrency((workshop.price_per_seat || 0) * attendees.length)}</span>
    </div>
  `;

  document.getElementById('successScreen').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Error screen ──────────────────────────────────────────────
function showError(message) {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('registrationContainer').style.display = 'none';
  if (message) document.getElementById('errorMessage').textContent = message;
  document.getElementById('errorScreen').style.display = '';
}

function showPaymentError(message) {
  const el = document.getElementById('paymentError');
  el.textContent = message;
  el.classList.add('visible');
}

function hidePaymentError() {
  document.getElementById('paymentError').classList.remove('visible');
}

// ── Date / currency helpers ───────────────────────────────────
function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(amount);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
