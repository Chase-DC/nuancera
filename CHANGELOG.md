# Changelog

This project uses two version tracks:

- Public releases use `0.0.n`, for example `0.0.7` and `0.0.8`.
- Local-only iterations use SemVer prerelease suffixes based on the latest public release, for example `0.0.7-local.1`, `0.0.7-local.2`, and `0.0.7-local.3`.

GitHub Releases are updated only when explicitly requested. A public release entry summarizes the local-only iteration entries since the previous public release.

## 0.0.8 - Public release

Summarizes changes since `0.0.7`.

- Added startup update checks against GitHub Releases, including release notes and actions for update now, ignore this version, or remind later.
- Changed app identity and publisher-facing metadata to Duo CAI.
- Added Windows packaging metadata for Duo CAI and current-user install behavior.
- Added Microsoft Store packaging configuration using the Nuancera Partner Center identity.
- Fixed Microsoft Store package manifest generation to use Windows `MinVersion` `10.0.17763.0`, avoiding Partner Center rejection for `MinVersion <= 10.0.17134.0`.
- Fixed macOS DMG generation by ad-hoc signing the full app bundle before packaging, avoiding damaged-app Gatekeeper failures caused by an incomplete bundle signature while keeping Electron's JIT-compatible runtime behavior.
- Added a manual GitHub Actions workflow to build the Microsoft Store package on Windows.
- Updated documentation from macOS-only/offline-only wording to macOS + Windows, local-first, and Store-aware packaging.
- Included the current renderer and PDF extraction improvements from local iteration work.

## 0.0.7-local.1 - Local iteration

- Added startup update checks against GitHub Releases, with release notes and actions for update now, ignore this version, or remind later.
- Changed app identity and publisher-facing metadata from Chase to Duo CAI.
- Added Windows packaging metadata for Duo CAI and current-user install behavior.
- Added Microsoft Store AppX packaging configuration using Partner Center identity values for Nuancera.
- Fixed Store AppX manifest generation so generated packages target Windows `10.0.17763.0` or later.
- Added a manual GitHub Actions workflow to build the Microsoft Store AppX package on Windows.
- Updated README wording from macOS-only/offline-only to macOS + Windows, local-first, and Store-aware packaging.
- Preserved and built against the current local renderer and PDF extraction updates from parallel local iteration work.
