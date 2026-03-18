# Design Document: Settings Tabbed Sections

## Overview

This design transforms the Settings page from a vertically stacked layout into a tabbed interface. The five existing sections (Master CV, Profile Picture, Certificates, Custom Instructions, Prompts) become tabs in a horizontal tab bar. Only one section is visible at a time, but all component state is preserved across switches via conditional rendering (`display: none` pattern or conditional CSS), not unmounting.

A secondary goal is unifying textarea font styling: all textareas will use `font-mono text-sm`, fixing the Generation Prompts textareas that currently use `text-xs`.

The change is scoped entirely to `src/pages/Settings.tsx` — no new components, routes, or server changes are needed.

## Architecture

### Current Structure

```
Settings Page
├── Header (title + Save Changes button)
├── Master CV section
├── Profile Picture section
├── Certificates section (with manual/import sub-tabs)
├── Custom Instructions section
└── Generation Prompts section (with accordion prompts)
```

### Proposed Structure

```
Settings Page
├── Header (title + Save Changes button)
├── Tab Bar (5 tabs)
└── Tab Content Area
    ├── [visible if active] Master CV section
    ├── [visible if active] Profile Picture section
    ├── [visible if active] Certificates section
    ├── [visible if active] Custom Instructions section
    └── [visible if active] Generation Prompts section
```

### Rendering Strategy

Sections are rendered using conditional rendering with `hidden` class (Tailwind's `display: none`) rather than conditional mounting/unmounting. This ensures:
- React state (unsaved edits, expanded accordions, import progress) is preserved
- No re-mount side effects when switching tabs
- DOM nodes stay alive, so textarea scroll positions and selection states persist

### Tab State Management

A new state variable `activeSection` (type: `SettingsTab`) manages the top-level tab selection. This is distinct from the existing `activeTab` state variable which controls the certificates sub-tabs (manual/import).

```typescript
type SettingsTab = 'master-cv' | 'profile-picture' | 'certificates' | 'custom-instructions' | 'prompts';

const [activeSection, setActiveSection] = useState<SettingsTab>('master-cv');
```

## Components and Interfaces

### Modified Component: `Settings` (`src/pages/Settings.tsx`)

No new components are introduced. The existing `Settings` component is modified in-place.

#### New State

| State Variable | Type | Default | Purpose |
|---|---|---|---|
| `activeSection` | `SettingsTab` | `'master-cv'` | Tracks which top-level tab is active |

#### New Type

```typescript
type SettingsTab = 'master-cv' | 'profile-picture' | 'certificates' | 'custom-instructions' | 'prompts';
```

#### Tab Configuration

```typescript
const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: 'master-cv', label: 'Master CV' },
  { key: 'profile-picture', label: 'Profile Picture' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'custom-instructions', label: 'Custom Instructions' },
  { key: 'prompts', label: 'Prompts' },
];
```

#### Tab Bar Markup Pattern

```tsx
<div className="flex gap-4 border-b border-border">
  {SETTINGS_TABS.map(tab => (
    <button
      key={tab.key}
      onClick={() => setActiveSection(tab.key)}
      className={`pb-2 text-sm font-medium transition-colors ${
        activeSection === tab.key
          ? 'text-text-primary border-b-2 border-accent'
          : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      {tab.label}
    </button>
  ))}
</div>
```

#### Section Visibility Pattern

Each section uses the `hidden` class to toggle visibility:

```tsx
<section className={activeSection !== 'master-cv' ? 'hidden' : ''}>
  {/* Master CV content */}
</section>
<section className={activeSection !== 'profile-picture' ? 'hidden' : ''}>
  {/* Profile Picture content */}
</section>
{/* ... etc */}
```

### Unchanged Components

- `CertificateUpload` — no interface changes
- `CertificatePreview` — no interface changes
- All dialog/toast components — no changes
- Server API — no changes

## Data Models

No data model changes. All existing state shapes, API contracts, and server-side data remain identical.

The only new data is the `SettingsTab` union type and the `SETTINGS_TABS` configuration array, both local to the component.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Exactly one section visible per tab click

*For any* tab in the settings tab bar, when that tab is clicked, exactly one section should be visible (not hidden) and it should correspond to the clicked tab, while all other four sections should be hidden.

This combines the "show new section" (1.3) and "hide old section" (1.4) criteria into a single invariant: the number of visible sections is always exactly 1, and it matches the active tab.

**Validates: Requirements 1.3, 1.4**

### Property 2: Active tab styling is mutually exclusive

*For any* tab in the settings tab bar, when it is the active tab it should have the active styling classes (`text-text-primary`, `border-accent`, `border-b-2`), and when it is inactive it should have the inactive styling classes (`text-text-secondary`, `hover:text-text-primary`). At any point, exactly one tab should have active styling.

This consolidates the visual distinction criteria (1.5), the color variable usage (5.1), and the hover behavior (5.3) into one property.

**Validates: Requirements 1.5, 5.1, 5.3**

### Property 3: Text edits preserved across tab switches

*For any* textarea on the Settings page and any string value entered into it, switching to a different tab and switching back should result in the textarea containing the same value.

This validates that the conditional rendering strategy (using `hidden` rather than unmounting) correctly preserves all form state.

**Validates: Requirements 2.1**

### Property 4: All textareas use unified font style

*For any* textarea rendered on the Settings page, it should have both the `font-mono` and `text-sm` CSS classes applied.

This ensures the Generation Prompts textareas (previously `text-xs`) are updated and all textareas are consistent.

**Validates: Requirements 3.1, 3.2**

## Error Handling

This feature introduces no new error states. The tab switching mechanism is purely client-side UI state with no async operations or failure modes.

Existing error handling remains unchanged:
- Save failures show toast notifications
- Upload failures show toast/alert notifications
- Certificate extraction failures are handled by `CertificateUpload`
- Network timeouts on sync show alert dialogs

The only defensive consideration: if `activeSection` somehow holds an invalid value, all sections would be hidden. This is prevented by the TypeScript union type and the default value of `'master-cv'`.

## Testing Strategy

### Unit Tests

Unit tests cover specific examples and edge cases:

1. **Default tab on load**: Verify "Master CV" tab is active and its section is visible on initial render (validates 1.2)
2. **Tab bar renders all 5 tabs**: Verify the tab bar contains exactly the labels "Master CV", "Profile Picture", "Certificates", "Custom Instructions", "Prompts" (validates 1.1)
3. **Tab bar position in DOM**: Verify the tab bar appears after the header and before section content (validates 5.2)
4. **Certificate import state preservation**: Set up extraction results and sub-tab state, switch away and back, verify state is intact (validates 2.2)
5. **Prompt accordion state preservation**: Expand a prompt editor, switch tabs, switch back, verify it's still expanded (validates 2.3)
6. **Existing save functionality**: Verify "Save Changes" triggers the correct API call (validates 4.1)
7. **Existing upload functionality**: Verify profile image upload works (validates 4.2)
8. **Existing certificate import flow**: Verify extract → preview → save flow (validates 4.3)
9. **Existing prompt save**: Verify prompt save triggers correct API call (validates 4.4)
10. **Existing delete functionality**: Verify certificate/profile image deletion works (validates 4.5)

### Property-Based Tests

Property-based tests use a PBT library (e.g., `fast-check`) with a minimum of 100 iterations per property. Each test is tagged with its design property reference.

1. **Feature: settings-tabbed-sections, Property 1: Exactly one section visible per tab click** — Generate random sequences of tab clicks and verify after each click that exactly one section is visible and matches the clicked tab.

2. **Feature: settings-tabbed-sections, Property 2: Active tab styling is mutually exclusive** — Generate random tab selections and verify the active tab has active classes while all others have inactive classes.

3. **Feature: settings-tabbed-sections, Property 3: Text edits preserved across tab switches** — Generate random text strings and random tab switch sequences, verify textarea values are preserved after round-trip navigation.

4. **Feature: settings-tabbed-sections, Property 4: All textareas use unified font style** — For each tab, activate it and verify all textareas in the DOM have `font-mono` and `text-sm` classes.

### Testing Library

- **Property-based testing**: `fast-check` (JavaScript/TypeScript PBT library)
- **Component testing**: `@testing-library/react` with `vitest`
- **Configuration**: Each property test runs minimum 100 iterations
- Each property test must be tagged: `Feature: settings-tabbed-sections, Property {number}: {property_text}`
- Each correctness property is implemented by a single property-based test
