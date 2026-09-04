export const SPEAKING_STATUSES = [
  'opportunity', 'preparing_submission', 'applied', 'application_pending_response',
  'submission_accepted', 'submission_rejected', 'planning', 'ready',
  'completed_payment_pending', 'completed_paid',
  'cancelled_submission_withdrawn', 'cancelled_event_cancelled',
];

export const SPEAKING_STATUS_LABELS = {
  opportunity: 'Opportunity', preparing_submission: 'Preparing Submission', applied: 'Applied',
  application_pending_response: 'Application Pending Response', submission_accepted: 'Submission Accepted', submission_rejected: 'Submission Rejected',
  planning: 'Planning', ready: 'Ready', completed_payment_pending: 'Completed: Payment Pending', completed_paid: 'Completed: Paid',
  cancelled_submission_withdrawn: 'Cancelled: Submission Withdrawn', cancelled_event_cancelled: 'Cancelled: Event Cancelled',
};

const LEGACY_STATUS_MAP = {
  under_review: 'application_pending_response', selected: 'submission_accepted', contracting: 'submission_accepted', declined: 'submission_rejected',
  completed: 'completed_payment_pending', payment_pending: 'completed_payment_pending', closed: 'completed_paid',
  withdrawn: 'cancelled_submission_withdrawn', cancelled: 'cancelled_event_cancelled',
};

export function normalizeSpeakingStatus(status) {
  return LEGACY_STATUS_MAP[status] || status;
}
