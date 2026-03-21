# CVForge Design Revamp Specification

> **Status**: Architectural Design Document  
> **Target**: Premium SaaS aesthetic (Linear, Notion, Vercel)  
> **Scope**: Frontend visual redesign only — preserve all functionality

---

## 1. Design Token System (Preserved)

### 1.1 CSS Custom Properties (DO NOT MODIFY)

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--cv-bg-base` | `#f5f3ef` | `#161514` | Page background |
| `--cv-bg-surface` | `#ffffff` | `#1c1b19` | Card backgrounds |
| `--cv-bg-elevated` | `#edeae4` | `#232220` | Input backgrounds, hover states |
| `--cv-border` | `#d6d1c7` | `#302e29` | All borders |
| `--cv-text-primary` | `#1a1917` | `#f0ede8` | Headings, body text |
| `--cv-text-secondary` | `#6b6358` | `#8a8070` | Labels, descriptions |
| `--cv-text-muted` | `#a09888` | `#5a5347` | Placeholders, metadata |
| `--cv-accent` | `#b8892e` | `#d4a847` | Primary actions, focus states |
| `--cv-sidebar-bg` | `#1a1917` | `#111110` | Sidebar background |

### 1.2 Tailwind Theme Mappings (Use These)

```
Colors:  bg-base, bg-surface, bg-elevated, border, text-primary, text-secondary,
         text-muted, accent, accent-hover, success, warning, destructive,
         status-generated, status-applied, status-interview, status-offer,
         status-rejected, status-withdrawn

Fonts:   font-sans (DM Sans), font-serif (DM Serif Display), font-mono (IBM Plex Mono)

Effects: surface-card, sidebar-gradient, main-content-gradient,
         thead-gradient, inset-surface, flash-highlight, page-fade-in, animate-dots
```

---

## 2. Layout Architecture

### 2.1 Global Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         ROOT (flex h-screen)                    │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│   SIDEBAR    │              MAIN CONTENT                        │
│   w-[200px]  │              flex-1 overflow-auto                │
│              │              main-content-gradient              │
│   Fixed      │                                                  │
│   Gradient   │              ┌──────────────────────────────┐     │
│              │              │  max-w-6xl mx-auto p-8      │     │
│   - Logo     │              │  page-fade-in               │     │
│   - Nav      │              │                              │     │
│   - Theme    │              │  <Page Content />            │     │
│              │              │                              │     │
│              │              └──────────────────────────────┘     │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

### 2.2 Mobile Responsiveness Strategy

| Breakpoint | Sidebar Behavior | Content Behavior |
|------------|------------------|------------------|
| `md` and below | Hidden, hamburger drawer | Full width, stacked |
| `lg` and above | Fixed 200px sidebar | Fluid, max-w-6xl centered |

---

## 3. Page-by-Page Layout Recommendations

### 3.1 Dashboard (Applications List)

**Layout Rationale**:  
The dashboard is a data-dense listing page requiring quick scanning and action. Inspired by Linear's issue list, we use a clean table with clear visual hierarchy. The search/filter bar sits above the table for immediate access.

**Current State Issues**:
- Plain table without visual separation between rows
- Toolbar buttons use uppercase mono which feels dated
- No clear visual grouping of actions
- Status badges could be more polished

**Proposed Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│  PAGE HEADER (flex justify-between items-end pb-6)              │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐ │
│  │ h1: Applications            │  │ [New Application] CTA    │ │
│  │ p: Track your generated CVs │  │ bg-accent               │ │
│  └─────────────────────────────┘  └──────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  TOOLBAR (flex gap-3 items-center mb-6)                        │
│  ┌─────────────────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐  │
│  │ [Search Input]      │ │Filter│ │Backup│ │Export│ │Restore│  │
│  │ max-w-xs           │ │     │ │     │ │  PDF │ │      │  │
│  └─────────────────────┘ └──────┘ └──────┘ └──────┘ └───────┘  │
├─────────────────────────────────────────────────────────────────┤
│  TABLE CONTAINER (surface-card border border-border)           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ thead-gradient                                            ││
│  │ Company │ Role │ Status │ Lang │ Date │ Actions            ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Row hover: bg-bg-elevated/50                              ││
│  │ ...                                                       ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  PAGINATION (flex justify-between items-center)                │
│  Showing 1-10 of 50 applications    [Prev] 1 / 5 [Next]        │
└─────────────────────────────────────────────────────────────────┘
```

**Specific Changes**:
1. **Search Input**: Use `bg-elevated` background with `rounded-md`, not bottom-border only
2. **Toolbar Buttons**: Keep mono but reduce visual weight, use `rounded-md` instead of bare
3. **Table Rows**: Add subtle left border accent on hover, better spacing
4. **Status Badges**: Use pill shape with `color-mix()` for background
5. **Actions**: Always visible (not group-hover), use icon buttons with tooltips
6. **Empty State**: Move to centered card, add subtle illustration

---

### 3.2 New Application

**Layout Rationale**:  
A form-centric page for CV generation. The key insight is that CV generation is a **workflow**, not just data entry. The form should feel guided and the progress should be clearly visible. Inspired by multi-step wizards in Notion.

**Current State Issues**:
- Single large form feels overwhelming
- Progress indicator is inside a card, disconnected from header
- Language toggle uses bare button group

**Proposed Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│  PAGE HEADER                                                    │
│  ┌─────────────────────────────┐                               │
│  │ h1: New Application          │                               │
│  │ p: Generate a tailored CV...  │                               │
│  └─────────────────────────────┘                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ PROGRESS STEPper (horizontal, 3 steps)                  │    │
│  │                                                         │    │
│  │  [1] Job Details  ───  [2] Description  ───  [3] Refine │    │
│  │      ○                    ○                     ○        │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ FORM CARD (surface-card)                                 │    │
│  │                                                         │    │
│  │  Company Name  │  Job Title                             │    │
│  │  [──────────]  │  [──────────]                           │    │
│  │                                                         │    │
│  │  Job Description                                        │    │
│  │  [────────────────────────────────────────────]         │    │
│  │  [────────────────────────────────────────────]         │    │
│  │                                                         │    │
│  │  Target Language:  [EN] [DE]                           │    │
│  │                                                         │    │
│  │  Additional Context (optional)                          │    │
│  │  [────────────────────────────────────────────]         │    │
│  │                                                         │    │
│  │  ─────────────────────────────────────────────          │    │
│  │  [Load Last]                                [Generate CV] │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ════════════════════════════════════════════════════════════   │
│  LOADING STATE (when generating)                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [Spinner]  Forging CV    [00:00]                       │    │
│  │                                                         │    │
│  │  ┌───────────────────────────────────────────────────┐  │    │
│  │  │ ████████████████████░░░░░░░░░░░░░  65% (5.2k)     │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  │                                                         │    │
│  │  "Generating LaTeX..."                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Specific Changes**:
1. **Stepper UI**: Add visual step indicator even if single-page for now
2. **Form Card**: Clearer visual containment with `surface-card`
3. **Language Toggle**: Use segmented control style with `rounded-md` and better spacing
4. **Progress Bar**: Thicker, rounded, smoother animation
5. **Loading State**: Full-card overlay with clearer phase transitions

---

### 3.3 Application Detail

**Layout Rationale**:  
This is a detail/edit page with multiple sections. The layout should balance **viewing** (job description, LaTeX) with **editing** (status, notes). A 2-column layout works best: primary content on left, metadata/actions on right.

**Current State Issues**:
- 3-column grid feels cramped
- Sections use generic card styling without hierarchy
- LaTeX editor feels tacked on as expandable
- Status buttons use full-width wrapping which is wasteful

**Proposed Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│  BREADCRUMB NAV                                                │
│  [← Back]  ·  [View Parent]                                    │
├─────────────────────────────────────────────────────────────────┤
│  PAGE HEADER (flex justify-between items-start)               │
│  ┌─────────────────────────────┐  ┌────────────────────────┐ │
│  │ h1: Company Name            │  │ [.tex]  [PDF Download]  │ │
│  │ p: Job Title               │  │                          │ │
│  └─────────────────────────────┘  └────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  CONTENT GRID (grid grid-cols-1 lg:grid-cols-3 gap-6)          │
│  ┌───────────────────────────────┐  ┌──────────────────────┐  │
│  │ LEFT COLUMN (lg:col-span-2)   │  │ RIGHT COLUMN          │  │
│  │                               │  │                       │  │
│  │ ┌───────────────────────────┐ │  │ ┌──────────────────┐ │  │
│  │ │ JOB DESCRIPTION           │ │  │ │ STATUS           │ │  │
│  │ │ (surface-card)            │ │  │ │ (surface-card)   │ │  │
│  │ │                           │ │  │ │                  │ │  │
│  │ │ Full content              │ │  │ │ [GEN][APP][INT]  │ │  │
│  │ │                           │ │  │ │ [OFF][REJ][WTH]  │ │  │
│  │ └───────────────────────────┘ │  │ │                  │ │  │
│  │                               │  │ │ Notes:           │ │  │
│  │ ┌───────────────────────────┐ │  │ │ [─────────────]  │ │  │
│  │ │ GENERATION LOG            │ │  │ │                  │ │  │
│  │ │ (expandable details)      │ │  │ │ [Save Changes]   │ │  │
│  │ └───────────────────────────┘ │  │ └──────────────────┘ │  │
│  │                               │  │                       │  │
│  │ ┌───────────────────────────┐ │  │ ┌──────────────────┐ │  │
│  │ │ LATEX SOURCE              │ │  │ │ DETAILS          │ │  │
│  │ │ (expandable, sticky)      │ │  │ │ (surface-card)   │ │  │
│  │ │                           │ │  │ │                  │ │  │
│  │ │ [Editor]                 │ │  │ │ Created: date    │ │  │
│  │ │ [Save] [Saved indicator] │ │  │ │ Language: EN     │ │  │
│  │ └───────────────────────────┘ │  │ │ PDF: Yes/No      │ │  │
│  │                               │  │ └──────────────────┘ │  │
│  └───────────────────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Specific Changes**:
1. **Grid**: Use `grid-cols-1 lg:grid-cols-3` for responsive 2:1 ratio
2. **Section Cards**: Consistent `surface-card` with clear headers
3. **Status Buttons**: Grid of small buttons, more compact
4. **LaTeX Editor**: Fixed height with internal scroll
5. **Details Card**: Compact key-value pairs with monospace values

---

### 3.4 Settings

**Layout Rationale**:  
Settings pages need clear navigation between sections. The current tab implementation works but lacks visual polish. We should add a **sidebar navigation** pattern within the settings page for clear section switching.

**Current State Issues**:
- Horizontal tabs take too much horizontal space
- Single-column layout wastes horizontal space on large screens
- No visual indication of active section

**Proposed Layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│  PAGE HEADER                                                   │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐ │
│  │ h1: Settings               │  │ [Save Changes] CTA       │ │
│  │ p: Manage your preferences │  │                          │ │
│  └─────────────────────────────┘  └──────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  SETTINGS LAYOUT (flex gap-8)                                  │
│  ┌────────────────┐  ┌─────────────────────────────────────┐    │
│  │ SECTION NAV    │  │ CONTENT AREA                        │    │
│  │ (w-48 shrink)  │  │ (flex-1)                            │    │
│  │                │  │                                      │    │
│  │ • Master CV    │  │ ┌─────────────────────────────────┐ │    │
│  │ • Profile      │  │ │ Active Section Content          │ │    │
│  │ • Certificates │  │ │ (surface-card)                   │ │    │
│  │ • Prompts      │  │ │                                  │ │    │
│  │                │  │ │                                   │ │    │
│  └────────────────┘  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Specific Changes**:
1. **Vertical Navigation**: Left sidebar with clear active state
2. **Section Cards**: Full content area use `surface-card`
3. **Tab Content**: Sub-tabs become secondary nav
4. **Action Buttons**: Sticky or clearly positioned at top-right

---

## 4. Component Redesign Specifications

### 4.1 Buttons

**Requirements**:
- All buttons: `rounded-[8px]` (8px radius)
- All buttons: min-height 44px for touch targets
- Focus: `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base`

**Variant: Primary**
```
bg-accent hover:bg-accent-hover text-text-on-accent
font-medium px-4 py-2.5
transition-colors active:scale-[0.98]
```

**Variant: Secondary**
```
bg-bg-surface border border-border text-text-primary
hover:bg-bg-elevated hover:border-text-muted
transition-colors active:scale-[0.98]
```

**Variant: Ghost**
```
bg-transparent text-text-secondary
hover:bg-bg-elevated hover:text-text-primary
transition-colors active:scale-[0.98]
```

**Variant: Destructive**
```
bg-transparent border border-destructive text-destructive
hover:bg-destructive-subtle
transition-colors active:scale-[0.98]
```

### 4.2 Status Badges

**Requirements**:
- Pill shape: `rounded-full`
- Background: `color-mix(in srgb, <status-color> 12%, transparent)`
- Text: `text-<status-color>`
- Padding: `px-2.5 py-1`
- Font: `font-mono text-[11px] uppercase tracking-wider`

### 4.3 Form Inputs & Textareas

**Requirements**:
- Background: `bg-bg-elevated`
- Border: `border border-border`
- Border Radius: `rounded-md`
- Focus: `focus:outline-none focus:ring-2 focus:ring-accent focus:ring-opacity-40`
- Padding: `px-4 py-3`
- Placeholder: `text-text-muted`
- Error State: `border-destructive focus:ring-destructive`

### 4.4 Dialogs

**Requirements**:
- Backdrop: `bg-overlay backdrop-blur-sm`
- Container: `bg-bg-surface border border-border rounded-lg shadow-2xl`
- Width: `max-w-md w-full`
- Animation: `animate-in zoom-in-95 fade-in duration-200`

### 4.5 Progress Bar (SSE Generation)

**Requirements**:
- Track: `bg-bg-elevated rounded-full h-2 overflow-hidden`
- Fill: `bg-accent rounded-full transition-all duration-700 ease-out`

---

## 5. Typography System

### 5.1 Scale & Usage

| Element | Class | Size | Weight | Color |
|---------|-------|------|--------|-------|
| Page Title | `font-serif text-[2.5rem]` | 40px | 400 | `text-text-primary` |
| Section Heading | `font-semibold text-lg` | 18px | 600 | `text-text-primary` |
| Subsection | `font-medium text-base` | 16px | 500 | `text-text-primary` |
| Body Text | `text-sm` | 14px | 400 | `text-text-primary` |
| Labels | `text-sm font-medium` | 14px | 500 | `text-text-secondary` |
| Metadata | `font-mono text-xs` | 12px | 400 | `text-text-muted` |
| Table Header | `font-mono text-[11px] uppercase tracking-wider` | 11px | 400 | `text-text-secondary` |

---

## 6. Micro-Interactions

### 6.1 Existing (Preserve)

| Animation | Usage | Duration |
|-----------|-------|----------|
| `page-fade-in` | Route transitions | 150ms |
| `flash-highlight` | New application highlight | 1s ×3 |
| `animate-dots` | Loading text | 1.2s loop |
| `grow` | Progress bar | 2s forwards |

### 6.2 New Additions

```css
/* Button press effect */
.active\:scale-\[0\.98\]:active {
  transform: scale(0.98);
}

/* Table row hover */
.hover\:bg-bg-elevated\/50:hover {
  background-color: color-mix(in srgb, var(--cv-bg-elevated) 50%, transparent);
}
```

---

## 7. Mobile Responsiveness

### 7.1 Sidebar Drawer
- Below `md` breakpoint: Hidden, hamburger button triggers drawer overlay
- Drawer: Fixed position, 200px width, slides in from left

### 7.2 Dashboard Table Responsive

| Screen | Columns Shown | Columns Hidden |
|--------|---------------|----------------|
| `sm` and below | Company, Status, Actions | Role, Language, Date |
| `md` and above | All columns | — |

---

## 8. Implementation Priority

### Phase 1: Foundation
1. Update Button component with variants
2. Update StatusBadge component
3. Update Input/Textarea styles
4. Add new utility classes to `index.css`

### Phase 2: Layout Updates
1. Update Layout component (sidebar + mobile drawer)
2. Update Dashboard table and toolbar
3. Update Settings navigation

### Phase 3: Page Polish
1. Update NewApplication progress UI
2. Update ApplicationDetail grid
3. Update Dialog components

---

## 9. Files to Modify

| File | Changes |
|------|---------|
| `src/index.css` | Add new utility classes, keyframes |
| `src/components/layout/Layout.tsx` | Mobile drawer, sidebar nav polish |
| `src/components/ui/Button.tsx` | New component with variants |
| `src/components/ui/StatusBadge.tsx` | Redesign with color-mix |
| `src/components/ui/Input.tsx` | New styled input component |
| `src/components/dialogs/AlertDialog.tsx` | Polish styling |
| `src/components/dialogs/ConfirmDialog.tsx` | Polish styling |
| `src/pages/Dashboard.tsx` | Table, toolbar, search |
| `src/pages/NewApplication.tsx` | Stepper, form layout |
| `src/pages/ApplicationDetail.tsx` | Grid layout |
| `src/pages/Settings.tsx` | Vertical navigation |

---

## 10. Design References

- **Linear**: Issue list density, status badges, minimal chrome
- **Notion**: Card styling, section organization, clean typography
- **Vercel**: Dashboard layout, progress indicators, dark mode polish

---

*End of Design Specification*
