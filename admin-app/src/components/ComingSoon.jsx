// Placeholder for a route whose feature hasn't been migrated yet — keeps
// every nav item clickable/navigable from Phase 1 on, per MIGRATION_MAP.md's
// route list, without faking real functionality. Replaced feature-by-feature
// as each phase lands; delete this file once nothing imports it anymore.
export default function ComingSoon({ title, phase }) {
  return (
    <div className="view active">
      <div className="view-header">
        <h1 className="view-title">{title}</h1>
      </div>
      <p className="view-sub">
        Not yet migrated to React — still live in the vanilla admin portal.
        {phase ? ` Planned for ${phase} (see MIGRATION_MAP.md).` : ''}
      </p>
    </div>
  );
}
