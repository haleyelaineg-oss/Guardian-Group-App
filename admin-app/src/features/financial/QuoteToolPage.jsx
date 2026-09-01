import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// The quote tool remains the existing standalone application. Keeping it in
// an iframe preserves its own auth, document, and print behavior while the
// React shell owns navigation around it.
export default function QuoteToolPage() {
  const location = useLocation();
  const [query, setQuery] = useState(location.search || '?view=list');

  useEffect(() => {
    setQuery(location.search || '?view=list');
  }, [location.search]);

  useEffect(() => {
    const openAllDocuments = () => setQuery('?view=list');
    window.addEventListener('quote-tool:all-documents', openAllDocuments);
    return () => window.removeEventListener('quote-tool:all-documents', openAllDocuments);
  }, []);

  return <div className="quote-tool-workspace"><iframe className="quote-tool-frame" src={`/quote-tool/index.html${query}`} title="Quotes, invoices, and receipts" /></div>;
}
