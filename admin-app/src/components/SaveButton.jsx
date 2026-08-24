import { useState } from 'react';

const SUCCESS_DISPLAY_MS = 1200;

// Shared convention for every explicit Save/Create action in the app —
// not for immediate actions (Delete, Copy, Regenerate, status toggles),
// which keep their existing one-click behavior unchanged.
//
// `onSave` is the actual persistence call (including any synchronous
// validation — throw an Error to reject with a message, same as every
// service function already does). It must NOT catch its own errors or
// close/reset anything itself; this component owns the saving/success/
// error states and is the single place that alerts a failure.
//
// `onSaved`, if given, fires after the brief "✓ Saved" confirmation has
// been visible — the right place to close a form/modal, so the user
// actually sees the confirmation before it disappears rather than the
// save completing and the form vanishing in the same instant.
export default function SaveButton({ onSave, onSaved, label, className = 'btn btn-primary' }) {
  const [status, setStatus] = useState('idle'); // idle | saving | success

  async function handleClick() {
    if (status === 'saving') return;
    setStatus('saving');
    try {
      // Let React commit the saving state before a very fast request can
      // resolve and batch straight through to the success state. This keeps
      // the promised "Saving…" feedback perceptible even for local/fast DB
      // responses.
      await new Promise(requestAnimationFrame);
      await onSave();
      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        onSaved?.();
      }, SUCCESS_DISPLAY_MS);
    } catch (err) {
      setStatus('idle');
      alert(err.message);
    }
  }

  const text = status === 'saving' ? 'Saving…' : status === 'success' ? '✓ Saved' : label;

  return (
    <button className={className} onClick={handleClick} disabled={status === 'saving'}>
      {text}
    </button>
  );
}
