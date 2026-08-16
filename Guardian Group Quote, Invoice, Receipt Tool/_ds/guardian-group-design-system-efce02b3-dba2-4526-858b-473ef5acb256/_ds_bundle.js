/* @ds-bundle: {"format":3,"namespace":"GuardianGroupDesignSystem_efce02","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"StatusPill","sourcePath":"components/core/StatusPill.jsx"},{"name":"Card","sourcePath":"components/data/Card.jsx"},{"name":"ProgressTracker","sourcePath":"components/data/ProgressTracker.jsx"},{"name":"SectionHeader","sourcePath":"components/data/SectionHeader.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"ChoiceItem","sourcePath":"components/forms/ChoiceItem.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"}],"sourceHashes":{"components/core/Button.jsx":"36a40e256c61","components/core/Eyebrow.jsx":"a5612172385c","components/core/StatusPill.jsx":"dd0d4ac11a5e","components/data/Card.jsx":"9612964eb23e","components/data/ProgressTracker.jsx":"7925bbb73b7e","components/data/SectionHeader.jsx":"e6676c241ddd","components/data/StatCard.jsx":"fdd888e9869f","components/forms/ChoiceItem.jsx":"c01a9bf69a09","components/forms/Field.jsx":"30cbdb44f864","ui_kits/admin/AdminApp.jsx":"7e70406f78c6","ui_kits/survey/SurveyApp.jsx":"d45a670812cc","ui_kits/workshops/WorkshopsApp.jsx":"9bec0ba010b8"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.GuardianGroupDesignSystem_efce02 = window.GuardianGroupDesignSystem_efce02 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Guardian Group button — Barlow Condensed, uppercase, tracked-out.
 * Primary = mid blue with a lifted navy shadow; submit = dark navy;
 * ghost = pale outline. Hover lifts 1px and deepens the blue.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  onClick,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: {
      padding: '6px 14px',
      fontSize: 11
    },
    md: {
      padding: '12px 28px',
      fontSize: 15
    },
    lg: {
      padding: '15px 36px',
      fontSize: 17
    }
  };
  const variants = {
    primary: {
      background: 'var(--gg-mid)',
      color: '#fff',
      boxShadow: 'var(--shadow-cta)'
    },
    submit: {
      background: 'var(--gg-dark)',
      color: '#fff',
      boxShadow: '0 4px 16px rgba(22,67,91,0.3)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--gg-muted)',
      border: 'var(--border-field) solid var(--gg-pale)'
    }
  };
  const [hover, setHover] = React.useState(false);
  const v = variants[variant] || variants.primary;
  const hoverStyle = !disabled && hover ? variant === 'ghost' ? {
    borderColor: 'var(--gg-steel)',
    color: 'var(--gg-dark)'
  } : {
    background: variant === 'submit' ? '#0d2e3f' : 'var(--gg-dark)',
    transform: 'translateY(-1px)'
  } : {};
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      borderRadius: 'var(--radius)',
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all var(--transition)',
      opacity: disabled ? 0.6 : 1,
      ...sizes[size],
      ...v,
      ...hoverStyle,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
/**
 * Eyebrow / pre-label — the tracked-out uppercase kicker that sits above
 * titles ("Pre-Workshop Survey", "Our Services"). Barlow Condensed.
 */
function Eyebrow({
  children,
  onDark = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: onDark ? 'var(--gg-pale)' : 'var(--gg-steel)',
      opacity: onDark ? 0.85 : 1,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusPill.jsx
try { (() => {
/**
 * Status pill — small tracked-out uppercase capsule with a leading dot.
 * Mirrors the workshop card status and admin badges.
 */
function StatusPill({
  children,
  tone = 'info',
  dot = true,
  style = {}
}) {
  const tones = {
    open: {
      background: 'var(--gg-success-bg)',
      color: 'var(--gg-success)'
    },
    info: {
      background: 'var(--gg-tint-mid)',
      color: 'var(--gg-mid)'
    },
    steel: {
      background: 'rgba(82,130,156,0.12)',
      color: 'var(--gg-steel)'
    },
    danger: {
      background: 'var(--gg-danger-bg)',
      color: 'var(--gg-danger)',
      border: '1px solid var(--gg-danger-bd)'
    },
    neutral: {
      background: 'var(--gg-off)',
      color: 'var(--gg-muted)',
      border: '1px solid var(--gg-pale)'
    }
  };
  const t = tones[tone] || tones.info;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-display)',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      ...t,
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor',
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/data/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Surface card — white, rounded, navy-tinted soft shadow. Optional accent
 * treatments: a top color bar (`accent="top"`), a thick left border
 * (`accent="left"`), or a thin full-width strip (`accentBar`). Lifts on hover
 * when `hover` is set (the workshop-card behaviour).
 */
function Card({
  children,
  accent,
  // 'top' | 'left' | undefined
  accentColor = 'var(--gg-mid)',
  accentBar = false,
  // thin 5px color strip across the top
  hover = false,
  padding = 28,
  style = {},
  ...rest
}) {
  const [over, setOver] = React.useState(false);
  const base = {
    background: 'var(--gg-white)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: over && hover ? 'var(--shadow-lg)' : 'var(--shadow)',
    overflow: 'hidden',
    transition: 'transform var(--transition), box-shadow var(--transition)',
    transform: over && hover ? 'translateY(-3px)' : 'none',
    ...(accent === 'top' ? {
      borderTop: `3px solid ${accentColor}`
    } : {}),
    ...(accent === 'left' ? {
      borderLeft: `4px solid ${accentColor}`
    } : {}),
    ...style
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => setOver(true),
    onMouseLeave: () => setOver(false),
    style: base
  }, rest), accentBar && /*#__PURE__*/React.createElement("div", {
    style: {
      height: 5,
      background: accentColor
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/ProgressTracker.jsx
try { (() => {
/**
 * Multi-step progress tracker — numbered circles + a gradient fill bar +
 * "Step N of M" label. Matches the survey progress header.
 */
function ProgressTracker({
  steps = 5,
  current = 1,
  showSteps = true,
  style = {}
}) {
  const pct = Math.round(current / steps * 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      ...style
    }
  }, showSteps && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexShrink: 0
    }
  }, Array.from({
    length: steps
  }).map((_, i) => {
    const n = i + 1;
    const done = n < current;
    const active = n === current;
    return /*#__PURE__*/React.createElement("div", {
      key: n,
      style: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: `2px solid ${active || done ? active ? 'var(--gg-mid)' : 'var(--gg-dark)' : 'var(--gg-pale)'}`,
        background: active ? 'var(--gg-mid)' : done ? 'var(--gg-dark)' : 'transparent',
        color: active || done ? '#fff' : 'var(--gg-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'var(--font-display)',
        transform: active ? 'scale(1.1)' : 'none',
        transition: 'all var(--transition)'
      }
    }, n);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 4,
      background: 'var(--gg-pale)',
      borderRadius: 2,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${pct}%`,
      background: 'var(--gradient-progress)',
      borderRadius: 2,
      transition: 'width var(--transition-slow)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--gg-muted)',
      flexShrink: 0,
      fontFamily: 'var(--font-display)',
      letterSpacing: '0.05em'
    }
  }, "Step ", current, " of ", steps));
}
Object.assign(__ds_scope, { ProgressTracker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ProgressTracker.jsx", error: String((e && e.message) || e) }); }

// components/data/SectionHeader.jsx
try { (() => {
/**
 * Section header — oversized pale Barlow Condensed numeral beside a title and
 * a light description. The repeating section marker in the survey & workshops.
 */
function SectionHeader({
  number,
  title,
  description,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 20,
      ...style
    }
  }, number != null && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 56,
      fontWeight: 700,
      lineHeight: 1,
      color: 'var(--gg-pale)',
      flexShrink: 0,
      letterSpacing: '-0.02em',
      marginTop: -4
    }
  }, number), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 28,
      fontWeight: 700,
      color: 'var(--gg-dark)',
      letterSpacing: '-0.01em',
      lineHeight: 1.1,
      margin: 0
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: 'var(--gg-muted)',
      marginTop: 6,
      fontWeight: 300,
      margin: '6px 0 0'
    }
  }, description)));
}
Object.assign(__ds_scope, { SectionHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/SectionHeader.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
/**
 * Dashboard stat card — big Barlow Condensed numeral over a tracked-out
 * uppercase label, with a top accent border. From the admin dashboard.
 */
function StatCard({
  value,
  label,
  accent = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gg-white)',
      borderRadius: 'var(--radius-md)',
      padding: 24,
      boxShadow: 'var(--shadow-xs)',
      borderTop: `3px solid ${accent ? 'var(--gg-mid)' : 'var(--gg-pale)'}`,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 40,
      fontWeight: 700,
      color: 'var(--gg-dark)',
      lineHeight: 1,
      marginBottom: 8
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--gg-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em'
    }
  }, label));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/ChoiceItem.jsx
try { (() => {
/**
 * Choice row — the bordered, selectable card used for checkboxes and radios
 * in the survey. `type="radio"` renders a circular control, otherwise a
 * rounded-square check. Selected state fills with the brand tint.
 */
function ChoiceItem({
  type = 'checkbox',
  name,
  value,
  checked = false,
  onChange,
  children,
  style = {}
}) {
  const [hover, setHover] = React.useState(false);
  const isRadio = type === 'radio';
  return /*#__PURE__*/React.createElement("label", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: 'pointer',
      padding: '10px 14px',
      borderRadius: 'var(--radius)',
      border: `var(--border-field) solid ${checked ? 'var(--gg-mid)' : hover ? 'var(--gg-steel)' : 'var(--gg-pale)'}`,
      background: checked ? 'var(--gg-tint-mid)' : hover ? 'var(--gg-tint-hover)' : 'var(--gg-white)',
      transition: 'all var(--transition)',
      fontSize: 14,
      color: checked ? 'var(--gg-dark)' : 'var(--gg-text)',
      fontWeight: checked ? 500 : 400,
      userSelect: 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: type,
    name: name,
    value: value,
    checked: checked,
    onChange: onChange,
    style: {
      display: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      flexShrink: 0,
      border: `var(--border-strong) solid ${checked ? 'var(--gg-mid)' : 'var(--gg-pale)'}`,
      borderRadius: isRadio ? '50%' : 'var(--radius-sm)',
      background: checked && !isRadio ? 'var(--gg-mid)' : 'var(--gg-white)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all var(--transition)'
    }
  }, checked && isRadio && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: 'var(--gg-mid)'
    }
  }), checked && !isRadio && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 6,
      borderLeft: '2px solid #fff',
      borderBottom: '2px solid #fff',
      transform: 'rotate(-45deg) translateY(-1px)'
    }
  })), /*#__PURE__*/React.createElement("span", null, children));
}
Object.assign(__ds_scope, { ChoiceItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/ChoiceItem.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Guardian Group form field — label + input/select/textarea with optional
 * hint and inline error. 1.5px pale border, navy focus ring. The brand's
 * core data-entry primitive.
 */
function Field({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  required = false,
  hint,
  error,
  options = [],
  rows = 3,
  full = true,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const hasError = Boolean(error);
  const inputStyle = {
    background: 'var(--gg-white)',
    border: `var(--border-field) solid ${hasError ? 'var(--gg-danger)' : focus ? 'var(--gg-mid)' : 'var(--gg-pale)'}`,
    borderRadius: 'var(--radius)',
    padding: '12px 16px',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    color: 'var(--gg-text)',
    width: '100%',
    outline: 'none',
    transition: 'border-color var(--transition), box-shadow var(--transition)',
    boxShadow: hasError ? '0 0 0 3px rgba(192,57,43,0.10)' : focus ? 'var(--ring)' : 'none',
    WebkitAppearance: 'none'
  };
  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    paddingRight: 40,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2352829C' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center'
  };
  const common = {
    name,
    value,
    onChange,
    placeholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    ...rest
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      gridColumn: full ? '1 / -1' : 'span 1',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--gg-dark)',
      letterSpacing: '0.01em'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gg-steel)'
    }
  }, " *")), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--gg-muted)',
      fontStyle: 'italic',
      marginTop: -2
    }
  }, hint), type === 'textarea' ? /*#__PURE__*/React.createElement("textarea", _extends({}, common, {
    rows: rows,
    style: {
      ...inputStyle,
      resize: 'vertical',
      minHeight: 80,
      lineHeight: 1.6
    }
  })) : type === 'select' ? /*#__PURE__*/React.createElement("select", _extends({}, common, {
    style: selectStyle
  }), placeholder && /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder), options.map(o => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  })) : /*#__PURE__*/React.createElement("input", _extends({}, common, {
    type: type,
    style: inputStyle
  })), hasError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--gg-danger)',
      marginTop: 4
    }
  }, error));
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/AdminApp.jsx
try { (() => {
// Guardian Group — Admin Dashboard (UI kit recreation)
// Dark navy sidebar, workshop selector, stat cards, charts, responses table.
// Composes StatCard, StatusPill, Card, Button from the bundle.

const {
  StatCard,
  StatusPill,
  Card,
  Button
} = window.GuardianGroupDesignSystem_efce02;
const NAV = [{
  id: 'overview',
  icon: '◈',
  label: 'Overview'
}, {
  id: 'responses',
  icon: '▤',
  label: 'Responses'
}, {
  id: 'registrants',
  icon: '◑',
  label: 'Registrants'
}, {
  id: 'workshops',
  icon: '◫',
  label: 'Workshops'
}];
const RESPONSES = [{
  name: 'Dana Whitfield',
  role: 'Safety Manager',
  org: 'Cascade Logistics',
  industry: 'Transportation',
  culture: 'Proactive',
  want: 'Practical tools my supervisors will actually use on the floor.'
}, {
  name: 'Marcus Reyes',
  role: 'Director of Ops',
  org: 'Summit Aviation',
  industry: 'Aviation / Aerospace',
  culture: 'Compliance-focused',
  want: 'A way to move our team beyond checklist thinking.'
}, {
  name: 'Priya Anand',
  role: 'EHS Lead',
  org: 'Northwind Energy',
  industry: 'Oil, Gas & Energy',
  culture: 'Reactive',
  want: 'Help building a case internally for a culture shift.'
}, {
  name: 'Tom Becker',
  role: 'Site Supervisor',
  org: 'Granite Builders',
  industry: 'Construction',
  culture: 'Proactive',
  want: 'Conflict de-escalation language I can use day-to-day.'
}];
const CHARTS = [{
  title: 'Safety Culture',
  data: [['Reactive', 1, 'var(--gg-dark)'], ['Compliance', 1, 'var(--gg-mid)'], ['Proactive', 2, 'var(--gg-steel)']]
}, {
  title: 'Industry',
  data: [['Transport', 1, 'var(--gg-dark)'], ['Aviation', 1, 'var(--gg-mid)'], ['Energy', 1, 'var(--gg-steel)'], ['Construction', 1, 'var(--gg-light)']]
}, {
  title: 'Familiarity',
  data: [['None', 1, 'var(--gg-dark)'], ['Some', 2, 'var(--gg-steel)'], ['Applies it', 1, 'var(--gg-light)']]
}];
function Donut({
  data
}) {
  const total = data.reduce((a, d) => a + d[1], 0);
  let acc = 0;
  const stops = data.map(([, v, c]) => {
    const start = acc / total * 360;
    acc += v;
    const end = acc / total * 360;
    return `${c} ${start}deg ${end}deg`;
  }).join(', ');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 130,
      height: 130,
      borderRadius: '50%',
      background: `conic-gradient(${stops})`,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 22,
      background: '#fff',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 700,
      color: 'var(--gg-dark)'
    }
  }, total)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      width: '100%'
    }
  }, data.map(([label, v, c]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
      color: 'var(--gg-text)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 2,
      background: c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gg-muted)',
      fontWeight: 600
    }
  }, v)))));
}
function AdminApp() {
  const [view, setView] = React.useState('overview');
  const [open, setOpen] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minHeight: '100%',
      background: 'var(--gg-canvas)'
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 220,
      background: 'var(--gg-dark)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-white.png",
    alt: "",
    style: {
      height: 30
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: '0.1em',
      color: '#fff'
    }
  }, "GUARDIAN"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--gg-pale)',
      opacity: 0.6,
      fontFamily: 'var(--font-display)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }, "Admin"))), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      padding: '20px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, NAV.map(n => /*#__PURE__*/React.createElement("button", {
    key: n.id,
    onClick: () => setView(n.id),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      borderRadius: 8,
      border: 'none',
      background: view === n.id ? 'rgba(255,255,255,0.12)' : 'transparent',
      color: view === n.id ? '#fff' : 'rgba(255,255,255,0.6)',
      fontFamily: 'var(--font-display)',
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: '0.05em',
      cursor: 'pointer',
      textAlign: 'left',
      textTransform: 'uppercase',
      transition: 'all 0.15s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      opacity: 0.7
    }
  }, n.icon), /*#__PURE__*/React.createElement("span", null, n.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      borderTop: '1px solid rgba(255,255,255,0.08)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'transparent',
      border: '1px solid rgba(255,255,255,0.2)',
      color: 'rgba(255,255,255,0.5)',
      padding: '8px 16px',
      borderRadius: 6,
      fontFamily: 'var(--font-display)',
      fontSize: 12,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      cursor: 'pointer',
      width: '100%'
    }
  }, "Sign Out"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderBottom: '1px solid rgba(22,67,91,0.1)',
      padding: '16px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--gg-muted)'
    }
  }, "Workshop"), /*#__PURE__*/React.createElement("select", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 15,
      fontWeight: 600,
      color: 'var(--gg-dark)',
      background: 'var(--gg-off)',
      border: '1.5px solid var(--gg-pale)',
      borderRadius: 8,
      padding: '8px 14px',
      minWidth: 280,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("option", null, "Conflict Resolution in High-Stress Environments"), /*#__PURE__*/React.createElement("option", null, "Safety Leadership Fundamentals"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      background: 'var(--gg-off)',
      padding: '6px 12px',
      borderRadius: 6,
      color: 'var(--gg-dark)',
      border: '1px solid var(--gg-pale)'
    }
  }, "surveys.guardiangroup.com/?w=conflict-q1"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "primary"
  }, "Copy"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 32,
      fontWeight: 700,
      color: 'var(--gg-dark)',
      letterSpacing: '-0.01em',
      margin: 0
    }
  }, view === 'overview' && 'Overview', view === 'responses' && 'Survey Responses', view === 'registrants' && 'Registrants', view === 'workshops' && 'Workshops'), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: 'var(--gg-muted)',
      marginTop: 4,
      margin: '4px 0 0'
    }
  }, view === 'overview' && 'Pre-workshop survey results at a glance.', view === 'responses' && 'Every submission, expandable.', view === 'registrants' && 'Who has signed up and paid.', view === 'workshops' && 'Create and manage your workshops.')), view === 'overview' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    accent: true,
    value: "4",
    label: "Responses"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "4",
    label: "Industries"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "2",
    label: "Proactive Cultures"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "100%",
    label: "Completion"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 20
    }
  }, CHARTS.map(c => /*#__PURE__*/React.createElement(Card, {
    key: c.title,
    padding: 24,
    style: {
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--gg-dark)',
      marginBottom: 20
    }
  }, c.title), /*#__PURE__*/React.createElement(Donut, {
    data: c.data
  }))))), view === 'responses' && /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ['Name', 'Organization', 'Industry', 'Culture', ''].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      background: 'var(--gg-dark)',
      color: '#fff',
      padding: '14px 16px',
      textAlign: 'left',
      fontFamily: 'var(--font-display)',
      fontSize: 11,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      fontWeight: 600
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, RESPONSES.map((r, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, /*#__PURE__*/React.createElement("tr", {
    onClick: () => setOpen(open === i ? null : i),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '13px 16px',
      borderBottom: '1px solid var(--gg-off)',
      color: 'var(--gg-dark)',
      fontWeight: 600
    }
  }, r.name), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '13px 16px',
      borderBottom: '1px solid var(--gg-off)',
      color: 'var(--gg-text)'
    }
  }, r.org), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '13px 16px',
      borderBottom: '1px solid var(--gg-off)',
      color: 'var(--gg-text)'
    }
  }, r.industry), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '13px 16px',
      borderBottom: '1px solid var(--gg-off)'
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    tone: "steel",
    dot: false
  }, r.culture)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '13px 16px',
      borderBottom: '1px solid var(--gg-off)',
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--gg-off)',
      color: 'var(--gg-mid)',
      fontSize: 12,
      fontWeight: 600,
      padding: '5px 12px',
      borderRadius: 6,
      fontFamily: 'var(--font-display)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase'
    }
  }, open === i ? 'Hide' : 'View'))), open === i && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 5,
    style: {
      background: '#f9fbfc',
      padding: '20px 24px',
      borderBottom: '2px solid var(--gg-pale)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--gg-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 6
    }
  }, "Role \xB7 ", r.role), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--gg-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 4
    }
  }, "One thing they want"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--gg-dark)',
      lineHeight: 1.6,
      fontStyle: 'italic'
    }
  }, "\"", r.want, "\"")))))))), view === 'registrants' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, RESPONSES.slice(0, 3).map((r, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    padding: 0,
    style: {
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: '20px 24px 16px',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 17,
      fontWeight: 700,
      color: 'var(--gg-dark)'
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--gg-muted)',
      marginTop: 2
    }
  }, r.org, " \xB7 ", r.role)), /*#__PURE__*/React.createElement(StatusPill, {
    tone: i === 2 ? 'info' : 'open',
    dot: false
  }, i === 2 ? 'Pending' : 'Paid')), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 24px',
      fontSize: 12,
      color: 'var(--gg-muted)',
      background: 'var(--gg-off)',
      borderTop: '1px solid var(--gg-pale)'
    }
  }, "1 seat \xB7 ", /*#__PURE__*/React.createElement("code", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11
    }
  }, "#GG-204", i))))), view === 'workshops' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, [['Conflict Resolution in High-Stress Environments', 'Mar 14, 2026', true], ['Safety Leadership Fundamentals', 'Apr 2, 2026', true], ['HOP for Frontline Supervisors', 'Draft', false]].map(([t, d, active], i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    accent: "left",
    accentColor: active ? 'var(--gg-mid)' : 'var(--gg-pale)',
    padding: 24,
    style: {
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-xs)',
      opacity: active ? 1 : 0.7
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--gg-dark)'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--gg-muted)',
      marginTop: 4
    }
  }, d), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost"
  }, "Edit"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost"
  }, "Copy link"))))))));
}
window.AdminApp = AdminApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/AdminApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/survey/SurveyApp.jsx
try { (() => {
// Guardian Group — Pre-Workshop Survey (UI kit recreation)
// Composes Field, ChoiceItem, ProgressTracker, SectionHeader, Button, Eyebrow
// from the design-system bundle. Faithful to css/survey.css + index.html.

const {
  Field,
  ChoiceItem,
  ProgressTracker,
  SectionHeader,
  Button,
  Eyebrow
} = window.GuardianGroupDesignSystem_efce02;
const SECTIONS = [{
  n: '01',
  title: 'About You',
  desc: "Let's start with the basics so we know who's in the room."
}, {
  n: '02',
  title: "Where You're Starting From",
  desc: 'No right or wrong answers — this helps us calibrate the conversation for your group.'
}, {
  n: '03',
  title: "What You're Hoping to Get",
  desc: 'We read every response. Your answers shape what we cover.'
}, {
  n: '04',
  title: 'Your Team & Organization',
  desc: 'Helps us use examples that fit your actual context.'
}, {
  n: '05',
  title: 'Logistics',
  desc: "A few quick operational things so we're set up for success."
}];
const CULTURE = ['Reactive — we respond to incidents after they happen', 'Compliance-focused — we follow the rules and check the boxes', 'Proactive — we actively try to prevent incidents', 'Generative — safety is truly embedded in how we lead and operate'];
const INVOLVEMENT = ['I make or influence safety decisions', 'I implement safety programs', 'I supervise people and manage safety day-to-day', 'I work on the front line', 'I train others on safety'];
function SurveyApp() {
  const [step, setStep] = React.useState(1); // 1..5
  const [done, setDone] = React.useState(false);
  const [form, setForm] = React.useState({
    culture: CULTURE[2],
    invol: {
      [INVOLVEMENT[0]]: true
    }
  });
  const set = k => e => setForm(f => ({
    ...f,
    [k]: e.target.value
  }));
  const toggle = k => setForm(f => ({
    ...f,
    invol: {
      ...f.invol,
      [k]: !f.invol[k]
    }
  }));
  const next = () => {
    if (step < 5) setStep(step + 1);else setDone(true);
  };
  const back = () => setStep(s => Math.max(1, s - 1));
  if (done) return /*#__PURE__*/React.createElement(SuccessScreen, {
    onReset: () => {
      setDone(false);
      setStep(1);
    }
  });
  const s = SECTIONS[step - 1];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gg-off)',
      minHeight: '100%'
    }
  }, /*#__PURE__*/React.createElement(SiteHeader, null), /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--gradient-hero)',
      padding: '56px 24px 48px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -60,
      right: -60,
      width: 320,
      height: 320,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.04)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 860,
      margin: '0 auto',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    onDark: true
  }, "Pre-Workshop Survey"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(32px,5vw,52px)',
      fontWeight: 700,
      color: '#fff',
      lineHeight: 1.1,
      margin: '12px 0',
      letterSpacing: '-0.01em'
    }
  }, "Conflict Resolution in High-Stress Environments"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      color: 'var(--gg-pale)',
      opacity: 0.9,
      fontWeight: 300,
      margin: 0
    }
  }, "Help us tailor the session to you before we meet."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 24,
      marginTop: 20,
      fontSize: 13,
      color: 'var(--gg-pale)',
      opacity: 0.75,
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement("span", null, "Facilitated by Haley G."), /*#__PURE__*/React.createElement("span", null, "March 14, 2026")))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderBottom: '1px solid rgba(22,67,91,0.08)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 860,
      margin: '0 auto',
      padding: '16px 24px'
    }
  }, /*#__PURE__*/React.createElement(ProgressTracker, {
    steps: 5,
    current: step
  }))), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 860,
      margin: '0 auto',
      paddingBottom: 80
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      padding: '48px 24px 24px',
      animation: 'gg-fade-slide-in 0.35s ease'
    },
    key: step
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 36
    }
  }, /*#__PURE__*/React.createElement(SectionHeader, {
    number: s.n,
    title: s.title,
    description: s.desc
  })), step === 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Full Name",
    placeholder: "Your full name",
    required: true,
    value: form.name || '',
    onChange: set('name')
  }), /*#__PURE__*/React.createElement(Field, {
    full: false,
    label: "Job Title / Role",
    placeholder: "e.g. Safety Manager",
    required: true,
    value: form.role || '',
    onChange: set('role')
  }), /*#__PURE__*/React.createElement(Field, {
    full: false,
    label: "Organization",
    placeholder: "Company or org name",
    required: true,
    value: form.org || '',
    onChange: set('org')
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Industry / Sector",
    type: "select",
    placeholder: "Select your industry...",
    required: true,
    value: form.industry || '',
    onChange: set('industry'),
    options: ['Construction / Trades', 'Healthcare', 'Aviation / Aerospace', 'Oil, Gas & Energy', 'Manufacturing', 'Other']
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: '1 / -1'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--gg-dark)'
    }
  }, "Your Primary Safety Involvement ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gg-steel)'
    }
  }, "*")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--gg-muted)',
      fontStyle: 'italic',
      margin: '2px 0 10px'
    }
  }, "Select all that apply"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, INVOLVEMENT.map(o => /*#__PURE__*/React.createElement(ChoiceItem, {
    key: o,
    checked: !!form.invol[o],
    onChange: () => toggle(o)
  }, o))))), step === 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--gg-dark)'
    }
  }, "Current Safety Culture in Your Organization"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginTop: 10
    }
  }, CULTURE.map(o => /*#__PURE__*/React.createElement(ChoiceItem, {
    key: o,
    type: "radio",
    name: "culture",
    value: o,
    checked: form.culture === o,
    onChange: () => setForm(f => ({
      ...f,
      culture: o
    }))
  }, o)))), /*#__PURE__*/React.createElement(Field, {
    label: "What does safety leadership look like in your organization right now?",
    type: "textarea",
    rows: 3,
    hint: "A few words or a sentence is perfect.",
    value: form.leadership || '',
    onChange: set('leadership'),
    placeholder: "Describe it in your own words..."
  })), step === 3 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "The ONE thing you most hope to walk away with",
    type: "textarea",
    rows: 4,
    required: true,
    hint: "Be as specific as you'd like.",
    placeholder: "What would make this workshop a success for you?",
    value: form.oneThing || '',
    onChange: set('oneThing')
  }), /*#__PURE__*/React.createElement(Field, {
    label: "A specific challenge you're hoping this workshop will help you address",
    type: "textarea",
    rows: 3,
    placeholder: "Optional \u2014 but often the most useful thing we learn...",
    value: form.challenge || '',
    onChange: set('challenge')
  })), step === 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Field, {
    full: false,
    label: "People on your team",
    type: "select",
    placeholder: "Select...",
    value: form.team || '',
    onChange: set('team'),
    options: ['Just me', '2–5 people', '6–15 people', '16–50 people', 'More than 100']
  }), /*#__PURE__*/React.createElement(Field, {
    full: false,
    label: "Overall organization size",
    type: "select",
    placeholder: "Select...",
    value: form.orgsize || '',
    onChange: set('orgsize'),
    options: ['Small (2–25)', 'Medium (26–200)', 'Large (201–1,000)', 'Enterprise (1,000+)']
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Any significant organizational changes affecting safety right now?",
    type: "textarea",
    rows: 3,
    hint: "e.g. leadership transition, rapid growth, incident aftermath",
    placeholder: "Optional...",
    value: form.change || '',
    onChange: set('change')
  })), step === 5 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Email Address",
    type: "email",
    placeholder: "you@example.com",
    required: true,
    value: form.email || '',
    onChange: set('email')
  }), /*#__PURE__*/React.createElement(Field, {
    full: false,
    label: "Time Zone",
    placeholder: "e.g. EST, CST, PST...",
    value: form.tz || '',
    onChange: set('tz')
  }), /*#__PURE__*/React.createElement(Field, {
    full: false,
    label: "Tech check complete?",
    type: "select",
    placeholder: "Select...",
    value: form.tech || '',
    onChange: set('tech'),
    options: ["Yes, I'm all set", "No, but I'll do it before", 'I need help']
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Anything else we should know?",
    type: "textarea",
    rows: 3,
    placeholder: "Catch-all...",
    value: form.else || '',
    onChange: set('else')
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '24px 24px 48px',
      borderTop: '1px solid rgba(22,67,91,0.08)'
    }
  }, step > 1 ? /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: back
  }, "\u2190 Back") : /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--gg-muted)',
      fontStyle: 'italic'
    }
  }, "* Required fields"), /*#__PURE__*/React.createElement(Button, {
    variant: step === 5 ? 'submit' : 'primary',
    onClick: next
  }, step === 5 ? 'Submit Survey →' : 'Continue →')))), /*#__PURE__*/React.createElement(SiteFooter, null));
}
function SiteHeader() {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      background: 'var(--gg-dark)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 2px 16px rgba(0,0,0,0.2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 860,
      margin: '0 auto',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-white.png",
    alt: "Guardian Group",
    style: {
      height: 36
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      color: 'var(--gg-pale)',
      opacity: 0.8
    }
  }, "Safety & Leadership Solutions")));
}
function SiteFooter() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--gg-dark)',
      textAlign: 'center',
      padding: '20px 24px'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--gg-pale)',
      opacity: 0.6,
      fontFamily: 'var(--font-display)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      margin: 0
    }
  }, "Guardian Group Safety & Leadership Solutions \xA0\xB7\xA0 Beyond Compliance"));
}
function SuccessScreen({
  onReset
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gg-off)',
      minHeight: '100%'
    }
  }, /*#__PURE__*/React.createElement(SiteHeader, null), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 600,
      margin: '80px auto',
      padding: 24,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: 'var(--radius-lg)',
      padding: '56px 48px',
      boxShadow: 'var(--shadow-lg)',
      borderTop: '4px solid var(--gg-dark)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      height: 80,
      margin: '0 auto 24px',
      background: 'var(--gg-off)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-color.png",
    alt: "",
    style: {
      width: 56
    }
  })), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 36,
      fontWeight: 700,
      color: 'var(--gg-dark)',
      margin: '0 0 16px'
    }
  }, "You're all set."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--gg-muted)',
      lineHeight: 1.8,
      margin: 0
    }
  }, "We read every response before the workshop. Your answers will directly shape what we cover and how we show up for you."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontStyle: 'italic',
      color: 'var(--gg-steel)',
      marginTop: 24
    }
  }, "See you soon."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--gg-pale)',
      marginTop: 32,
      fontFamily: 'var(--font-display)',
      letterSpacing: '0.04em'
    }
  }, "\u2014 Guardian Group Safety & Leadership Solutions"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: onReset
  }, "\u21BA Restart demo")))), /*#__PURE__*/React.createElement(SiteFooter, null));
}
window.SurveyApp = SurveyApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/survey/SurveyApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/workshops/WorkshopsApp.jsx
try { (() => {
// Guardian Group — Workshops listing site (UI kit recreation)
// Hero + workshop cards grid + detail modal. Composes Card, StatusPill,
// Button, Eyebrow from the bundle.

const {
  Card,
  StatusPill,
  Button,
  Eyebrow
} = window.GuardianGroupDesignSystem_efce02;
const WORKSHOPS = [{
  title: 'Conflict Resolution in High-Stress Environments',
  sub: 'Managing disputes among staff, customers, and friends in a way that promotes trust and maintains professionalism.',
  date: 'March 14, 2026',
  mode: 'Virtual · Half day',
  seats: 6,
  price: 295,
  status: 'open',
  desc: 'A hands-on workshop drawing on behavioral science and human psychology. Learn the Recognize → Pause → Empathy → Focus Forward model and leave with language you can use the same day.'
}, {
  title: 'Safety Leadership Fundamentals',
  sub: 'Move your team beyond compliance and checklist thinking toward a generative safety culture.',
  date: 'April 2, 2026',
  mode: 'In person · Full day',
  seats: 14,
  price: 450,
  status: 'open',
  desc: 'For supervisors and managers who set the tone. We cover the leader as a signal, building psychological safety, and the habits that make safety a natural part of operations — not an extra step.'
}, {
  title: 'HOP for Frontline Supervisors',
  sub: 'Human & Organizational Performance, made practical for the people closest to the work.',
  date: 'May 9, 2026',
  mode: 'Virtual · Half day',
  seats: 0,
  price: 295,
  status: 'closed',
  desc: 'A pragmatic introduction to HOP principles: error is normal, blame fixes nothing, and learning is vital. Built for supervisors, not theorists.'
}, {
  title: 'Emergency Response Training',
  sub: 'Build the muscle memory and clear-headed decision making that high-risk moments demand.',
  date: 'June 18, 2026',
  mode: 'In person · Full day',
  seats: 3,
  price: 525,
  status: 'open',
  desc: 'Scenario-based training developed by a Certified Safety Professional and former director of operations in a high-risk industry. Practical, calm, repeatable.'
}];
const SERVICES = ['Safety Program Development', 'Operational Training', 'Safety & Leadership Consulting', '"Outsourced" Safety Management', 'Emergency Response Training', 'OSHA Compliance Support'];
function WorkshopsApp() {
  const [modal, setModal] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gg-off)',
      minHeight: '100%'
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      background: 'var(--gg-dark)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 2px 16px rgba(0,0,0,0.2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1080,
      margin: '0 auto',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-white.png",
    alt: "Guardian Group",
    style: {
      height: 38
    }
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: 28,
      alignItems: 'center'
    }
  }, ['Workshops', 'Consulting', 'About'].map((l, i) => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: i === 0 ? '#fff' : 'var(--gg-pale)',
      textDecoration: 'none',
      opacity: i === 0 ? 1 : 0.75
    }
  }, l)), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "primary"
  }, "Contact")))), /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--gradient-hero)',
      padding: '64px 24px 56px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -60,
      right: -60,
      width: 320,
      height: 320,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.04)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: -40,
      left: -40,
      width: 200,
      height: 200,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.03)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1080,
      margin: '0 auto',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    onDark: true
  }, "Upcoming Workshops"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(34px,5vw,52px)',
      fontWeight: 700,
      color: '#fff',
      lineHeight: 1.1,
      margin: '12px 0',
      letterSpacing: '-0.01em',
      maxWidth: 760
    }
  }, "Practical safety & leadership training, built around people."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      color: 'var(--gg-pale)',
      opacity: 0.9,
      fontWeight: 300,
      margin: 0,
      maxWidth: 620
    }
  }, "Hands-on sessions that blend operational experience with behavioral science. Reserve a seat below."))), /*#__PURE__*/React.createElement("main", {
    style: {
      maxWidth: 1080,
      margin: '0 auto',
      padding: '48px 24px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gap: 28
    }
  }, WORKSHOPS.map((w, i) => {
    const closed = w.status === 'closed';
    return /*#__PURE__*/React.createElement(Card, {
      key: i,
      hover: true,
      accentBar: true,
      accentColor: closed ? 'var(--gg-pale)' : 'var(--gg-mid)',
      padding: 0
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '28px 28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
        boxSizing: 'border-box'
      }
    }, /*#__PURE__*/React.createElement(StatusPill, {
      tone: closed ? 'neutral' : 'open',
      dot: !closed
    }, closed ? 'Sold out' : `Open · ${w.seats} seats left`), /*#__PURE__*/React.createElement("h3", {
      style: {
        fontFamily: 'var(--font-display)',
        fontSize: 26,
        fontWeight: 700,
        color: 'var(--gg-dark)',
        lineHeight: 1.15,
        letterSpacing: '-0.01em',
        margin: 0
      }
    }, w.title), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15,
        color: 'var(--gg-muted)',
        fontWeight: 300,
        lineHeight: 1.5,
        margin: 0
      }
    }, w.sub), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginTop: 4,
        paddingTop: 16,
        borderTop: '1px solid var(--gg-pale)'
      }
    }, /*#__PURE__*/React.createElement(Meta, {
      icon: "\u25F7",
      label: w.date
    }), /*#__PURE__*/React.createElement(Meta, {
      icon: "\u2B21",
      label: w.mode
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: 'auto',
        paddingTop: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontSize: 28,
        fontWeight: 700,
        color: 'var(--gg-dark)',
        letterSpacing: '-0.02em'
      }
    }, "$", w.price, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 400,
        color: 'var(--gg-muted)'
      }
    }, " / seat")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      onClick: () => setModal(w)
    }, "Details"), closed ? /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "primary",
      disabled: true
    }, "Sold out") : /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "primary",
      onClick: () => setModal(w)
    }, "Register \u2192")))));
  }))), /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--gg-dark)',
      padding: '48px 24px',
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1080,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-block',
      background: 'var(--gg-steel)',
      color: '#fff',
      fontFamily: 'var(--font-display)',
      fontSize: 18,
      fontWeight: 700,
      padding: '8px 20px',
      borderRadius: 'var(--radius-pill)',
      marginBottom: 24
    }
  }, "Our Services"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: '16px 32px'
    }
  }, SERVICES.map(s => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/icon-shield.png",
    alt: "",
    style: {
      width: 22,
      height: 22,
      filter: 'brightness(0) invert(1)',
      opacity: 0.9
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 17,
      fontWeight: 600
    }
  }, s)))))), /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--gg-black)',
      textAlign: 'center',
      padding: '24px'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--gg-pale)',
      opacity: 0.6,
      fontFamily: 'var(--font-display)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      margin: 0
    }
  }, "Guardian Group Safety & Leadership Solutions \xA0\xB7\xA0 Beyond Compliance")), modal && /*#__PURE__*/React.createElement(DetailModal, {
    w: modal,
    onClose: () => setModal(null)
  }));
}
function Meta({
  icon,
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      color: 'var(--gg-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      textAlign: 'center',
      color: 'var(--gg-steel)'
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gg-text)',
      fontWeight: 500
    }
  }, label));
}
function DetailModal({
  w,
  onClose
}) {
  const closed = w.status === 'closed';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(10,30,50,0.6)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: '#fff',
      borderRadius: 16,
      width: '100%',
      maxWidth: 520,
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: '0 20px 60px rgba(10,30,50,0.25)',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      position: 'absolute',
      top: 16,
      right: 16,
      background: 'rgba(255,255,255,0.9)',
      border: 'none',
      borderRadius: '50%',
      width: 32,
      height: 32,
      fontSize: 16,
      color: 'var(--gg-muted)',
      cursor: 'pointer',
      zIndex: 1
    }
  }, "\u2715"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      background: closed ? 'var(--gg-pale)' : 'var(--gg-mid)',
      borderRadius: '16px 16px 0 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '28px 32px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    tone: closed ? 'neutral' : 'open',
    dot: !closed
  }, closed ? 'Sold out' : `Open · ${w.seats} seats left`), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 700,
      color: 'var(--gg-dark)',
      letterSpacing: '-0.01em',
      lineHeight: 1.15,
      margin: 0
    }
  }, w.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: 'var(--gg-text)',
      lineHeight: 1.7,
      margin: 0
    }
  }, w.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      paddingTop: 16,
      borderTop: '1px solid var(--gg-pale)'
    }
  }, /*#__PURE__*/React.createElement(Meta, {
    icon: "\u25F7",
    label: w.date
  }), /*#__PURE__*/React.createElement(Meta, {
    icon: "\u2B21",
    label: w.mode
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 32,
      fontWeight: 700,
      color: 'var(--gg-dark)',
      letterSpacing: '-0.02em',
      paddingTop: 8
    }
  }, "$", w.price, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 400,
      color: 'var(--gg-muted)'
    }
  }, " / seat")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      paddingTop: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: onClose,
    style: {
      flex: 1
    }
  }, "Close"), closed ? /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    disabled: true,
    style: {
      flex: 1
    }
  }, "Sold out") : /*#__PURE__*/React.createElement(Button, {
    variant: "submit",
    style: {
      flex: 1
    }
  }, "Reserve a seat \u2192")))));
}
window.WorkshopsApp = WorkshopsApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/workshops/WorkshopsApp.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.ProgressTracker = __ds_scope.ProgressTracker;

__ds_ns.SectionHeader = __ds_scope.SectionHeader;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.ChoiceItem = __ds_scope.ChoiceItem;

__ds_ns.Field = __ds_scope.Field;

})();
