# Changelog

All notable changes to the Elementle mobile app will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Complete Option C implementation (75/125 tasks)
- Query optimization with Supabase joins and batching
- Comprehensive API documentation
- Deployment guide with EAS build configuration
- E2E testing framework (Maestro)
- Contributing guidelines
- 19+ new utility files and components

### Core Features
- Password reset flow with email verification
- OTP verification screen with 6-digit input
- Category selection for USER mode (10 categories)
- Guest mode with full data migration
- Conversion prompts for guest users
- Share functionality with native sheet and emoji grid
- Deep linking support
- App review prompts (iOS/Android)

### Infrastructure
- GuessCacheContext for performance
- Query optimization utilities
- Platform-specific utilities
- Constants centralization
- Shadow system for cards
- Accessibility labels and hints
- Skeleton loading components

### UX Improvements
- Haptic feedback on all interactions
- Sound effects (7 sounds: tap, win, lose, streak, badge, error, success)
- Card shadows and elevation
- Loading skeletons with pulse animation
- Dark mode refinements
- Error boundaries

### Documentation
- API Documentation (complete)
- E2E Testing Guide (Maestro setup)
- Deployment Guide (EAS configuration)
- Final Polish Checklist (app store prep)
- README.md (project overview)
- CONTRIBUTING.md (development guidelines)

### Developer Experience
- 30+ test IDs for E2E testing
- TypeScript strict mode
- Comprehensive error handling
- Request deduplication
- Optimized Supabase queries

## [1.0.0] - TBD

### Initial Release
- Core game functionality (REGION and USER modes)
- Authentication with Supabase
- Stats and streaks tracking
- Archive with calendar view
- Badge system
- Settings and options
- Guest mode
- Dark mode support

### Known Issues
- None at release

---

## Version Guidelines

**Major version (X.0.0):**
- Breaking changes
- Major feature additions
- Significant UI/UX redesigns

**Minor version (0.X.0):**
- New features
- Non-breaking enhancements
- Performance improvements

**Patch version (0.0.X):**
- Bug fixes
- Minor tweaks
- Security updates

## Release Process

1. Update version in `app.json`
2. Update this CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. Build and submit to stores
6. Create GitHub release with notes

## Support

For issues, please file a bug report on GitHub or contact support@elementle.com
