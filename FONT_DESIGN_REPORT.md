# TaskMentor — UI Typography Design Report

**Prepared by:** Senior UI/UX Design Review  
**Date:** June 2026  
**App:** TaskMentor — AI-powered Assessments, Quizzes, Exams & Report Cards

---

## 1. Current Font Audit

### What the App Uses Today

| Surface | Font Stack | Status |
|---|---|---|
| Logo text | `'Inter', 'Segoe UI', sans-serif` (inline style) | ⚠️ Inter not loaded — falls back to Segoe UI |
| Body / UI | Tailwind default: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...` | ⚠️ OS-dependent, inconsistent |
| Code editors | `monospace` / `system-ui` | ⚠️ No dedicated code font |
| Headings | Tailwind utilities (`font-black`, `font-bold`) on the same default stack | ⚠️ No typographic hierarchy font |
| Base size | `14px` (set in `index.css`) | ✅ Intentionally compact |

### Key Problems Identified

- **No font is actually imported.** The app references `Inter` in Logo.tsx but never loads it via Google Fonts or a local `@font-face`. Every user sees their OS default font instead.
- **Zero typographic hierarchy system.** There is no heading font vs. body font distinction — only weight utilities (`font-black`, `font-semibold`) applied to the same fallback stack.
- **Inconsistent code font.** Code editors use plain `monospace`, which renders as Courier New on Windows — unprofessional for a platform with coding assessments.
- **No variable font strategy.** The app loads no fonts at all, missing the chance to use a single variable font file for all weights.
- **Tailwind has no `fontFamily` customization.** The `tailwind.config.js` extends nothing for typography, leaving all font decisions to the browser.

---

## 2. App Context & Design Constraints

Before choosing fonts, the design requirements of TaskMentor must be understood:

| Requirement | Detail |
|---|---|
| **User types** | Teachers/Admins (professional, data-dense UX) + Students (approachable, clear) |
| **Primary surfaces** | Dashboards, data tables, forms, grade reports, quiz interfaces, code editors |
| **Brand color** | Blue (`#3b82f6`) — modern, trusted, tech-forward |
| **Theme** | Light + Dark mode (full dark mode support required) |
| **Base font size** | `14px` — compact; chosen fonts must be highly legible at small sizes |
| **Numerics** | Report cards and scores use tabular numbers — font must support `font-variant-numeric: tabular-nums` |
| **Code surfaces** | In-browser code editors for CSS, JS, Python, HTML assessments |
| **Performance** | SaaS app — font loading must not block render or cause layout shift |

---

## 3. Design Inspiration & Industry Benchmarks

### What Leading Platforms Use

| Platform | Font Strategy | Why |
|---|---|---|
| **Notion** | Inter (all weights) | Neutral, text-heavy workspace, zero distraction |
| **Linear** | Graphik + Source Code Pro | Minimal, technical clarity |
| **Duolingo** | Custom rounded display + DIN Next Rounded | Personality + approachability for students |
| **Khan Academy** | Fredoka + Linotte | Friendly, inclusive, accessible |
| **Coursera** | Source Sans 3 | Professional, academic, serious |
| **Canvas LMS** | Accessibility-first stack | Readability above all |
| **Google Classroom** | Google Sans / Roboto | Familiar, trusted, institutional |

### Key 2025–2026 Trends for EdTech SaaS

1. **Geometric humanist sans-serifs dominate** — fonts like Plus Jakarta Sans, Outfit, and Manrope are replacing Roboto/Lato as the default for modern SaaS.
2. **Variable fonts are the standard** — one file covers all weights, eliminating render-blocking multi-file font loads.
3. **Single-family systems win** — using one versatile family (vs. heading + body pairings) reduces cognitive complexity and load time.
4. **Tabular numeral support is non-negotiable** — for apps with scores, percentages, and grade tables.
5. **Dedicated code fonts are expected** — especially on platforms with coding assessments. JetBrains Mono has become the developer standard.

---

## 4. Font Recommendations

### Option A — Recommended: Plus Jakarta Sans + JetBrains Mono

**Best fit for TaskMentor.** Confident, modern, and professional enough for educators while remaining warm and approachable for students.

#### Plus Jakarta Sans (Primary UI Font)

| Property | Detail |
|---|---|
| **Google Fonts URL** | `https://fonts.google.com/specimen/Plus+Jakarta+Sans` |
| **Type** | Variable font (single file) |
| **Weights to load** | 400, 500, 600, 700, 800 |
| **x-height** | Tall — excellent readability at `14px` |
| **Numerics** | Full tabular numeral support |
| **Character** | Geometric, confident, fresh — 60% Inter with more personality |
| **Dark mode** | Excellent — retains clarity at light-on-dark |

**Why Plus Jakarta Sans over Inter for TaskMentor:**
- Inter is ubiquitous — it no longer signals design investment. Plus Jakarta Sans is distinct without being experimental.
- The slightly wider proportions work better for button labels and badge text at the app's `14px` base.
- The geometric construction matches the blue brand color perfectly — both signal precision and modernity.
- Increasingly the go-to choice for Series A/B startups and modern SaaS products in 2025–2026.

**Usage mapping:**

| Element | Weight | Size |
|---|---|---|
| Hero headings (`h1`) | 800 ExtraBold | `text-3xl` / `text-4xl` |
| Section headings (`h2`) | 700 Bold | `text-2xl` |
| Card titles (`h3`) | 700 Bold | `text-xl` / `text-lg` |
| Subheadings (`h4`) | 600 SemiBold | `text-base` |
| Body text | 400 Regular | `text-sm` / `text-base` |
| Labels & captions | 500 Medium | `text-xs` / `text-sm` |
| Buttons | 600 SemiBold | `text-sm` |
| Badge / chip text | 700 Bold | `text-xs` |
| Table data (numeric) | 500 Medium + tabular | `text-sm` |

#### JetBrains Mono (Code Font)

| Property | Detail |
|---|---|
| **Google Fonts URL** | `https://fonts.google.com/specimen/JetBrains+Mono` |
| **Type** | Variable font |
| **Weights to load** | 400, 500 |
| **Designed for** | Developer tools, code editors |
| **Ligatures** | Optional — `font-feature-settings: "liga" 0` for assessment contexts |
| **Character** | Distinct from monospace defaults — signals quality in code surfaces |

---

### Option B — Conservative: Inter + JetBrains Mono

Best if brand neutrality is a priority (similar to Notion, Linear).

| Font | Role | Google Fonts |
|---|---|---|
| Inter Variable | Primary UI, all surfaces | `fonts.google.com/specimen/Inter` |
| JetBrains Mono | Code editors | `fonts.google.com/specimen/JetBrains+Mono` |

**Trade-off:** Inter is the safe, industry-proven choice. It will never look wrong, but it will also never make the app feel distinct. Given that TaskMentor has an AI-powered identity and competes in a growing EdTech market, Option A is a stronger branding investment.

---

### Option C — Student-Forward: Outfit + JetBrains Mono

Best if student experience takes priority over admin/teacher professionalism.

| Font | Role | Google Fonts |
|---|---|---|
| Outfit Variable | Primary UI, all surfaces | `fonts.google.com/specimen/Outfit` |
| JetBrains Mono | Code editors | `fonts.google.com/specimen/JetBrains+Mono` |

**Trade-off:** Outfit is warmer and more playful than Plus Jakarta Sans. Excellent for student-facing quiz and exam flows. Slightly less authoritative in the admin dashboard and report card contexts.

---

## 5. Implementation Plan

### Step 1 — Load Fonts in `index.html`

Add to the `<head>` of [client/index.html](client/index.html):

```html
<!-- Plus Jakarta Sans (UI) + JetBrains Mono (Code) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

The `display=swap` parameter ensures text remains visible during font load (no flash of invisible text).

---

### Step 2 — Configure Tailwind

Update [client/tailwind.config.js](client/tailwind.config.js):

```js
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      // ... existing keyframes/animations
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
```

This sets Plus Jakarta Sans as the default for all text and JetBrains Mono for all `font-mono` usages (code editors, `CountdownTimer`, etc.).

---

### Step 3 — Add Tabular Numerics in CSS

Add to [client/src/index.css](client/src/index.css) for all numeric display in tables and score/grade surfaces:

```css
@layer base {
  html {
    font-size: 14px;
  }

  /* Tabular numbers for data tables and score displays */
  table,
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
}
```

---

### Step 4 — Update Logo.tsx

Remove the inline `fontFamily` style from [client/src/components/Logo.tsx](client/src/components/Logo.tsx) — Tailwind will now handle it via the `font-sans` default:

```tsx
// Remove this line:
style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}

// The span will inherit font-sans (Plus Jakarta Sans) automatically
```

---

## 6. Visual Impact Summary

| Before | After |
|---|---|
| OS default font (inconsistent per device) | Plus Jakarta Sans — consistent across all devices |
| Inter referenced but never loaded | Inter replaced with a font that actually loads |
| Generic monospace in code editors | JetBrains Mono — purpose-built for code |
| No typographic hierarchy | Clear weight-based hierarchy (400 → 800) |
| Numbers misalign in grade tables | Tabular numerals — columns align perfectly |
| No font character / brand feel | Geometric confidence that matches the blue brand |

---

## 7. Quick Reference — Font Loading Budget

| Font | File Size (WOFF2 variable) | Weights Loaded |
|---|---|---|
| Plus Jakarta Sans | ~42 KB | 400, 500, 600, 700, 800 + italic 400/500 |
| JetBrains Mono | ~28 KB | 400, 500 |
| **Total** | **~70 KB** | — |

This is well within the 100 KB budget for web fonts. Using `rel="preconnect"` and `display=swap` ensures zero render-blocking impact.

---

## 8. Final Verdict

**Recommended combination: Plus Jakarta Sans + JetBrains Mono**

This pairing gives TaskMentor a distinctive, modern identity that signals both professionalism (for educators and admins) and approachability (for students). It is the right step up from the current font-less state, and positions the app visually among the best EdTech SaaS products in the market today.

The implementation is minimal — three files to update — and the improvement in visual polish will be immediately apparent across every screen in the application.
