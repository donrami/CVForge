# Requirements Document

## Introduction

The Settings page (`src/pages/Settings.tsx`) currently displays five sections stacked vertically: Master CV, Profile Picture, Certificates & Qualifications, Custom Instructions, and Generation Prompts. This makes the page long and hard to navigate. Additionally, textareas across sections use inconsistent font sizing (`text-xs` in Generation Prompts vs. default size elsewhere).

This feature reorganizes the Settings page into a tabbed layout so only one section is visible at a time, and unifies the font style and size across all textareas.

## Glossary

- **Settings_Page**: The React component at `src/pages/Settings.tsx` that manages user context, certificates, profile image, custom instructions, and generation prompts.
- **Tab_Bar**: A horizontal navigation element that displays clickable tab labels, one per section, allowing the user to switch between sections.
- **Active_Tab**: The currently selected tab whose corresponding section content is visible.
- **Section**: One of the five content areas: Master CV, Profile Picture, Certificates & Qualifications, Custom Instructions, or Generation Prompts.
- **Textarea**: An HTML `<textarea>` element used for editing multi-line text content within a Section.
- **Unified_Font_Style**: A consistent combination of font family (`font-mono`) and font size (`text-sm`) applied to all Textareas on the Settings_Page.

## Requirements

### Requirement 1: Tabbed Section Navigation

**User Story:** As a user, I want the Settings page sections organized into tabs, so that I can focus on one section at a time without scrolling through all of them.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a Tab_Bar containing one tab label for each of the five Sections: "Master CV", "Profile Picture", "Certificates", "Custom Instructions", and "Prompts".
2. WHEN the Settings_Page loads, THE Settings_Page SHALL display the first tab ("Master CV") as the Active_Tab by default.
3. WHEN a user clicks a tab label in the Tab_Bar, THE Settings_Page SHALL display the corresponding Section content and visually indicate the clicked tab as the Active_Tab.
4. WHEN a user clicks a tab label in the Tab_Bar, THE Settings_Page SHALL hide the previously visible Section content.
5. THE Tab_Bar SHALL visually distinguish the Active_Tab from inactive tabs using a bottom border accent color and contrasting text color consistent with the existing application theme.

### Requirement 2: State Preservation Across Tab Switches

**User Story:** As a user, I want my unsaved edits preserved when switching between tabs, so that I don't lose work by navigating to a different section.

#### Acceptance Criteria

1. WHEN a user switches from one tab to another, THE Settings_Page SHALL retain all unsaved text edits in every Section's form fields.
2. WHEN a user switches from one tab to another, THE Settings_Page SHALL retain the state of certificate import operations (extraction results, active sub-tab selection) in the Certificates Section.
3. WHEN a user switches from one tab to another, THE Settings_Page SHALL retain the expanded/collapsed state of individual prompt editors in the Generation Prompts Section.

### Requirement 3: Unified Textarea Font Style

**User Story:** As a user, I want all textareas on the Settings page to use the same font family and size, so that the interface looks consistent and polished.

#### Acceptance Criteria

1. THE Settings_Page SHALL render all Textareas with the Unified_Font_Style (`font-mono text-sm`).
2. THE Settings_Page SHALL apply the Unified_Font_Style to the Master CV textarea, the Certificates textarea, the Custom Instructions textarea, and all Generation Prompts textareas.

### Requirement 4: Existing Functionality Preservation

**User Story:** As a user, I want all existing Settings page functionality to continue working after the redesign, so that nothing breaks.

#### Acceptance Criteria

1. WHEN the user clicks "Save Changes", THE Settings_Page SHALL save the Master CV, Certificates, and Custom Instructions context data to the server.
2. WHEN the user uploads a profile image, THE Settings_Page SHALL upload the image and display the updated preview.
3. WHEN the user imports certificates from PDF, THE Settings_Page SHALL extract, preview, and save certificates to the server.
4. WHEN the user edits and saves generation prompts, THE Settings_Page SHALL persist the updated prompts to the server.
5. WHEN the user deletes a certificate or profile image, THE Settings_Page SHALL remove the item and update the display.

### Requirement 5: Tab Bar Styling Consistency

**User Story:** As a user, I want the tab bar to match the existing dark theme of the application, so that the new UI element feels native.

#### Acceptance Criteria

1. THE Tab_Bar SHALL use the application's existing color variables: `accent` for the active tab indicator, `text-primary` for active tab text, and `text-secondary` for inactive tab text.
2. THE Tab_Bar SHALL be positioned between the page header (title and Save Changes button) and the section content area.
3. WHEN a user hovers over an inactive tab, THE Tab_Bar SHALL change the tab text color to `text-primary` to indicate interactivity.
