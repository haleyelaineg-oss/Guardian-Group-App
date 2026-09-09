import { useEffect, useRef, useState } from 'react';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import Modal from '../../components/Modal.jsx';
import SaveButton from '../../components/SaveButton.jsx';
import { formatFileSize } from '../../utils/format.js';
import { ExpenseForm } from './ExpenseManager.jsx';
import { createGeneralReceiptExpense, createReceiptExpense, deleteInboxReceipt, fetchExpenseChoices, fetchReceiptEvents, fetchReceiptInbox, getInboxReceiptUrl, processGeneralInboxReceipt, processInboxReceipt, uploadInboxReceipt } from './receiptInboxService.js';

const GENERAL_EXPENSE = '__general_expense__';
const NEW_EXPENSE = '__new_expense__';
const blankExpense = () => ({ category: 'other_business_expense', expense_type: 'other', description: '', amount: '', status: 'paid', reimbursement_status: 'not_applicable', reimbursement_amount: '', reimbursable: false });

export default function ReceiptInboxPage() {
  const inputRef = useRef(null);
  const [receipts, setReceipts] = useState([]);
  const [events, setEvents] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [selection, setSelections] = useState({});
  const [receiptToCreate, setReceiptToCreate] = useState(null);
  const [newExpense, setNewExpense] = useState(blankExpense);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reload = async () => { setLoading(true); try { const [inbox, choices, eventChoices] = await Promise.all([fetchReceiptInbox(), fetchExpenseChoices(), fetchReceiptEvents()]); setReceipts(inbox); setExpenses(choices); setEvents(eventChoices); setError(null); } catch (err) { setError(err); } finally { setLoading(false); } };
  useEffect(() => { reload(); }, []);
  useEffect(() => {
    setSelections((current) => Object.fromEntries(receipts.map((receipt) => [receipt.id, { eventId: receipt.related_event_id || '', ...current[receipt.id] }])));
  }, [receipts]);
  const setSelection = (receiptId, key, value) => setSelections((current) => ({ ...current, [receiptId]: { ...current[receiptId], [key]: value, ...(key === 'eventId' ? { expenseId: '' } : {}) } }));
  const upload = async () => { const file = inputRef.current?.files?.[0]; if (!file) throw new Error('Choose a receipt image or PDF first.'); await uploadInboxReceipt(file); };
  const uploaded = async () => { inputRef.current.value = ''; await reload(); };
  const view = async (receipt) => { window.open(await getInboxReceiptUrl(receipt.storage_path), '_blank', 'noopener'); };
  const openNewExpense = (receipt) => { setReceiptToCreate(receipt); setNewExpense({ ...blankExpense(), description: receipt.suggested_description || '', amount: receipt.suggested_amount == null ? '' : String(receipt.suggested_amount), category: receipt.suggested_category || 'other_business_expense', expense_type: receipt.suggested_expense_type || 'other', status: receipt.suggested_status || 'paid', reimbursement_status: receipt.suggested_reimbursement_status || 'not_applicable' }); };
  const saveNewExpense = async () => {
    const selected = selection[receiptToCreate.id] || {};
    if (!newExpense.description.trim() || newExpense.amount === '') throw new Error('Description and amount are required.');
    const amount = Number(newExpense.amount);
    const reimbursed = newExpense.reimbursement_status === 'not_applicable' ? 0 : Number(newExpense.reimbursement_amount || 0);
    if (reimbursed < 0 || reimbursed > amount) throw new Error('The reimbursed amount must be between $0 and the expense amount.');
    const reimbursement_status = newExpense.reimbursement_status === 'not_applicable' ? 'not_applicable' : reimbursed >= amount && amount > 0 ? 'reimbursed' : reimbursed > 0 ? 'partial' : 'submitted';
    const payload = { ...newExpense, amount, description: newExpense.description.trim(), reimbursable: reimbursement_status !== 'not_applicable', reimbursement_status, reimbursement_amount: reimbursed };
    if (selected.eventId === GENERAL_EXPENSE) {
      const { reimbursable, reimbursement_status: ignoredStatus, reimbursement_amount: ignoredAmount, ...generalPayload } = payload;
      const expense = await createGeneralReceiptExpense(generalPayload);
      await processGeneralInboxReceipt(receiptToCreate, expense);
    } else {
      const expense = await createReceiptExpense(selected.eventId, payload);
      await processInboxReceipt(receiptToCreate, expense);
    }
  };
  const savedNewExpense = async () => { setReceiptToCreate(null); await reload(); };
  const process = async (receipt) => {
    const selected = selection[receipt.id] || {};
    if (!selected.eventId) throw new Error('Choose the related event first.');
    if (selected.expenseId === NEW_EXPENSE) return openNewExpense(receipt);
    const expense = expenses.find((item) => item.id === selected.expenseId);
    if (!expense) throw new Error('Choose an expense, or select Create New Expense.');
    await processInboxReceipt(receipt, expense);
    await reload();
  };
  const remove = async (receipt) => { if (!confirm(`Delete ${receipt.file_name}? This cannot be undone.`)) return; try { await deleteInboxReceipt(receipt); await reload(); } catch (err) { alert(err.message); } };
  return <div className="view active">{receiptToCreate && <Modal title={selection[receiptToCreate.id]?.eventId === GENERAL_EXPENSE ? 'Add General Expense' : 'Add Expense'} onClose={() => setReceiptToCreate(null)}><ExpenseForm values={newExpense} setValues={setNewExpense} /><div className="create-form-actions"><button className="btn btn-ghost" onClick={() => setReceiptToCreate(null)}>Cancel</button><SaveButton onSave={saveNewExpense} onSaved={savedNewExpense} label="Add Expense" /></div></Modal>}<div className="view-header"><h1 className="view-title">Receipt Inbox</h1><button className="btn btn-primary" onClick={() => inputRef.current?.click()}>+ Add Receipt</button></div><p className="view-sub">Capture receipts now, then attach each one to an expense when you are ready to process it.</p><div className="create-form-card receipt-inbox-upload"><label className="field-group full"><span className="field-label">Receipt photo or file</span><input ref={inputRef} className="field-input" type="file" accept="image/*,.pdf" capture="environment" /></label><div className="create-form-actions"><SaveButton onSave={upload} onSaved={uploaded} label="Add to Receipt Inbox" /></div></div>{loading ? <LoadingIndicator label="Loading receipt inbox…" /> : error ? <section className="empty-hint" role="alert">Couldn’t load the receipt inbox. <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section> : receipts.length === 0 ? <p className="empty-hint">No unprocessed receipts. Add one when you capture a purchase.</p> : <div className="responses-table-wrap"><table className="responses-table"><thead><tr><th>Receipt</th><th>Captured</th><th>Related Event</th><th>Choose an Expense</th><th></th></tr></thead><tbody>{receipts.map((receipt) => { const selected = selection[receipt.id] || {}; const isGeneral = selected.eventId === GENERAL_EXPENSE; const matchingExpenses = expenses.filter((expense) => expense.event_id === selected.eventId); return <tr key={receipt.id}><td><button className="btn-sm btn-sm-ghost" onClick={() => view(receipt)}>{receipt.file_name}</button><br /><span className="field-hint">{formatFileSize(receipt.file_size)}</span></td><td>{new Date(receipt.created_at).toLocaleDateString()}</td><td><select className="field-input" value={selected.eventId || ''} onChange={(event) => setSelection(receipt.id, 'eventId', event.target.value)}><option value="">— Choose related event —</option><option value={GENERAL_EXPENSE}>None — General Expense</option>{events.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}</select></td><td>{selected.eventId && <select className="field-input" value={selected.expenseId || ''} onChange={(event) => setSelection(receipt.id, 'expenseId', event.target.value)}><option value="">— Choose an expense —</option>{!isGeneral && matchingExpenses.map((expense) => <option key={expense.id} value={expense.id}>{expense.description} · ${Number(expense.amount).toFixed(2)}</option>)}<option value={NEW_EXPENSE}>+ Create New Expense</option></select>}</td><td><button className="btn-sm btn-sm-ghost" onClick={() => process(receipt).catch((err) => alert(err.message))}>{selected.expenseId === NEW_EXPENSE ? 'Classify' : 'Process'}</button><button className="btn-sm btn-sm-danger" onClick={() => remove(receipt)}>🗑️</button></td></tr>; })}</tbody></table></div>}</div>;
}
