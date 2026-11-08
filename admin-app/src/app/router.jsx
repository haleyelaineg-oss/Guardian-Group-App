// Route config lives here (not inline JSX) so the Sidebar can be driven off
// the same list instead of hand-duplicating nav items and <Route>s.
import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

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
const ReceiptInboxPage = lazy(() => import('../features/expenses/ReceiptInboxPage.jsx'));
const MobileReceiptCapturePage = lazy(() => import('../features/expenses/MobileReceiptCapturePage.jsx'));
const QuoteToolPage = lazy(() => import('../features/financial/QuoteToolPage.jsx'));
const SpeakingDetailPage = lazy(() => import('../features/speaking/SpeakingDetailPage.jsx'));
const SpeakingCreatePage = lazy(() => import('../features/speaking/SpeakingCreatePage.jsx'));
const TrainingDetailPage = lazy(() => import('../features/trainings/TrainingDetailPage.jsx'));
const SessionsPage = lazy(() => import('../features/sessions/SessionsPage.jsx'));
const SessionDetailPage = lazy(() => import('../features/sessions/SessionDetailPage.jsx'));
const ResourceLibraryPage = lazy(() => import('../features/resources/ResourceLibraryPage.jsx'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage.jsx'));

// Nav-visible sections, used to render the Sidebar.
export const navSections = [
  {
    icon: 'shield-check',
    label: 'Dashboard',
    path: '/admin',
  },
  {
    icon: 'calendar-days',
    label: 'Events',
    path: '/admin/events',
    children: [
      { label: 'Calendar', path: '/admin/calendar' },
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
      { label: 'Receipt Inbox', path: '/admin/receipts' },
    ],
  },
  {
    icon: 'users-round',
    label: 'Clients',
    path: '/admin/clients',
    children: [
      { label: 'Client List', path: '/admin/clients' },
      { label: 'Address Book', path: '/admin/address-book' },
    ],
  },
  {
    icon: 'library-big',
    label: 'Resource Library',
    path: '/admin/resources',
    children: [
      { label: 'Sessions & Presentations', path: '/admin/sessions' },
      { label: 'Printables', path: '/admin/resources/printables' },
      { label: 'Digital Tools', path: '/admin/resources/digital-tools' },
      { label: 'Training Materials', path: '/admin/resources/training-materials' },
    ],
  },
  {
    icon: 'settings',
    label: 'Settings',
    path: '/admin/settings',
  },
];

// Every routable path, including detail routes that aren't nav items.
export const routes = [
  { path: '/admin', element: <DashboardPage /> },
  { path: '/admin/calendar', element: <CalendarPage /> },
  { path: '/admin/events', element: <EventsListPage /> },
  { path: '/admin/events/new', element: <EventDetailPage /> },
  { path: '/admin/events/:id', element: <EventDetailPage /> },
  { path: '/admin/tasks', element: <TasksPage /> },
  { path: '/admin/clients', element: <ClientsListPage /> },
  { path: '/admin/clients/:id', element: <ClientDetailPage /> },
  { path: '/admin/address-book', element: <AddressBookPage /> },
  { path: '/admin/financial', element: <FinancialOverviewPage /> },
  { path: '/admin/income', element: <IncomePage /> },
  { path: '/admin/expenses', element: <ExpensesPage /> },
  { path: '/admin/receipts', element: <ReceiptInboxPage /> },
  { path: '/admin/receipts/capture', element: <MobileReceiptCapturePage /> },
  { path: '/admin/quotes', element: <QuoteToolPage /> },
  { path: '/admin/speaking', element: <Navigate to="/admin/events" replace /> },
  { path: '/admin/speaking/new', element: <SpeakingCreatePage /> },
  { path: '/admin/speaking/:id', element: <SpeakingDetailPage /> },
  { path: '/admin/sessions', element: <SessionsPage /> },
  { path: '/admin/sessions/:id', element: <SessionDetailPage /> },
  { path: '/admin/resources', element: <ResourceLibraryPage /> },
  { path: '/admin/resources/:category', element: <ResourceLibraryPage /> },
  { path: '/admin/trainings', element: <Navigate to="/admin/events" replace /> },
  { path: '/admin/trainings/:id', element: <TrainingDetailPage /> },
  { path: '/admin/settings', element: <SettingsPage /> },
];
