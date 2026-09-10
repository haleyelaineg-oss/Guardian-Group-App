import { useNavigate, useParams } from 'react-router-dom';

const GROUPS = {
  printables: {
    title: 'Printables', description: 'Ready-to-print field references, crew tools, and checklists.',
    items: [
      ['Cargo Securement Checklist', 'Fill it out online, then print or save as PDF.', '/resources/GG_Cargo_Securement_Checklist.html'],
      ['Glove Box Load Card', 'A half-sheet truck reference card for printing and laminating.', '/resources/GG_Glove_Box_Card.html'],
      ['5 Questions Before You Move', 'A crew alignment card for planning a safe move.', '/resources/GG_5_Questions_Before_You_Move.html'],
    ],
  },
  digital_tools: {
    title: 'Digital Tools', description: 'Interactive guides and fillable tools for use in the field or at a desk.',
    items: [
      ['Cargo Securement Checklist', 'A fillable pre-drive inspection tool.', '/resources/GG_Cargo_Securement_Checklist.html'],
      ['Securement Standards & Systems', 'Examples and recommendations for building an intentional securement practice.', '/resources/securement_standards.html'],
    ],
  },
  training_materials: {
    title: 'Training Materials', description: 'Reference documents and source material for Guardian Group training.',
    items: [
      ['Conflict Resolution in High-Stress Environments', 'Guardian Group presentation deck.', '/resources/Presentations/ISA%20Conflict%20Resolution%20in%20High-Stress%20Environments.pdf'],
      ['Common Violations', 'Reference PDF for common cargo-securement violations.', '/resources/pdfs/Common-Violations.pdf'],
      ['Carrier Compliance Questionnaire', 'Reference PDF for carrier compliance review.', '/resources/pdfs/Carrier-Compliance-Questionnaire.pdf'],
    ],
  },
};

function open(url) { window.open(url, '_blank', 'noopener'); }

export default function ResourceLibraryPage() {
  const { category } = useParams(); const navigate = useNavigate(); const group = category ? GROUPS[category] : null;
  if (group) return <div className="view active"><div className="view-header"><div><h1 className="view-title">{group.title}</h1><p className="view-sub">{group.description}</p></div><button className="btn btn-ghost" onClick={() => navigate('/admin/resources')}>← Resource Library</button></div><div className="resource-library-grid">{group.items.map(([title, description, url]) => <article className="resource-library-card" key={url}><h2>{title}</h2><p>{description}</p><button className="btn btn-ghost" onClick={() => open(url)}>Open Resource ↗</button></article>)}</div></div>;
  const cards = [
    ['Sessions & Presentations', 'Create reusable sessions, keep their decks and supporting materials together, and see delivery history.', () => navigate('/admin/sessions')],
    ['Printables', 'Field cards, checklists, and other print-ready resources.', () => navigate('/admin/resources/printables')],
    ['Digital Tools', 'Interactive forms and browser-based operational tools.', () => navigate('/admin/resources/digital-tools')],
    ['Training Materials', 'Presentation decks, reference PDFs, and training support files.', () => navigate('/admin/resources/training-materials')],
  ];
  return <div className="view active"><div className="view-header"><div><h1 className="view-title">Resource Library</h1><p className="view-sub">A single home for reusable sessions, printables, tools, and training resources.</p></div></div><div className="resource-library-grid">{cards.map(([title, description, action]) => <article className="resource-library-card" key={title}><h2>{title}</h2><p>{description}</p><button className="btn btn-primary" onClick={action}>Open →</button></article>)}</div></div>;
}
