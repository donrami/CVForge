# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- New plan documents for CVForge 8 enhancements, folder structure refactor, orphan folder cleanup, duplicate detection workflow, and folder migration

## [0.0.0] - 2026-03-25

### Added
- **Background CV Generation** - Background job processing for CV generation with status tracking
- **Design Revamp** - Comprehensive design improvements and UI updates
- **Pagination** - Added pagination to Dashboard with 10 items per page
- **JSON Backup/Restore** - Full application data export as JSON with merge logic for restore
- **PDF Export** - Export full application list as formatted PDF table
- **Settings Tabbed Sections** - Organized settings page with tabbed interface
- **Certificate Extraction** - Gemini Vision OCR to extract structured data from PDF certificates
- **LaTeX Sanitizer** - Security sanitization for AI-generated LaTeX output
- **UI Improvements** - Various UI enhancements across the application

### Changed
- **Direct LaTeX Output** - Replaced JSON+Handlebars pipeline with direct LLM-generated LaTeX
- **Documentation** - Updated README and ARCHITECTURE to reflect latest changes

### Fixed
- Removed auth references from documentation to reflect current state
- Various bug fixes and improvements

[unreleased]: https://github.com/your-repo/cvforge/compare/v0.0.0...HEAD
[0.0.0]: https://github.com/your-repo/cvforge/releases/tag/v0.0.0