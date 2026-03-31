-- ============================================================
-- GUARDIAN GROUP SURVEY APP — SUPABASE SCHEMA
-- Paste this entire file into Supabase SQL Editor and run it
-- ============================================================

-- ── WORKSHOPS ────────────────────────────────────────────────
CREATE TABLE workshops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  title TEXT NOT NULL,
  subtitle TEXT,
  facilitator TEXT,
  workshop_date DATE,
  slug TEXT UNIQUE NOT NULL, -- used in the shareable URL
  is_active BOOLEAN DEFAULT true,
  accent_color TEXT DEFAULT '#2A5C76', -- per-workshop brand accent
  survey_config JSONB -- dynamic survey definition (array of question objects)
);

-- ── PRE-WORKSHOP SURVEY RESPONSES ────────────────────────────
CREATE TABLE pre_survey_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  workshop_id UUID REFERENCES workshops(id) ON DELETE CASUSDE,

  -- Section 1: About You
  full_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  organization TEXT NOT NULL,
  industry TEXT NOT NULL,
  time_in_role TEXT,
  time_in_industry TEXT,
  safety_involvement TEXT[], -- array for checkboxes

  -- Section 2: Starting Point
  safety_ii_familiarity TEXT,
  safety_culture TEXT,
  safety_leadership_description TEXT,

  -- Section 3: Hoping to Get
  attendance_reason TEXT,
  one_thing_wanted TEXT NOT NULL,
  specific_challenge TEXT,
  do_not_cover TEXT,

  -- Section 4: Team & Org
  team_size TEXT,
  org_size TEXT,
  org_change_context TEXT,

  -- Section 5: Logistics
  email TEXT NOT NULL,
  time_zone TEXT,
  accessibility_needs TEXT,
  tech_check TEXT,
  anything_else TEXT,
  dynamic_answers JSONB -- optional payload for custom survey builder questions
);

-- ── CUSTOM SURVEY RESPONSES (dynamic builder) ───────────────
CREATE TABLE custom_survey_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  workshop_id UUID REFERENCES workshops(id) ON DELETE CASUSDE,
  answers JSONB NOT NULL
);

-- Public can submit custom dynamic survey responses
ALTER TABLE custom_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert custom survey responses"
  ON custom_survey_responses FOR INSERT
  WITH CHECK (true);

-- ── POST-WORKSHOP SURVEY RESPONSES ───────────────────────────
CREATE TABLE post_survey_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  workshop_id UUID REFERENCES workshops(id) ON DELETE CASUSDE,

  -- Respondent
  full_name TEXT,
  email TEXT,

  -- Ratings
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  application_likelihood INTEGER CHECK (application_likelihood BETWEEN 1 AND 10),
  would_recommend TEXT, -- 'yes' / 'no' / 'maybe'

  -- Open-ended
  most_valuable TEXT,
  would_improve TEXT,
  topics_next TEXT,
  testimonial_permission BOOLEAN DEFAULT false,
  testimonial_text TEXT,

  -- Internal scoring
  facilitator_rating INTEGER CHECK (facilitator_rating BETWEEN 1 AND 5),
  content_relevance INTEGER CHECK (content_relevance BETWEEN 1 AND 5),
  pacing_rating INTEGER CHECK (pacing_rating BETWEEN 1 AND 5)
);

-- ── QUIZ / COMPETENCY CHECK RESPONSES ────────────────────────
CREATE TABLE quiz_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  workshop_id UUID REFERENCES workshops(id) ON DELETE CASUSDE,

  -- Respondent
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,

  -- Quiz metadata
  quiz_title TEXT NOT NULL,
  quiz_version TEXT DEFAULT '1.0',
  attempt_number INTEGER DEFAULT 1,

  -- Results
  score INTEGER,
  max_score INTEGER,
  passed BOOLEAN,
  pass_threshold INTEGER, -- percentage required to pass

  -- Answers stored as JSON array: [{question_id, question_text, answer, correct, points}]
  answers JSONB,

  -- Training record fields
  certificate_issued BOOLEAN DEFAULT false,
  certificate_number TEXT,
  expiry_date DATE -- for certifications that expire
);

-- ── TRAINING RECORDS (master log) ────────────────────────────
CREATE TABLE training_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Person
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,
  job_title TEXT,

  -- Training
  workshop_id UUID REFERENCES workshops(id),
  quiz_response_id UUID REFERENCES quiz_responses(id),
  training_type TEXT NOT NULL, -- 'workshop' / 'quiz' / 'competency_check'
  training_title TEXT NOT NULL,
  completion_date DATE NOT NULL,

  -- Outcome
  status TEXT DEFAULT 'completed', -- 'completed' / 'passed' / 'failed' / 'pending'
  score INTEGER,
  certificate_number TEXT,
  expiry_date DATE,
  notes TEXT
);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
-- Allow anyone to INSERT survey responses (public form)
ALTER TABLE pre_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;

-- Public can read active workshops (to load the form)
CREATE POLICY "Public can read active workshops"
  ON workshops FOR SELECT
  USING (is_active = true);

-- Public can submit pre-survey responses
CREATE POLICY "Public can insert pre-survey responses"
  ON pre_survey_responses FOR INSERT
  WITH CHECK (true);

-- Public can submit post-survey responses
CREATE POLICY "Public can insert post-survey responses"
  ON post_survey_responses FOR INSERT
  WITH CHECK (true);

-- Public can submit quiz responses
CREATE POLICY "Public can insert quiz responses"
  ON quiz_responses FOR INSERT
  WITH CHECK (true);

-- ── ADMIN ACCOUNT SETUP ──────────────────────────────────────
-- After running this SQL:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User" → "Create new user"
-- 3. Enter your email + a strong password
-- 4. That's your admin login for the dashboard

-- ── SEED: SAMPLE WORKSHOP ────────────────────────────────────
INSERT INTO workshops (title, subtitle, facilitator, workshop_date, slug)
VALUES (
  'Safety Leadership Foundations',
  'Moving Beyond Compliance to Culture',
  'Haley Vincent',
  CURRENT_DATE + INTERVAL '14 days',
  'safety-leadership-foundations'
);

-- ============================================================
-- DONE! Your tables are ready.
-- Note the workshop slug above — the survey link will be:
-- https://app.yourdomain.com/?workshop=safety-leadership-foundations
-- ============================================================
