import { useLocation } from 'react-router-dom';

// The quote tool remains the existing standalone application. Keeping it in
// an iframe preserves its own auth, document, and print behavior while the
// React shell owns navigation around it.
export default function QuoteToolPage() {
  const location = useLocation();
  return <div className="quote-tool-workspace"><iframe className="quote-tool-frame" src={`/quote-tool/index.html${location.search}`} title="Quotes, invoices, and receipts" /></div>;
}
