# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New plan documents for CVForge 8 enhancements, folder structure refactor, orphan folder cleanup, duplicate detection workflow, and folder migration

## [0.0.0] - Recent Changes

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

## [Earlier Versions]

### Added
- Initial project setup with React frontend and Express backend
- Gemini API integration for CV generation
- PostgreSQL database with Prisma ORM
- Docker and Docker Compose support
- Application tracking with status management (Generating → Generated → Applied → Interview → Offer / Rejected / Withdrawn)
- Duplicate detection using string similarity
- Regeneration lineage tracking
- Profile image upload for CVs
- Customizable generator prompt
- Chat assistant for prompt refinement
- Optional password protection via APP_PASSWORD

[unreleased]: https://github.com/your-repo/cvforge/compare/v0.0.0...HEAD
[0.0.0]: https://github.com/your-repo/cvforge/releases/tag/v0.0.0
