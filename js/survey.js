// ============================================================
// GUARDIAN GROUP — survey.js
// Handles: workshop loading, multi-step form, submission
// ============================================================

const ggClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentSection = 1;
const totalSections = 5;
let workshopData = null;

let useDynamicSurvey = false;
let dynamicQuestions = [];

const sectionTitles = ['About You', 'Starting Point', 'Your Goals', 'Team & Org', 'Logistics'];

// ── INIT ─────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('workshop');

  if (!slug) {
    showError();
    return;
  }

  const { data, error } = await ggClient
    .from('workshops')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    showError();
    return;
  }

  workshopData = data;
  loadWorkshop(data);
}

function loadWorkshop(ws) {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('surveyContainer').style.display = 'block';

  document.title = `Pre-Workshop Survey — ${ws.title} | Guardian Group`;
  document.getElementById('workshopTitle').textContent = ws.title;

  if (ws.subtitle) {
    document.getElementById('workshopSubtitle').textContent = ws.subtitle;
  }
  if (ws.facilitator) {
    document.getElementById('heroFacilitator').textContent = `Facilitated by ${ws.facilitator}`;
  }
  if (ws.workshop_date) {
    const d = new Date(ws.workshop_date);
    document.getElementById('heroDate').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  if (ws.accent_color) {
    document.documentElement.style.setProperty('--gg-mid', ws.accent_color);
  }

  workshopData = ws;

  const hasDynamic = Array.isArray(ws.survey_config) && ws.survey_config.length > 0;
  if (hasDynamic) {
    useDynamicSurvey = true;
    dynamicQuestions = ws.survey_config;
    setupDynamicSurvey();
  } else {
    useDynamicSurvey = false;
    setupStaticSurvey();
  }
}

function setupStaticSurvey() {
  document.getElementById('staticSurveyWrapper').style.display = 'block';
  document.getElementById('dynamicSurveyWrapper').style.display = 'none';
  document.querySelector('.progress-wrap').style.display = 'block';
  document.getElementById('btnBack').style.display = currentSection > 1 ? 'inline-flex' : 'none';
  document.getElementById('btnNext').style.display = currentSection < totalSections ? 'inline-flex' : 'none';
  document.getElementById('btnSubmit').style.display = currentSection === totalSections ? 'inline-flex' : 'none';
  buildProgressSteps();
  updateProgress();
  goToSection(1);
}

function setupDynamicSurvey() {
  document.getElementById('staticSurveyWrapper').style.display = 'none';
  document.getElementById('dynamicSurveyWrapper').style.display = 'block';
  document.querySelector('.progress-wrap').style.display = 'none';

  const form = document.getElementById('dynamicSurveyForm');
  form.innerHTML = '';

  const questions = [...dynamicQuestions].sort((a, b) => (a.section - b.section) || (a.position - b.position));
  if (!questions.length) {
    form.innerHTML = '<p>Please define survey questions in the admin dashboard.</p>';
    return;
  }

  let lastSection = null;
  questions.forEach(q => {
    if (q.section !== lastSection) {
      const sectionLabel = document.createElement('div');
      sectionLabel.className = 'section-header';
      sectionLabel.innerHTML = `<div class="section-number">${String(q.section).padStart(2, '0')}</div><div class="section-meta"><h2 class="section-title">${sectionTitles[q.section - 1] || 'Custom'}<\/h2><p class="section-desc">Custom questions for this section.<\/p><\/div>`;
      form.appendChild(sectionLabel);
      lastSection = q.section;
    }

    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group full';

    const label = document.createElement('label');
    label.className = 'field-label';
    label.setAttribute('for', q.id);
    label.textContent = q.text;
    if (q.required) label.innerHTML += ' <span class="required">*</span>';
    fieldGroup.appendChild(label);

    let inputEl;
    if (q.type === 'textarea') {
      inputEl = document.createElement('textarea');
      inputEl.rows = 3;
      inputEl.className = 'field-input field-textarea';
    } else if (q.type === 'select') {
      inputEl = document.createElement('select');
      inputEl.className = 'field-input field-select';
      inputEl.innerHTML = '<option value="">Select...</option>' + (q.options || []).map(opt => `<option>${opt}<\/option>`).join('');
    } else if (q.type === 'radio' || q.type === 'checkbox') {
      const group = document.createElement('div');
      group.className = q.type === 'radio' ? 'radio-group' : 'checkbox-group';
      (q.options || []).forEach((opt, idx) => {
        const item = document.createElement('label');
        item.className = `${q.type}-item`;
        const input = document.createElement('input');
        input.type = q.type;
        input.name = q.id;
        input.value = opt;
        item.appendChild(input);
        const box = document.createElement('span');
        box.className = `${q.type}-box`;
        item.appendChild(box);
        const labelText = document.createElement('span');
        labelText.textContent = opt;
        item.appendChild(labelText);
        group.appendChild(item);
      });
      fieldGroup.appendChild(group);
      form.appendChild(fieldGroup);
      return;
    } else {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.className = 'field-input';
    }

    inputEl.id = q.id;
    inputEl.name = q.id;
    inputEl.dataset.required = q.required ? 'true' : 'false';
    fieldGroup.appendChild(inputEl);
    form.appendChild(fieldGroup);
  });

  document.getElementById('dynamicRequiredNote').style.display = questions.some(q => q.required) ? 'inline' : 'none';
}


function showError() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('errorScreen').style.display = 'block';
}

// ── PROGRESS ─────────────────────────────────────────────────
function buildProgressSteps() {
  const container = document.getElementById('progressSteps');
  container.innerHTML = '';
  for (let i = 1; i <= totalSections; i++) {
    const step = document.createElement('div');
    step.className = 'progress-step';
    step.textContent = i;
    step.id = `step-${i}`;
    step.title = sectionTitles[i - 1];
    container.appendChild(step);
  }
}

function updateProgress() {
  for (let i = 1; i <= totalSections; i++) {
    const el = document.getElementById(`step-${i}`);
    if (!el) continue;
    el.className = 'progress-step';
    if (i < currentSection) el.classList.add('done');
    else if (i === currentSection) el.classList.add('active');
  }

  const pct = ((currentSection - 1) / totalSections) * 100;
  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('progressLabel').textContent = `Step ${currentSection} of ${totalSections}`;
}

// ── NAVIGATION ────────────────────────────────────────────────
document.getElementById('btnNext').addEventListener('click', () => {
  if (!validateSection(currentSection)) return;
  if (currentSection < totalSections) {
    goToSection(currentSection + 1);
  }
});

document.getElementById('btnBack').addEventListener('click', () => {
  if (currentSection > 1) goToSection(currentSection - 1);
});

document.getElementById('btnSubmit').addEventListener('click', submitForm);

document.getElementById('btnDynamicSubmit').addEventListener('click', submitDynamicForm);

function goToSection(n) {
  document.querySelector(`.form-section[data-section="${currentSection}"]`).classList.remove('active');
  currentSection = n;
  document.querySelector(`.form-section[data-section="${currentSection}"]`).classList.add('active');

  document.getElementById('btnBack').style.display = currentSection > 1 ? 'inline-flex' : 'none';
  document.getElementById('btnNext').style.display = currentSection < totalSections ? 'inline-flex' : 'none';
  document.getElementById('btnSubmit').style.display = currentSection === totalSections ? 'inline-flex' : 'none';

  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── VALIDATION ────────────────────────────────────────────────
function validateSection(n) {
  let valid = true;

  if (n === 1) {
    valid &= requireField('fullName', 'Please enter your full name');
    valid &= requireField('jobTitle', 'Please enter your job title');
    valid &= requireField('organization', 'Please enter your organization');
    valid &= requireSelect('industry', 'Please select your industry');
    valid &= requireCheckbox('safetyInvolvement', 'Please select at least one option');
  }
  if (n === 2) {
    valid &= requireRadio('safety_ii_familiarity', 'Please select your familiarity level');
  }
  if (n === 3) {
    valid &= requireRadio('attendance_reason', 'Please select your primary reason for attending');
    valid &= requireField('oneThing', 'Please tell us the one thing you hope to walk away with');
  }
  if (n === 5) {
    valid &= requireField('email', 'Please enter your email address');
    valid &= requireEmail('email', 'Please enter a valid email address');
  }

  return !!valid;
}

function requireField(id, msg) {
  const el = document.getElementById(id);
  if (!el || !el.value.trim()) {
    showFieldError(el, msg);
    return false;
  }
  clearFieldError(el);
  return true;
}

function requireSelect(id, msg) {
  const el = document.getElementById(id);
  if (!el || !el.value) {
    showFieldError(el, msg);
    return false;
  }
  clearFieldError(el);
  return true;
}

function requireEmail(id, msg) {
  const el = document.getElementById(id);
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!el || !re.test(el.value)) {
    showFieldError(el, msg);
    return false;
  }
  clearFieldError(el);
  return true;
}

function requireRadio(name, msg) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  if (!checked) {
    const group = document.querySelector(`input[name="${name}"]`);
    if (group) {
      const container = group.closest('.radio-group');
      if (container) showGroupError(container, msg);
    }
    return false;
  }
  return true;
}

function requireCheckbox(groupId, msg) {
  const checked = document.querySelector(`#${groupId} input:checked`);
  if (!checked) {
    const container = document.getElementById(groupId);
    if (container) showGroupError(container, msg);
    return false;
  }
  return true;
}

function showFieldError(el, msg) {
  if (!el) return;
  el.classList.add('error');
  const group = el.closest('.field-group');
  if (group) {
    group.classList.add('has-error');
    let errEl = group.querySelector('.field-error');
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'field-error';
      group.appendChild(errEl);
    }
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearFieldError(el) {
  if (!el) return;
  el.classList.remove('error');
  const group = el.closest('.field-group');
  if (group) {
    group.classList.remove('has-error');
    const errEl = group.querySelector('.field-error');
    if (errEl) errEl.style.display = 'none';
  }
}

function showGroupError(container, msg) {
  const existing = container.nextElementSibling;
  let errEl = (existing && existing.classList.contains('field-error')) ? existing : null;
  if (!errEl) {
    errEl = document.createElement('span');
    errEl.className = 'field-error';
    errEl.style.display = 'block';
    container.parentNode.insertBefore(errEl, container.nextSibling);
  }
  errEl.textContent = msg;
  errEl.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── SUBMIT ────────────────────────────────────────────────────
async function submitForm() {
  if (!validateSection(5)) return;

  const btn = document.getElementById('btnSubmit');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const safetyInvolvement = Array.from(
    document.querySelectorAll('#safetyInvolvement input:checked')
  ).map(cb => cb.value);

  const getRadio = name => {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
  };

  const payload = {
    workshop_id: workshopData.id,
    full_name: document.getElementById('fullName').value.trim(),
    job_title: document.getElementById('jobTitle').value.trim(),
    organization: document.getElementById('organization').value.trim(),
    industry: document.getElementById('industry').value,
    time_in_role: document.getElementById('timeInRole').value || null,
    time_in_industry: document.getElementById('timeInIndustry').value || null,
    safety_involvement: safetyInvolvement,
    safety_ii_familiarity: getRadio('safety_ii_familiarity'),
    safety_culture: getRadio('safety_culture'),
    safety_leadership_description: document.getElementById('safetyLeadership').value.trim() || null,
    attendance_reason: getRadio('attendance_reason'),
    one_thing_wanted: document.getElementById('oneThing').value.trim(),
    specific_challenge: document.getElementById('specificChallenge').value.trim() || null,
    do_not_cover: document.getElementById('doNotCover').value.trim() || null,
    team_size: document.getElementById('teamSize').value || null,
    org_size: document.getElementById('orgSize').value || null,
    org_change_context: document.getElementById('orgChange').value.trim() || null,
    email: document.getElementById('email').value.trim(),
    time_zone: document.getElementById('timeZone').value.trim() || null,
    accessibility_needs: document.getElementById('accessibility').value.trim() || null,
    tech_check: document.getElementById('techCheck').value || null,
    anything_else: document.getElementById('anythingElse').value.trim() || null,
  };

  const { error } = await ggClient.from('pre_survey_responses').insert(payload);

  if (error) {
    btn.disabled = false;
    btn.textContent = 'Submit Survey →';
    alert('Something went wrong submitting your response. Please try again or contact us at info@guardiangroup.com');
    console.error(error);
    return;
  }

  // Success
  document.getElementById('surveyContainer').style.display = 'none';
  document.getElementById('successScreen').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitDynamicForm(event) {
  event.preventDefault();
  if (!useDynamicSurvey) return;

  if (!validateDynamicSurvey()) return;

  const answers = collectDynamicAnswers();

  const payload = {
    workshop_id: workshopData.id,
    answers,
  };

  const { error } = await ggClient.from('custom_survey_responses').insert(payload);

  if (error) {
    alert('Something went wrong submitting your custom survey response. Please try again.');
    console.error(error);
    return;
  }

  document.getElementById('dynamicSurveyWrapper').style.display = 'none';
  document.getElementById('successScreen').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateDynamicSurvey() {
  let valid = true;
  dynamicQuestions.forEach(q => {
    if (!q.required) return;
    const val = getDynamicQuestionValue(q);
    if (val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
      valid = false;
      alert(`Please answer required question: ${q.text}`);
    }
  });
  return valid;
}

function getDynamicQuestionValue(q) {
  if (q.type === 'radio') {
    const checked = document.querySelector(`#dynamicSurveyForm input[name='${q.id}']:checked`);
    return checked ? checked.value : null;
  }
  if (q.type === 'checkbox') {
    const checked = Array.from(document.querySelectorAll(`#dynamicSurveyForm input[name='${q.id}']:checked`));
    return checked.map(el => el.value);
  }
  const el = document.getElementById(q.id);
  if (!el) return null;
  return el.value.trim();
}

function collectDynamicAnswers() {
  const answers = {};
  dynamicQuestions.forEach(q => {
    answers[q.id] = getDynamicQuestionValue(q);
  });
  return answers;
}

// ── START ─────────────────────────────────────────────────────
init();
