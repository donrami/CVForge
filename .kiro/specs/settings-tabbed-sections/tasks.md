# Implementation Plan: Settings Tabbed Sections

## Overview

Transform the Settings page from a vertically stacked layout into a tabbed interface. All changes scoped to `src/pages/Settings.tsx` (plus test files and config). Adds `SettingsTab` type, `SETTINGS_TABS` config, tab bar UI, `hidden`-class section toggling, and unified `font-mono text-sm` on all textareas.

## Tasks

- [x] 1. Add tab type, config, and state to Settings component
  - [x] 1.1 Define `SettingsTab` type and `SETTINGS_TABS` config array, add `activeSection` state
    - Add `type SettingsTab = 'master-cv' | 'profile-picture' | 'certificates' | 'custom-instructions' | 'prompts'` above the component
    - Add `const SETTINGS_TABS: { key: SettingsTab; label: string }[]` with the 5 tab entries
    - Add `const [activeSection, setActiveSection] = useState<SettingsTab>('master-cv')`
    - _Requirements: 1.1, 1.2_

- [x] 2. Render tab bar and wire section visibility
  - [x] 2.1 Add tab bar markup between the header and the content area
    - Render `SETTINGS_TABS.map(...)` as buttons in a `flex gap-4 border-b border-border` container
    - Active: `text-text-primary border-b-2 border-accent`; Inactive: `text-text-secondary hover:text-text-primary`
    - Each button calls `setActiveSection(tab.key)` on click
    - _Requirements: 1.1, 1.3, 1.5, 5.1, 5.2, 5.3_
  - [x] 2.2 Wrap each section with `hidden` class toggle based on `activeSection`
    - Each `<section>` gets `className={activeSection !== '<key>' ? 'hidden' : ''}`
    - All 5 sections remain mounted in the DOM at all times
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3_

- [x] 3. Unify textarea font styling
  - [x] 3.1 Update all textarea `className` props to include `font-mono text-sm`
    - Master CV, Certificates, Custom Instructions: already have `font-mono`, add `text-sm`
    - Generation Prompts textareas: change `text-xs` to `text-sm`
    - _Requirements: 3.1, 3.2_

- [x] 4. Checkpoint — Verify core implementation
  - Ensure all tests pass, ask the user if questions arise.
  - Visually confirm: tab bar renders, clicking tabs shows/hides sections, textareas have consistent font styling.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 5. Set up test infrastructure
  - [ ] 5.1 Install test dependencies and configure vitest
    - Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `fast-check` as dev deps
    - Add vitest config with `jsdom` test environment
    - Add `test` script to `package.json`
    - _Requirements: (testing infrastructure)_

- [ ] 6. Write property-based tests for tab behavior
  - [ ]* 6.1 Write property test: Exactly one section visible per tab click
    - **Property 1: Exactly one section visible per tab click**
    - Generate random sequences of tab clicks with `fast-check`, verify exactly one section is visible and matches the clicked tab
    - **Validates: Requirements 1.3, 1.4**
  - [ ]* 6.2 Write property test: Active tab styling is mutually exclusive
    - **Property 2: Active tab styling is mutually exclusive**
    - Generate random tab selections, verify exactly one tab button has active classes while others have inactive classes
    - **Validates: Requirements 1.5, 5.1, 5.3**
  - [ ]* 6.3 Write property test: Text edits preserved across tab switches
    - **Property 3: Text edits preserved across tab switches**
    - Generate random strings and tab switch sequences, verify textarea values preserved after round-trip
    - **Validates: Requirements 2.1**
  - [ ]* 6.4 Write property test: All textareas use unified font style
    - **Property 4: All textareas use unified font style**
    - For each tab, activate it and verify every textarea has `font-mono` and `text-sm` classes
    - **Validates: Requirements 3.1, 3.2**

- [ ] 7. Write component unit tests
  - [ ]* 7.1 Write unit tests for tab rendering and default state
    - Verify tab bar renders all 5 tab labels
    - Verify "Master CV" is active tab on initial render
    - Verify tab bar positioned between header and content
    - _Requirements: 1.1, 1.2, 5.2_
  - [ ]* 7.2 Write unit tests for state preservation
    - Verify certificate import state preserved across tab switches
    - Verify prompt accordion expanded state preserved across tab switches
    - _Requirements: 2.2, 2.3_
  - [ ]* 7.3 Write unit tests for existing functionality
    - Verify Save Changes, profile upload, certificate import, prompt save, and deletion all work
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All implementation changes scoped to `src/pages/Settings.tsx`
- The `hidden` class (Tailwind `display: none`) preserves React state without unmounting
- Existing `activeTab` state for certificate sub-tabs is unrelated to new `activeSection`
- Property tests use `fast-check` with minimum 100 iterations per property
- Component tests use `@testing-library/react` with `vitest` and `jsdom`
