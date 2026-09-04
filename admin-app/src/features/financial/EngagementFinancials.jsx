import { useCallback, useEffect, useState } from 'react';
import ExpenseManager, { FinancialSummary } from '../expenses/ExpenseManager.jsx';
import { fetchExpenses } from '../events/eventResourcesService.js';
import { useEventResource } from '../events/useEventResource.js';
import { pendingReimbursements } from './financialCalculations.js';
import { loadEngagementFinance } from './engagementFinanceService.js';
import EngagementBillingPanel from './EngagementBillingPanel.jsx';

export default function EngagementFinancials({
  sourceType,
  sourceId,
  eventId,
  companyId,
  title,
  expectedOn,
  initialValue = 0,
  initialCertainty,
  onValueSaved,
  billingMessage
}) {
  const expenseResource = useEventResource(eventId, fetchExpenses);
  const [expectedIncome, setExpectedIncome] = useState(Number(initialValue) || 0);

  const reloadIncome = useCallback(async () => {
    const finance = await loadEngagementFinance({ sourceType, sourceId });
    setExpectedIncome(Number(finance.income?.amount ?? initialValue) || 0);
  }, [initialValue, sourceId, sourceType]);

  useEffect(() => {
    reloadIncome().catch(() => setExpectedIncome(Number(initialValue) || 0));
  }, [reloadIncome, initialValue]);

  const handleValueSaved = async (amount, certainty) => {
    setExpectedIncome(amount);
    if (onValueSaved) await onValueSaved(amount, certainty);
  };

  return <div className="engagement-financials">
    <section>
      <div className="detail-section-title">Financial Summary</div>
      <FinancialSummary expectedIncome={expectedIncome} expenses={expenseResource.rows} pending={pendingReimbursements(expenseResource.rows)} />
    </section>
    {billingMessage || <EngagementBillingPanel sourceType={sourceType} sourceId={sourceId} eventId={eventId} companyId={companyId} title={title} expectedOn={expectedOn} initialValue={initialValue} initialCertainty={initialCertainty} onValueSaved={handleValueSaved} />}
    <ExpenseManager eventId={eventId} resource={expenseResource} showSummary={false} />
  </div>;
}
