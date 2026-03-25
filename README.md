# Guardian Group Survey App
### Pre-Workshop Survey System with Admin Dashboard

---

## What This Is

A fully branded web app for Guardian Group that handles:
- **Participant-facing survey** — multi-step, branded form per workshop
- **Admin dashboard** — login-protected, per-workshop response view with pie charts
- **Workshop management** — create workshops, generate unique shareable links

---

## File Structure

```
guardian-survey-app/
├── index.html              ← Participant survey form
├── admin/
│   └── index.html          ← Admin dashboard (login protected)
├── css/
│   ├── survey.css          ← Participant form styles
│   └── admin.css           ← Dashboard styles
├── js/
│   ├── config.js           ← Supabase credentials (already filled in)
│   ├── survey.js           ← Form logic
│   └── admin.js            ← Dashboard logic
├── assets/                 ← PUT YOUR LOGOS HERE (see below)
│   ├── logo-color.png      ← Color logo (for success screen)
│   ├── logo-white.png      ← White logo (for header/sidebar)
│   └── favicon.png         ← Favicon
└── SUPABASE_SETUP.sql      ← Run this in Supabase first
```

---

## STEP 1 — Set Up Supabase

1. Go to your Supabase project: https://wcuuinbgrunqajzxpcjs.supabase.co
2. Click **SQL Editor** in the left sidebar
3. Paste the entire contents of `SUPABASE_SETUP.sql` and click **Run**
4. Go to **Authentication → Users → Add User → Create new user**
5. Enter your email + a strong password — this is your admin login

---

## STEP 2 — Add Your Logos

Create an `assets/` folder in the project root and add:
- `logo-color.png` — your full color logo (Guardian Group Vector Logo)
- `logo-white.png` — white version of your logo (White Logo)
- `favicon.png` — small icon for browser tab

---

## STEP 3 — Change the Admin Password Hint

Open `js/config.js` and change `ADMIN_PASSWORD` to something strong.
(The actual auth is handled by Supabase — this is just a local hint for your records.)

---

## STEP 4 — Deploy to GitHub Pages

1. Create a new GitHub repo (e.g. `guardian-survey-app`)
2. Upload all files maintaining the folder structure
3. Go to repo **Settings → Pages → Source → Deploy from branch → main → / (root)**
4. GitHub will give you a URL like: `https://yourusername.github.io/guardian-survey-app`

---

## STEP 5 — Point Your Subdomain at It

In **Squarespace → Domains → DNS Settings**, add:

| Type  | Host    | Value                                    |
|-------|---------|------------------------------------------|
| CNAME | surveys | yourusername.github.io                   |

Then in your **GitHub repo → Settings → Pages → Custom domain**, enter:
`surveys.guardiangroup.com`

GitHub will handle the HTTPS certificate automatically (takes ~10 min).

---

## STEP 6 — Create Your First Workshop

1. Go to `surveys.guardiangroup.com/admin/` (or the GitHub Pages URL)
2. Log in with the email/password you created in Supabase
3. Click **Workshops → + New Workshop**
4. Fill in the title, date, facilitator, and slug
5. Copy the survey link and send it to registrants!

---

## How the Survey Links Work

Each workshop gets a unique URL like:
```
https://surveys.guardiangroup.com/?workshop=safety-leadership-q1
```

The `?workshop=` parameter matches the **slug** you set when creating a workshop.
The form automatically loads that workshop's title, subtitle, facilitator, and date.

---

## Adding Logos to Headers (After Deploy)

If logos don't show, the `onerror` fallback will display text instead — the app won't break.
Just make sure your logo files are in the `assets/` folder with the exact filenames above.

---

## Future Add-Ons You Can Build On This

Since the database already has tables for:
- `post_survey_responses` — build a post-workshop survey the same way
- `quiz_responses` — build a competency quiz with scoring
- `training_records` — build a training history/certificate log

The schema is ready. Just build the forms and point them at the same Supabase project.

---

## Questions?

This app was built for Guardian Group Safety & Leadership Solutions.
All data is stored in your own Supabase project — you own it entirely.
