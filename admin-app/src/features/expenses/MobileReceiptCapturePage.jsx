import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/Modal.jsx';
import SaveButton from '../../components/SaveButton.jsx';
import { ExpenseForm } from './ExpenseManager.jsx';
import { fetchReceiptEvents, uploadInboxReceipt } from './receiptInboxService.js';

const blank = () => ({ category: 'other_business_expense', expense_type: 'other', description: '', amount: '', status: 'paid', reimbursement_status: 'not_applicable', reimbursement_amount: '', reimbursable: false });

export default function MobileReceiptCapturePage() {
  const navigate = useNavigate();
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [file, setFile] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [values, setValues] = useState(blank);
  useEffect(() => { fetchReceiptEvents().then(setEvents).catch((error) => alert(error.message)); }, []);
  const save = async () => {
    if (!file) throw new Error('Take a photo or choose a receipt file first.');
    await uploadInboxReceipt(file, { related_event_id: eventId || null, suggested_description: values.description.trim() || null, suggested_amount: values.amount === '' ? null : Number(values.amount), suggested_category: values.category, suggested_expense_type: values.expense_type, suggested_status: values.status, suggested_reimbursement_status: values.reimbursement_status });
  };
  const done = () => navigate('/admin/receipts');
  const chooseFile = (event) => setFile(event.target.files?.[0] || null);
  return <div className="view active"><input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={chooseFile} /><input ref={galleryRef} type="file" accept="image/*,.pdf" hidden onChange={chooseFile} /><Modal title="Add Receipt" onClose={done}><p className="field-hint">Capture it now and finish processing it later, or add optional details to speed up classification.</p><div className="create-form-actions"><button className="btn btn-primary" onClick={() => cameraRef.current?.click()}>Take Photo</button><button className="btn btn-ghost" onClick={() => galleryRef.current?.click()}>Add From Gallery</button></div>{file && <p className="field-hint">Selected: {file.name}</p>}<div className="fields-grid"><label className="field-group full"><span className="field-label">Related Event (optional)</span><select className="field-input" value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">None — General Expense</option>{events.map((event) => <option key={event.id} value={event.id}>{event.label}</option>)}</select></label></div><p className="field-hint">Optional expense details</p><ExpenseForm values={values} setValues={setValues} /><div className="create-form-actions"><button className="btn btn-ghost" onClick={done}>Cancel</button><SaveButton onSave={save} onSaved={done} label="Add to Receipt Inbox" /></div></Modal></div>;
}
