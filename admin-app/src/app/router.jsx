// Route config lives here (not inline JSX) so the Sidebar can be driven off
// the same list instead of hand-duplicating nav items and <Route>s.
import { lazy } from 'react';

const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage.jsx'));
const CalendarPage = lazy(() => import('../features/calendar/CalendarPage.jsx'));
const EventsListPage = lazy(() => import('../features/events/EventsListPage.jsx'));
const EventDetailPage = lazy(() => import('../features/events/EventDetailPage.jsx'));
const TasksPage = lazy(() => import('../features/tasks/TasksPage.jsx'));
const ClientsListPage = lazy(() => import('../features/clients/ClientsListPage.jsx'));
const ClientDetailPage = lazy(() => import('../features/clients/ClientDetailPage.jsx'));
const AddressBookPage = lazy(() => import('../features/addressBook/AddressBookPage.jsx'));
const FinancialOverviewPage = lazy(() => import('../features/financial/FinancialOverviewPage.jsx'));
const IncomePage = lazy(() => import('../features/financial/IncomePage.jsx'));
const ExpensesPage = lazy(() => import('../features/expenses/ExpensesPage.jsx'));
const QuoteToolPage = lazy(() => import('../features/financial/QuoteToolPage.jsx'));
const SpeakingListPage = lazy(() => import('../features/speaking/SpeakingListPage.jsx'));
const SpeakingDetailPage = lazy(() => import('../features/speaking/SpeakingDetailPage.jsx'));
const SpeakingCreatePage = lazy(() => import('../features/speaking/SpeakingCreatePage.jsx'));
const TrainingListPage = lazy(() => import('../features/trainings/TrainingListPage.jsx'));
const TrainingDetailPage = lazy(() => import('../features/trainings/TrainingDetailPage.jsx'));

// Nav-visible sections, used to render the Sidebar.
export const navSections = [
  {
    icon: 'shield-check',
    label: 'Dashboard',
    path: '/admin',
  },
  {
    icon: 'calendar-days',
    label: 'Calendar',
    path: '/admin/calendar',
    children: [
      { label: 'Events', path: '/admin/events' },
      { label: 'Tasks', path: '/admin/tasks' },
    ],
  },
  {
    icon: 'receipt',
    label: 'Financial',
    path: '/admin/financial',
    children: [
      { label: 'Quotes / Invoices / Receipts', path: '/admin/quotes' },
      { label: 'Income', path: '/admin/income' },
      { label: 'Expenses', path: '/admin/expenses' },
    ],
  },
  {
    icon: 'users-round',
    label: 'Clients',
    path: '/admin/clients',
    children: [
      { label: 'Address Book', path: '/admin/address-book' },
    ],
  },
  {
    icon: 'presentation',
    label: 'Speaking Engagements',
    path: '/admin/speaking',
  },
  {
    icon: 'graduation-cap',
    label: 'Trainings',
    path: '/admin/trainings',
  },
];

// Every routable path, including detail routes that aren't nav items.
export const routes = [
  { path: '/admin', element: <DashboardPage /> },
  { path: '/admin/calendar', element: <CalendarPage /> },
  { path: '/admin/events', element: <EventsListPage /> },
  { path: '/admin/events/:id', element: <EventDetailPage /> },
  { path: '/admin/tasks', element: <TasksPage /> },
  { path: '/admin/clients', element: <ClientsListPage /> },
  { path: '/admin/clients/:id', element: <ClientDetailPage /> },
  { path: '/admin/address-book', element: <AddressBookPage /> },
  { path: '/admin/financial', element: <FinancialOverviewPage /> },
  { path: '/admin/income', element: <IncomePage /> },
  { path: '/admin/expenses', element: <ExpensesPage /> },
  { path: '/admin/quotes', element: <QuoteToolPage /> },
  { path: '/admin/speaking', element: <SpeakingListPage /> },
  { path: '/admin/speaking/new', element: <SpeakingCreatePage /> },
  { path: '/admin/speaking/:id', element: <SpeakingDetailPage /> },
  { path: '/admin/trainings', element: <TrainingListPage /> },
  { path: '/admin/trainings/:id', element: <TrainingDetailPage /> },
];
