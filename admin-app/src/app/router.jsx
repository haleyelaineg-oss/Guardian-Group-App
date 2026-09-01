// Route config lives here (not inline JSX) so the Sidebar can be driven off
// the same list instead of hand-duplicating nav items and <Route>s.
import DashboardPage from '../features/dashboard/DashboardPage.jsx';
import CalendarPage from '../features/calendar/CalendarPage.jsx';
import EventsListPage from '../features/events/EventsListPage.jsx';
import EventDetailPage from '../features/events/EventDetailPage.jsx';
import TasksPage from '../features/tasks/TasksPage.jsx';
import ClientsListPage from '../features/clients/ClientsListPage.jsx';
import ClientDetailPage from '../features/clients/ClientDetailPage.jsx';
import AddressBookPage from '../features/addressBook/AddressBookPage.jsx';
import FinancialOverviewPage from '../features/financial/FinancialOverviewPage.jsx';
import IncomePage from '../features/financial/IncomePage.jsx';
import ExpensesPage from '../features/expenses/ExpensesPage.jsx';
import QuoteToolPage from '../features/financial/QuoteToolPage.jsx';
import SpeakingListPage from '../features/speaking/SpeakingListPage.jsx';
import SpeakingDetailPage from '../features/speaking/SpeakingDetailPage.jsx';
import SpeakingCreatePage from '../features/speaking/SpeakingCreatePage.jsx';
import TrainingListPage from '../features/trainings/TrainingListPage.jsx';
import TrainingDetailPage from '../features/trainings/TrainingDetailPage.jsx';

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
