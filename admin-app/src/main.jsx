import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App.jsx';

// Reused as-is from the vanilla admin app, same load order (survey.css
// defines the shared design tokens/components admin.css builds on).
import '../../css/survey.css';
import '../../css/admin.css';

// An open admin tab can briefly reference route chunks from the previous
// deployment. Vite reports that as a preload error; a full reload fetches the
// current HTML and its current chunk names.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* No basename yet — the production mount path is still an open
        question (see MIGRATION_MAP.md §0), so routes are plain /admin/...
        for now and match cleanly to the dev server root at "/". */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
