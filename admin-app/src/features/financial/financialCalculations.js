// Shared event-level financial math. Dashboard/Financial Overview can use
// the same helpers later instead of re-deriving totals in each view.
const number = (value) => Number(value) || 0;
export const totalExpenses = (expenses = []) => expenses.reduce((sum, expense) => sum + number(expense.amount), 0);
export const pendingReimbursements = (expenses = []) => expenses.filter((expense) => expense.reimbursable && expense.reimbursement_status === 'submitted').reduce((sum, expense) => sum + number(expense.amount), 0);
export const eventFinancialSummary = (incomeAmount, expenses = []) => {
  const income = number(incomeAmount); const spent = totalExpenses(expenses);
  return { income, expenses: spent, net: income - spent, pendingReimbursement: pendingReimbursements(expenses) };
};
