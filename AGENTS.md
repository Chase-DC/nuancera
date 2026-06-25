# Agent Instructions

This repository is developed with local-first iteration.

## Release Policy

- Do not create or update GitHub Releases unless the user explicitly asks to publish, release, update releases, or create a new version.
- Do not create or move version tags unless the user explicitly asks for a release.
- During local-only iteration, use SemVer prerelease versions based on the latest public release: `0.0.n-local.1`, `0.0.n-local.2`, etc. Do not use four-part versions such as `0.0.n.1` in `package.json`, because electron-builder rejects them.
- Local-only iteration version bumps do not imply a GitHub Release and must not move version tags.
- When the user explicitly asks to update GitHub Releases, promote the release version to the next public version: if the last release is `0.0.n`, publish `0.0.(n+1)`.
- During normal development, make changes locally and validate them locally.
- It is acceptable to commit or push source changes to `main` when the user asks to save or sync work, but this must not imply a release.
- Every local iteration version must have an entry in `CHANGELOG.md`.
- A public release changelog must summarize all local iteration entries since the previous public release.

## Normal Development Flow

1. Determine the latest public release version, such as `0.0.7`.
2. Bump the local-only version to the next suffix version, such as `0.0.7-local.1` or `0.0.7-local.2`.
3. Update version metadata consistently:
   - `package.json`
   - `package-lock.json`
   - `renderer/js/i18n.js`
   - README current version, when it is meant to describe the local build
4. Modify local source files for the requested feature or fix.
5. Add a focused `CHANGELOG.md` entry for the local iteration.
6. Run focused validation, such as i18n checks, app startup checks, or platform builds when relevant.
7. Report what changed and what was verified.
8. Leave GitHub Releases untouched.

## Microsoft Store Build Flow

- The user's main development machine is macOS.
- Do not require a Windows Codex environment for normal Store packaging.
- When the user is satisfied with local changes and asks to build a Store package, sync source changes to GitHub first, but do not update GitHub Releases and do not create a version tag unless explicitly asked.
- Use the manual GitHub Actions workflow `Build Microsoft Store AppX` to build the Store package on `windows-latest`.
- The workflow output artifact is the package to upload to Microsoft Partner Center.
- Treat GitHub Actions as the Windows build machine, not as a release publishing mechanism.
- Microsoft Store package versions must be compatible with Store package version rules. The workflow runs `scripts/prepare-store-version.js` to map local prerelease versions such as `0.0.7-local.1` to three-part package versions such as `0.0.7`; electron-builder writes the Store-compatible AppX identity version as `0.0.7.0`.
- Store packages must patch the generated AppX manifest through `scripts/patch-appx-manifest.js` so `TargetDeviceFamily` uses Windows `MinVersion` and `MaxVersionTested` `10.0.17763.0`. Partner Center rejects MSIX packages targeting `MinVersion <= 10.0.17134.0`.
- Store/AppX tile images must live in `build/appx/` as `StoreLogo.png`, `Square44x44Logo.png`, `Square150x150Logo.png`, and `Wide310x150Logo.png`. If this folder is missing, electron-builder falls back to default `SampleAppx` images and Microsoft Store certification can fail policy `10.1.1.11 On Device Tiles`.
- Electron full-trust desktop packages declare the restricted `runFullTrust` capability. Do not remove it casually; explain it in Partner Center Submission options as required for launching the packaged Nuancera desktop application process.

## Explicit Release Flow

Only when the user explicitly asks to update GitHub Releases:

1. Confirm the previous public release version and the next release version.
2. Promote version metadata from local suffix form to the next public release:
   - `0.0.n-local.x` becomes `0.0.(n+1)`
   - for example, `0.0.7-local.3` becomes `0.0.8`
3. Summarize all local iteration changelog entries since the previous public release into the new public release changelog entry.
4. Build both supported packages when applicable:
   - macOS Apple Silicon `.dmg`
   - Windows x64 `.exe`
5. Create or update the matching version tag.
6. Upload release assets to GitHub Releases.
7. Verify the release asset download links.

## Current Packaging Notes

- App name: Nuancera
- macOS target: Apple Silicon arm64
- macOS DMG builds run `scripts/sign-mac-ad-hoc.js` through the electron-builder `afterPack` hook to sign and verify the full `.app` bundle before DMG packaging. This prevents damaged-app Gatekeeper failures from incomplete ad-hoc signatures. Do not add `--options runtime` to this ad-hoc signature without Electron hardened-runtime entitlements, because V8 can crash at startup with `Failed to reserve virtual memory for CodeRange`. This is not a substitute for Apple Developer ID signing and notarization.
- Windows target: x64 NSIS installer
- Microsoft Store target: x64 AppX built by a manual GitHub Actions workflow on Windows
- Release assets should be named clearly by product, version, platform, and architecture.
