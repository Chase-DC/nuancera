# Agent Instructions

This repository is developed with local-first iteration.

## Release Policy

- Do not create or update GitHub Releases unless the user explicitly asks to publish, release, update releases, or create a new version.
- Do not create or move version tags unless the user explicitly asks for a release.
- Do not bump the app version unless preparing an explicit release.
- During normal development, make changes locally and validate them locally.
- It is acceptable to commit or push source changes to `main` when the user asks to save or sync work, but this must not imply a release.

## Normal Development Flow

1. Modify local source files for the requested feature or fix.
2. Run focused validation, such as i18n checks, app startup checks, or platform builds when relevant.
3. Report what changed and what was verified.
4. Leave GitHub Releases untouched.

## Explicit Release Flow

Only when the user explicitly asks to update GitHub Releases:

1. Confirm the release version.
2. Update version metadata.
3. Build both supported packages when applicable:
   - macOS Apple Silicon `.dmg`
   - Windows x64 `.exe`
4. Create or update the matching version tag.
5. Upload release assets to GitHub Releases.
6. Verify the release asset download links.

## Current Packaging Notes

- App name: Nuancera
- macOS target: Apple Silicon arm64
- Windows target: x64 NSIS installer
- Release assets should be named clearly by product, version, platform, and architecture.
