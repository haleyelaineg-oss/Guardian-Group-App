# React Migration Map

Internal reference for the vanilla-JS → React+Vite migration of the Guardian
Group Admin Portal. Built from a full read of `admin/index.html` (2561 lines)
and `js/admin.js`, `js/admin-calendar.js`, `js/admin-engagements.js`,
`js/admin-speaking.js`, `js/admin-training.js` (~7,000 lines combined) on
2026-08-23, prior to any React code being written. All work happens on the
`react-migration` branch; `main` is untouched.

Legend: 🟢 low risk / mechanical · 🟡 needs real design judgment · 🔴 shared
engine — must not be duplicated per feature.

---

## 0. Cross-cutting notes

- **No Vite/React/build step exists today.** `package.json` only has
  `live-server` (dev preview) + `resend`/`square`/`@supabase/supabase-js`
  (used by Netlify functions). Supabase JS is loaded via CDN `<script>` in
  `admin/index.html`, not imported from the npm package. `netlify.toml` has
  no `[build]` block — Netlify currently publishes the repo root as static
  files with zero build step.
- **Decision for Phase 1:** the new React app lives in `admin-app/` (source)
  as its own Vite project (`vite.config.js` at repo root with `root:
  'admin-app'`), run locally via `npm run admin:dev`. **`netlify.toml` is
  intentionally left untouched for now** — wiring a production build/publish
  step is a deploy-pipeline change that affects the whole live site (not
  just admin), so it's deferred until the React app is far enough along to
  actually cut over. Until then the legacy static site (including
  `admin/index.html`) keeps deploying exactly as it does today.
- **Auth model:** plain Supabase `auth.signInWithPassword` + `getSession()`.
  No separate staff/role table gates the admin UI client-side — access
  control is presumably enforced via RLS policies tied to the authenticated
  user. Nothing here should be tightened or loosened during migration.
- **Archived features, out of scope:** the "Trainings & Workshops" (Workshops,
  Registrants) and "Surveys" (Overview, Survey Builder, Responses) nav groups
  are already hidden (`style="display:none"`, commented "ARCHIVED
  2026-08-21") in the current app. Their code/data is untouched but they are
  **not** part of the target route list and won't be rebuilt in React unless
  asked.
- **Quotes/Invoices/Receipts** is a separate app (`quote-tool/`) currently
  embedded via `<iframe>` (`quoteToolFrame`) inside the admin shell. Phase 5
  keeps it as an iframe embed initially (no rewrite of that tool) — same
  integration shape, just hosted from the React shell instead of the vanilla
  one.
- **One event spine:** `events` is the hub table. `speaking_engagements` and
  `training_engagements` each optionally link to one `events` row via
  `event_id` (created once status crosses into "real", never duplicated).
  `event_expenses`, `event_documents`, `event_itinerary_items`,
  `event_care_arrangements` all key off `event_id` — this is exactly the
  shared spine the shared components (`ExpenseManager`, `DocumentManager`,
  `ItineraryManager`) must be built against, per the migration brief.
- Engagement → event sync is **one-way** (engagement is source of truth,
  pushes onto the event on every save; editing the event directly never
  flows back). This asymmetry must be preserved, not "fixed."

---

## 1. Login / Auth 🟢

- **HTML:** `#loginScreen`, `#loginForm` (email/password), `#loginError`.
- **JS:** `admin.js` — `loginForm` submit listener → `ggClient.auth.signInWithPassword`;
  `checkSession()` (called once on load); `showDashboard()`; `signOut()`.
- **Global state:** none beyond the Supabase client's own session.
- **Supabase:** `auth` only.
- **Target:** `features/auth/` — `LoginPage.jsx`, `AuthContext`/`useAuth()`
  hook wrapping `onAuthStateChange` + `getSession()`. `App.jsx` renders
  `<LoginPage/>` or the shell based on session state instead of toggling
  `display:none` on two top-level divs.

## 2. App Shell / Sidebar 🟢

- **HTML:** `.dashboard` wrapper, `<aside class="sidebar">` nav (Dashboard,
  Calendar▸{Events,Tasks}, Financial▸{Quotes,Invoices,Receipts,Income,Expenses},
  Clients▸{Address Book}, Speaking Engagements, Trainings, archived groups,
  Resource Library external link), `.dash-main`, `#workshopTopBar`.
- **JS:** `setView(viewName, btn)` — the one big dispatcher: toggles
  `.view.active`/`.nav-item.active` classes and fires each view's loader
  function. `toggleNavGroup()` expands/collapses a nav group.
- **Global state:** none (DOM classes are the state).
- **Target:** `app/App.jsx` + `app/router.jsx` (React Router — routes listed
  in the brief), `components/Sidebar.jsx` (nav tree driven by a route config
  array, `NavLink` active state replaces manual class toggling), Lucide via
  `lucide-react` components instead of `lucide.createIcons()` + two redundant
  CDN `<script>` tags. `setView`'s per-view "on enter, load data" behavior
  becomes each route's own data-loading effect — no central dispatcher needed.

## 3. Dashboard 🟡

- **HTML:** `#view-dashboard` — stat cards (`#dashboardStats`), Upcoming
  Events / Tasks split row.
- **JS:** `loadDashboardView()` (parallel fetch: `documents` invoices,
  upcoming `events`, revenue-bearing `events`, `event_itinerary_items`,
  `income`) → `renderRevenueStats()` (🔴 shared with Financial Overview —
  the Booked/Earned/AR/Collected waterfall) → `renderDashboardEvents()`;
  `loadTaskList()` → `renderDashboardTaskList()` (🔴 shared task list
  rendering, reused by the Tasks view).
- **Target:** `features/dashboard/DashboardPage.jsx`, composed from a shared
  `useRevenueStats()` hook (see §14) and the shared task list component (§8).

## 4. Calendar 🟡 (migrate late — Phase 9)

- **HTML:** `#view-calendar` — month-grid toolbar (prev/next/today,
  month/year jump selects, status filter, show-tasks toggle, quick-create
  buttons for Task/Speaking/Training/Event), `#calendarGrid`, `#createEventCard`.
- **JS (`admin-calendar.js`):** `loadCalendarMonth()`/`renderCalendarGrid()`
  (fetches `events` + `tasks` for a padded 6-week grid), `renderEventChip`/
  `renderTaskChip`, month/year nav (`calendarPrevMonth/NextMonth/GoToday/
  JumpToMonthYear`), `toggleCalendarTasks`, `autoCompletePastConfirmedEvents()`
  (RPC, runs once per Calendar-view visit — flips past `confirmed` events to
  `completed`). Click-routing goes through `openEventOrEngagement()`
  (`admin-engagements.js`) which resolves a clicked event to its linked
  Speaking/Training record (or offers to adopt a legacy event into one) —
  **must stay a single shared router**, not reimplemented per calendar cell.
- **Global state:** `calendarViewDate`, `calendarEventsCache`,
  `calendarTasksCache`, `calendarShowTasks`.
- **Supabase:** `events`, `tasks`; RPC `auto_complete_confirmed_events`.
- **Depends on:** Events, Tasks, Speaking, Training all being stable first
  (per the brief's ordering — this view is pure orchestration over them).
- **Target:** `features/calendar/CalendarPage.jsx` + `MonthGrid.jsx` +
  `useOpenEventOrEngagement()` hook (shared click-router, used by Calendar,
  Dashboard's upcoming-events list, and Income's event-sourced rows).

## 5. Events (general) 🔴 core composition target

- **HTML:** `#view-events` list, `#eventDetailModal` — 4 tabs: Details,
  Itinerary, Spending, Documents.
- **JS (`admin-calendar.js`):** `loadEventsListTable()`; event detail:
  `showEventDetail`/`loadEventDetail` (parallel-fetches event + expenses +
  itinerary + documents), `saveEventDetails`, `deleteEvent`;
  **Itinerary tab**: `renderEventItineraryTab`, add/edit/delete itinerary
  item, type-dependent field visibility (`LOGISTICS_TYPES`/`SESSION_TYPES`),
  address-builder sub-form, Client/Invoice quick-create-inline selects;
  **Spending tab**: `renderEventSpendingTab` (expenses + "booked" itinerary
  items with cost, budget/remaining math), expense CRUD, receipt upload;
  **Documents tab**: `renderEventDocumentsTab`, upload/view/delete against
  the `event-documents` storage bucket, optional link to an itinerary item
  or expense.
- **Supabase:** `events`, `event_expenses`, `event_itinerary_items`,
  `event_documents`, `companies` (client select), `documents` (invoice
  linking). Storage: `event-documents`.
- **This is where the brief's target model applies directly:**
  `<EventDetail><EventOverview/><ItineraryManager eventId/><ExpenseManager
  eventId/><DocumentManager eventId/></EventDetail>` — Speaking and Training
  reuse the same three managers instead of their current independent
  Financials/Documents/Travel tab implementations (see §10, §11).
- **Target:** `features/events/EventsListPage.jsx`,
  `features/events/EventDetailPage.jsx` (page, not modal, per the brief's
  "large multi-tab records → pages" guidance — this is the biggest of the
  three), composing `ItineraryManager`, `ExpenseManager`, `DocumentManager`
  from `features/itinerary|expenses|documents/`.

## 6. Tasks 🟢 (Phase 2 pilot feature)

- **HTML:** `#view-tasks`, create/edit card (`#createTaskCard`), task-row list.
- **JS (`admin-calendar.js`):** `loadTaskList()`/`renderTaskList()`
  (🔴 `buildTaskRowsHtml` shared with Dashboard's `buildDashboardTaskRowsHtml`
  — same data, two layouts), `showCreateTask`/`editTask`/`populateEditTaskForm`,
  `saveTask` (insert vs update branches on `editingTaskId`), `toggleTaskStatus`,
  `deleteTask`. Also entered from Calendar (`showCreateTaskFromCalendar`) and
  from checklist items (`syncChecklistItemToTask`, §9) which stamps
  `event_id` onto the created task.
- **Global state:** `allTasksCache`, `editingTaskId`, `cachedEventsForTasks`
  (for the Linked Event select).
- **Supabase:** `tasks` (`id, title, due_date, status, owner, event_id,
  link_url, notes`).
- **Target:** `features/tasks/` — `TaskListPage.jsx`, `TaskForm.jsx`
  (create+edit unified, like the vanilla version already does),
  `useTasks()` hook, `TaskRow.jsx` shared by the full list and a `compact`
  variant for the Dashboard. **Recommended as the literal first feature
  ported** — it's self-contained, exercises full CRUD, and its "shared row
  component with a compact mode" need is a good first taste of the
  reuse discipline the rest of the migration leans on.

## 7. Clients / Address Book 🟡 (Phase 3)

- **HTML:** `#view-clients` (compact list + create card), `#view-client-detail`
  (Overview / Client Code + membership / Company Roster / Training Records /
  Invoices / Documents sections on one page), `#view-address-book`
  (cross-client contact list + filters), view/edit contact modals,
  add-roster-contact modal.
- **JS (`admin.js`):** `loadCompanies`, `showCreateCompany`/`createCompany`
  (multi-contact-row create form, phone-row sub-editor), `deleteClient`,
  `showClientDetail`/`loadClientDetail` (5-way parallel fetch: company,
  membership, roster, attendance, invoices, client docs),
  `saveClientOverview`, membership field editors (`updateMembershipField`,
  `enableMembership`, `setUnlimitedSeats`, `generateClientCode`/
  `regenerateClientCode`), roster contact create (`createRosterContact`),
  client document upload/view/delete (`client-documents` bucket);
  Address Book: `loadAddressBook` (filters: company/status/search),
  `createAddressBookContact`, `showViewContact`/`showEditContact`/
  `saveContactEdits`/`deleteContact` (delete is blocked client-side if the
  contact has portal access or is an org admin).
  🔴 **`contactPhonesState` keyed phone-row editor** (`renderPhoneRowsFor`,
  `addContactPhoneRow`, `removeContactPhoneRow`) is reused across the New
  Client form, client-detail Primary Contact editor, and Address Book
  add/edit contact — one editor keyed by an arbitrary string id. Must become
  one `<PhoneNumbersField/>` component, not three copies.
  🔴 **Contact picker modal** (`admin-engagements.js` —
  `openContactPicker`/`pickContactFromPicker`) reused by Speaking/Training
  forms to fill Name/Email/Phone from an existing `participants` row —
  belongs with this feature's shared pieces even though it's currently
  defined alongside the engagement code.
- **Supabase:** `companies`, `company_membership`, `participants`,
  `attendance` (for a client's training-record history), `documents`
  (invoices), `client_documents`. Storage: `client-documents`.
- **Target:** `features/clients/` (`ClientsListPage`, `ClientDetailPage`,
  `ClientForm`) and `features/addressBook/` (`AddressBookPage`,
  `ContactModal` for view/edit, `ContactPicker.jsx` promoted to a real
  shared component), `components/PhoneNumbersField.jsx`.

## 8. Financial Overview / Income / Expenses (general) 🔴 (Phase 5)

- **HTML:** `#view-financial-overview` (revenue stat cards, A/R aging,
  expense MTD/YTD, all-documents table w/ filters), `#view-income`
  (rollup table: open invoices + event/itinerary income + manual `income`
  rows), `#view-expenses` (general business expenses, distinct from
  per-event `event_expenses`).
- **JS (`admin.js`):** `renderRevenueStats()` (🔴 the Booked/Earned/AR/
  Collected waterfall — shared verbatim by Dashboard and Financial
  Overview), `renderARSummary()`, `loadFinancialOverview`,
  `loadFinancialExpenseStats`, `renderFinancialDocsTable` + filter state
  (`financialDocsFilter`); Income: `loadIncomeView` (normalizes 4 sources —
  invoices, events, itinerary items, manual — into one `allIncomeRollupItems`
  array), `createIncome`/`toggleIncomeStatus`/`deleteIncome`; general
  Expenses: `loadExpenses`/`createExpense`/`deleteGeneralExpense` (the
  `expenses` table — **not** `event_expenses`, a genuinely separate concept:
  business overhead vs. per-event spend).
- **Supabase:** `documents` (quote/invoice/receipt tool's table — read-only
  from here), `events`, `event_itinerary_items`, `income`, `expenses`.
- **Target:** `features/financial/` — `FinancialOverviewPage.jsx`,
  `IncomePage.jsx`, `ExpensesPage.jsx` (general), all built on a shared
  `useRevenueStats()` / `financialCalculations.js` util (booked/earned/AR/
  collected/net — "Do not duplicate financial calculations across pages,"
  per the brief). Quotes/Invoices/Receipts stays an iframe embed
  (`QuoteToolFrame.jsx`) pointing at the existing `quote-tool/` app.

## 9. Shared engagement engine (checklist, care, travel wizard, pills, toast) 🔴

Lives in `admin-engagements.js`, parameterized by `kind: 'speaking'|'training'`
— this is already written as a shared engine in the vanilla app and the React
version must keep it that way (not re-fork it per feature):

- **Checklist ("Prep tab"):** `engagement_checklist_items` table, one row
  per item, parent FK is `speaking_engagement_id` XOR `training_engagement_id`.
  `generateDefaultChecklist()` seeds from a hardcoded title list (different
  for Speaking vs. Training-in-person vs. Training-virtual), idempotent
  (re-checks for existing rows before inserting). Progress % excludes
  `not_applicable` items from the denominator. `syncChecklistItemToTask()`
  is an explicit, one-click, non-automatic bridge to `tasks`.
- **Care arrangements** (childcare/pet care): `event_care_arrangements`,
  keyed to `event_id` (only exists once a real event does).
  `logCareArrangementAsExpense()` is an explicit one-click bridge to
  `event_expenses` — never automatic, to avoid silent double-counting.
- **Guided travel wizard + travel-item quick-edit table:** built entirely on
  `event_itinerary_items` (`item_type` ∈ driving_to/driving_home/
  departing_flight/return_flight/hotel/car_rental) — no separate schema.
  3-step wizard (travel needed? → method → generates stub rows with guessed
  dates); quick-edit table below it edits the same rows inline. "Open full
  Itinerary editor" hands off to the Events feature's Itinerary tab (§5).
- **Pill selectors:** Speaker pills = single-select, click-to-clear
  (`SPEAKER_PILL_OPTIONS`, 4 fixed values incl. "Both - Presenting
  Separately/Together"). Instructor pills = true multi-select (Haley/Dave
  independently toggleable). Both round-trip through the same
  `peopleArrayToText`/`textToPeopleArray` jsonb-array ↔ comma-string helpers.
- **Save toast** (`showSavedToast`) — one lazily-created DOM element, restarts
  its fade animation on repeat calls.
- **Status badges:** `renderStatusBadge` + `STATUS_BADGE_TONES` (shared
  color-by-status-key map spanning Speaking/Training/Events statuses).
- **Target:** `hooks/useChecklist.js`, `features/itinerary/TravelPlanner.jsx`
  (the wizard + quick-edit table), `features/care/CareArrangements.jsx`,
  `components/SingleSelectPills.jsx` + `components/MultiSelectPills.jsx`
  (generic, configured with the Speaker/Instructor option lists rather than
  two hand-rolled implementations), `components/StatusBadge.jsx`, a toast
  from a small shared UI primitive (or a lightweight lib) instead of manual
  DOM creation.

## 10. Speaking Engagements 🟡 (Phase 6)

- **HTML:** `#view-speaking` list + create modal, `#speakingDetailModal` —
  9 tabs: Overview, Submission, Sessions, Prep, Travel, Home Logistics,
  Financials, Documents, Post-Event.
- **JS (`admin-speaking.js`):** lifecycle Opportunity→CFP→Application→
  Selection→Planning→…→Post-Event via `status`; `EVENT_IMPLIED_SPEAKING_
  STATUSES` decides when a linked `events` row should exist.
  `saveSpeakingEngagement` vs. `saveSpeakingEngagementAndLink` (the latter
  creates-or-reuses the linked event, generates the default checklist).
  `pushSpeakingToEvent()` — one-way sync, engagement wins.
  **Sessions tab** is Speaking-only (Training has no equivalent): structured
  talk records stored as `event_itinerary_items` rows with
  `item_type='speaking_session'`, reusing columns migration-c added
  (speakers/session_type/description/learning_objectives/av_requirements)
  rather than a new table.
  **Submission tab**: additive-only historical record of what was actually
  submitted to a CFP (`speaking_submissions` table) — deliberately preserved
  even if the live session details evolve later.
  Financials/Documents tabs here are **currently their own full
  implementation** (`loadFinancialsPanel`/`renderFinancialsPanel`,
  `loadDocumentsPanel`/`renderDocumentsPanel` in `admin-engagements.js`,
  parameterized by `kind` already) — in React these become direct instances
  of the shared `ExpenseManager`/`DocumentManager` from §5, not a third
  parameterized-by-kind implementation.
- **Supabase:** `speaking_engagements`, `speaking_submissions`,
  `event_itinerary_items` (sessions + travel), `engagement_checklist_items`,
  `event_care_arrangements`, `event_expenses`, `event_documents`, `events`.
- **Target:** `features/speaking/` — `SpeakingListPage.jsx`,
  `SpeakingDetailPage.jsx` (page, not modal — multi-tab record per the
  brief), `SpeakingOverview.jsx`, `SpeakingSubmissions.jsx`,
  `SpeakingSessions.jsx` (the one genuinely Speaking-only piece),
  `SpeakingPrep.jsx` (thin wrapper around `useChecklist`),
  `SpeakingTravel.jsx` (wraps `TravelPlanner`), `SpeakingHomeLogistics.jsx`
  (wraps `CareArrangements`), `SpeakingFinancials.jsx` (wraps
  `ExpenseManager`), `SpeakingDocuments.jsx` (wraps `DocumentManager`),
  `SpeakingPostEvent.jsx`.

## 11. Training Engagements 🟡 (Phase 7)

- **HTML:** `#view-training` list + create modal, `#trainingDetailModal` —
  7 tabs: Overview, Delivery, Prep, Travel, Financials, Documents, Completion.
- **JS (`admin-training.js`):** lifecycle Inquiry→Proposal→Contract→
  Scheduled→…→Paid; unlike Speaking, always belongs to a client
  (`company_id`) from creation. In-Person/Virtual toggle
  (`updateTrainingDeliveryFields`) only *hides* the irrelevant field group —
  never clears hidden values, so toggling back and forth is lossless (a
  deliberate behavior to preserve exactly). Virtual trainings hide the
  Travel tab entirely (`updateTrainingTravelTabVisibility`), not just show
  it empty. Same save/save-and-link/push-to-event pattern as Speaking.
  Financials/Documents tabs: same situation as Speaking — currently the
  shared-by-`kind` engine, becomes direct `ExpenseManager`/`DocumentManager`
  usage in React.
- **Supabase:** `training_engagements`, `event_itinerary_items`,
  `engagement_checklist_items`, `event_care_arrangements`, `event_expenses`,
  `event_documents`, `events`, `participants` (contact-at-company select).
- **Target:** `features/trainings/` — `TrainingListPage.jsx`,
  `TrainingDetailPage.jsx`, `TrainingOverview.jsx`, `TrainingLogistics.jsx`
  (the Delivery tab — In-Person/Virtual field-group toggle preserved exactly,
  including the "never clear hidden values" rule), `TrainingPrep.jsx`,
  `TrainingTravel.jsx` (wraps `TravelPlanner`, hidden entirely when virtual),
  `TrainingFinancials.jsx`/`TrainingDocuments.jsx` (wrap the shared
  managers), `TrainingCompletion.jsx`. Instructor multi-select via the
  shared `MultiSelectPills`.

## 12. Historical event adoption + calendar click routing 🔴

- **JS (`admin-engagements.js`):** `openEventOrEngagement()` — every event
  chip/row calls this instead of `showEventDetail` directly; resolves a
  clicked event to its linked Speaking/Training record via a per-click
  lookup (never cached, so it can't go stale between calendar loads and
  clicks), or falls back to `adoptEventAsEngagement()` for a legacy
  speaking/training-typed event that predates this linkage — confirms with
  the user, backfills a new engagement row from the event's own fields
  (lossy status mapping, reviewable immediately on the opened Overview tab),
  or falls back further to the plain generic Event modal if declined.
- **Target:** `hooks/useOpenEventOrEngagement.js`, used by Calendar,
  Dashboard's upcoming-events list, and Income's event-sourced rows — one
  implementation, not reimplemented at each call site.

## 13. Care Arrangements — see §9 (folded into the shared engagement engine).

## 14. Financial calculations — see §8 (`renderRevenueStats`/`renderARSummary`
must become one `financialCalculations.js`, not re-derived per page).

---

## Target route list (confirmed against the brief; archived views excluded)

```
/admin
/admin/calendar
/admin/events
/admin/events/:id        (page, not modal)
/admin/tasks
/admin/clients
/admin/clients/:id
/admin/address-book
/admin/financial
/admin/income
/admin/expenses
/admin/quotes             (iframe embed, unchanged tool)
/admin/speaking
/admin/speaking/:id       (page, not modal)
/admin/trainings
/admin/trainings/:id      (page, not modal)
```

Small interactions stay modals per the brief: Add/Edit Task (already a
slide-down card, not a modal, in the vanilla app — keep that), Add
Expense/Document/Care Arrangement/Checklist Item, Create Client (or promote
to a page if the multi-contact-row form feels cramped — judgment call at
Phase 3), Contact Picker, Confirm/Delete.

## Migration order (adopted as-is from the brief; matches actual dependency
structure found in the audit — Calendar and Dashboard both fan out into
Events/Tasks/Speaking/Training/Financial, so they correctly come late/appear
twice — Dashboard's revenue stats can't be finished until Financial's shared
calc util exists, so Dashboard's stat cards may temporarily read "—" for that
piece until Phase 5, or Phase 5 gets pulled slightly earlier — a call to make
when Phase 1's shell is up and Phase 10 approaches):**

1. Foundation (this phase)
2. Tasks (pilot CRUD)
3. Clients / Address Book
4. Shared operational components (ExpenseManager, DocumentManager,
   ItineraryManager/TravelPlanner, pill selectors, financial calc util)
5. Financial Overview / Income / Expenses
6. Speaking Engagements
7. Trainings
8. General Events
9. Calendar
10. Dashboard
11. Verification / legacy cleanup
