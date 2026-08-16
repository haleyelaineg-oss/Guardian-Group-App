# Guardian Group — Design System

**Guardian Group Safety & Leadership Solutions** is a safety-training and consulting practice. Their tagline is **"Beyond Compliance"** — they build safety programs *around people, not just checklists*, blending hands-on operational experience (the founder is a Certified Safety Professional and former director of operations in a high-risk industry — skydiving) with behavioral science and human psychology.

This design system captures their brand: a single deep-navy → steel-blue palette, the Barlow / Barlow Condensed type pairing, a winged-shield mark, and the product surfaces of their app (a pre-workshop survey, an admin dashboard, and a public workshops listing), plus a workshop slide kit.

---

## Sources

This system was reverse-engineered from materials the client provided and their codebase. If you have access, explore them to go deeper:

- **GitHub — app codebase:** [`haleyelaineg-oss/Guardian-Group-App`](https://github.com/haleyelaineg-oss/Guardian-Group-App)
  - `css/survey.css` — the brand token source of truth (colors, fonts, radii, shadows)
  - `css/admin.css`, `css/workshops.css` — dashboard + listing styles
  - `index.html`, `admin/`, `workshops/`, `register/` — the product surfaces
  - `resources/` — printable safety field cards (glove-box cards, checklists)
- **`Color Codes.docx`** — confirms the 5 core brand hex values
- **`Guardian Group Template.pptx`** + slide screenshots — workshop deck style
- **Brand art:** color/white logos, the shield icon, the diagonal-navy services banner, the "Guardian Difference" copy block

> Built for the Guardian Group brand. Explore the GitHub repo above to recreate product surfaces with higher fidelity.

---

## CONTENT FUNDAMENTALS

**Voice — warm, plain-spoken, people-first.** Guardian writes like a trusted practitioner, not a compliance manual. Safety is framed as *human* before it is *procedural*.

- **Person:** First-person plural for the brand ("**we** believe", "**we** read every response"), second-person for the reader ("**you**", "where **you're** starting from"). Direct and personal.
- **Casing:** Sentence case for prose and most headings. **UPPERCASE only on tracked-out display elements** — eyebrows, buttons, table headers, footer ("PRE-WORKSHOP SURVEY", "SUBMIT SURVEY →", "BEYOND COMPLIANCE").
- **Tone:** Reassuring and non-judgmental. The survey literally says *"No right or wrong answers."* Copy lowers the stakes and invites honesty.
- **Punctuation:** Loves the em-dash for asides — *"built around people — not just checklists."* Uses rhetorical questions as hooks ("But the real difference?", "What Drives Conflict?").
- **Emphasis:** Bold lead-ins on the first clause of a paragraph, then regular weight — *"**At Guardian Group,** we believe safety…"*.
- **No emoji.** None in the product or collateral. Status and emphasis are carried by color, weight, and the shield mark — never emoji. (A few utility glyphs appear: ⚠ for errors, ✓-style checks, → on buttons.)
- **Signature phrases:** "Beyond Compliance", "Safety & Leadership Solutions", "built around people", "a natural part of operations — not an extra step".

Example (the brand's own words):
> "At Guardian Group, we believe safety and training programs work better when they're built around people — not just around checklists."

---

## VISUAL FOUNDATIONS

**Color — one confident ramp.** The entire brand is a single deep-navy → pale-blue scale, no competing accent hue. Dark `#16435B` anchors headers/footers/heroes; mid `#2A5C76` is the primary action color; steel `#52829C` and light `#77A4BC` provide tonal variety; pale `#C8DCE9` is borders/tracks; off-white `#F6F6F6` is the page. Text is a navy-tinted ink `#1C3444` — **never pure black**. Status is minimal: green `#165B3C` for "open", red `#C0392B` for errors. See `tokens/colors.css`.

**Type — Barlow + Barlow Condensed.** Body is **Barlow** (300–700), set airy at line-height 1.6, with a light 300 weight for subtitles. Display is **Barlow Condensed** (600/700) — used for titles, oversized step numerals, buttons, eyebrows and labels, almost always UPPERCASE and tracked-out (0.06em on buttons, up to 0.2em on eyebrows). Big condensed numerals (56px section numbers, 40px stat values) are a signature. Loaded from Google Fonts. See `tokens/typography.css`.

**Backgrounds.** The hero signature is a **135° diagonal gradient** from dark to mid navy, decorated with very faint (4–5% white) large circles bleeding off the corners. The admin shell uses a darker `#0D1B24 → #1A3A50` gradient. Deck backgrounds alternate solid navy (`#2A5C76`/`#16435B`) and a pale tint (`#EAF3FA`). No photography in the core app; the shield mark sometimes appears as a low-opacity watermark. Occasional angled/triangular navy shapes appear in marketing collateral.

**Cards.** White, `border-radius: 16px` (12px on dashboard tiles), with a **navy-tinted soft shadow** (`0 4px 24px rgba(22,67,91,0.10)`) — shadows are always tinted with the brand navy, never neutral grey. Accents come three ways: a **5px color strip** across the top (workshop cards), a **3px top border** (stat tiles), or a **4px left border** (open-ended responses, workshop list). Workshop cards **lift −3px** and deepen their shadow on hover.

**Borders.** The signature field border is **1.5px** `#C8DCE9` (not 1px, not 2px). Checkboxes/radios use 2px. Selected/active states swap the border to mid-blue and fill with a 5% navy tint (`rgba(42,92,118,0.05)`).

**Inputs & focus.** Inputs are white, 1.5px pale border, `border-radius: 8px`, 12×16 padding. Focus turns the border mid-blue and adds a 3px ring `rgba(42,92,118,0.12)`. Errors turn it red with a matching red ring.

**Buttons.** Barlow Condensed, UPPERCASE, tracked 0.06em, `border-radius: 8px`. Primary = mid-blue with a lifted shadow `0 4px 16px rgba(42,92,118,0.3)`; submit = dark navy; ghost = transparent with a pale outline. **Hover lifts the button −1px** and deepens the fill; disabled drops to 60% opacity.

**Status pills.** Small tracked-out uppercase capsules (`border-radius: 20px`) with a leading 6px dot; tinted backgrounds at ~10% alpha (green for open, blue for info, red for error).

**Motion.** Restrained and quick. `0.2s ease` default (`0.15s` for nav, `0.4s` for the progress bar). The one named entrance is `gg-fade-slide-in` — a 16px rise + fade over 0.35s used on each survey step. A simple spinner for loading. **No bounces, no parallax, no decorative loops.**

**Corner radii.** 4 (chips/checkboxes) · 8 (inputs, buttons, cards) · 12 (dashboard cards) · 16 (heroes, modals) · 20 (pills) · 50% (step circles, avatars).

**Transparency & blur.** Used sparingly: faint white circles on heroes (4–5%), brand-tint overlays on selected/hover states (3–5%), modal scrims at `rgba(10,30,50,0.55–0.6)`. No glassmorphism/backdrop-blur.

**Imagery vibe.** Cool, navy, professional. When images appear they read calm and corporate; the palette never warms up.

---

## ICONOGRAPHY

Guardian Group has **no built-in icon font and ships almost no icons** in the product. The visual system leans on type, color and the brand mark instead.

- **The shield mark is the primary icon.** A winged shield carrying a check (`assets/icon-shield.png`, also `logo-color.svg`) — protection + verified safety. It serves as favicon, the success-screen seal, a low-opacity background watermark, and the **bullet glyph** in marketing collateral (the "Our Services" list reverses it to white). Reuse it for service/feature bullets rather than a generic checkmark.
- **Utility glyphs, not icon sets.** The app uses a handful of Unicode characters where it needs an icon: `⚠` (error state), `→`/`←` (button arrows), `✕` (modal close), `·` (footer separator), and CSS-drawn checks/dots for checkboxes, radios and status pills. The SVG chevron on selects is inline data-URI, stroked in steel `#52829C` at 1.5px.
- **No emoji, ever.** Do not introduce emoji as iconography.
- **Substitution guidance:** if a build needs a broader icon set (e.g. workshop meta rows, dashboard nav), use a **thin-stroke, professional line set** — [Lucide](https://lucide.dev) (~1.5–2px stroke) is the closest match to the brand's restraint. **Flagged substitution:** the source has no such set; Lucide is a recommendation, not an existing asset. Keep icons monochrome in `--gg-mid`/`--gg-steel` and never busier than the type around them.

---

## INDEX

**Root**
- `styles.css` — global entry point (consumers link this). `@import`s only.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`
- `assets/` — logos (color/white, PNG + SVG), shield icon, services banner & poster, brand gradient, the Guardian Difference block
- `SKILL.md` — Agent-Skills-compatible entry point

**Components** (`window.GuardianGroupDesignSystem_efce02`)
- `components/core/` — **Button**, **StatusPill**, **Eyebrow**
- `components/forms/` — **Field** (input/select/textarea), **ChoiceItem** (checkbox/radio row)
- `components/data/` — **Card**, **StatCard**, **ProgressTracker**, **SectionHeader**

**UI Kits** (`ui_kits/<product>/index.html`)
- `survey/` — multi-step pre-workshop survey (the core product)
- `admin/` — login-protected admin dashboard (overview, responses, registrants, workshops)
- `workshops/` — public workshops listing with detail modal + services band

**Slides** (`slides/*.card.html`, 1280×720)
- Title · Quadrant · Process · Section Divider · Content · Services

**Guidelines** (`guidelines/*.card.html`) — foundation specimen cards for the Design System tab (Colors, Type, Spacing, Brand).

---

## Quick start

```html
<link rel="stylesheet" href="styles.css" />
<script src="_ds_bundle.js"></script>
<script>
  const { Button, Field, Card, StatusPill } = window.GuardianGroupDesignSystem_efce02;
</script>
```

All color, type and spacing are exposed as CSS custom properties (`var(--gg-dark)`, `var(--font-display)`, `var(--radius-lg)`, `var(--gradient-hero)`, …). Prefer tokens over raw hex so designs stay on-brand.
