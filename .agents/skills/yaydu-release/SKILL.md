---
name: yaydu-release
description: Use when classifying a YAYDU implementation task, updating versions or ChangeLog.md, preparing commits or branches/PRs, or verifying a release. Also use for instructions-only maintenance to avoid an application version bump.
---

# YAYDU release workflow

Read [AGENTS.md](../../../AGENTS.md) first and the relevant [architecture boundaries](../../../ARCHITECTURE.md). Do not infer release policy from old changelog entries.

1. Inspect branch/status and requested scope. Preserve unrelated user edits. Classify the whole implementation as PATCH, MINOR or MAJOR; documentation-only maintenance has no application bump.
2. PATCH: commit to the current working branch, no PR. MINOR/MAJOR: create a dedicated branch and PR; never push their implementation straight to `main`. Respect explicit task overrides and repository protections.
3. Check [package.json](../../../package.json), [package-lock.json](../../../package-lock.json), [vite.config.ts](../../../vite.config.ts) and [ChangeLog.md](../../../ChangeLog.md). Increment SemVer only once for the task, synchronizing the package/lock metadata. Web display version is injected from the package; do not edit generated `dist` or hardcode another UI version.
4. Inspect other applicable version references. Native Android `versionCode`/`versionName` and iOS `CURRENT_PROJECT_VERSION`/`MARKETING_VERSION` are currently separate placeholders in [Android Gradle](../../../android/app/build.gradle) and [Xcode project](../../../ios/App/App.xcodeproj/project.pbxproj). Synchronize them only when the task includes a native release; report that boundary rather than inventing an automatic mapping or changing native config for docs work.
5. Add a concise dated release entry describing final behavior and practical limits; retain history. For documentation-only work, change policy text if needed without creating a fictional app release.
6. Select checks with [yaydu-testing](../yaydu-testing/SKILL.md), review the diff with [yaydu-code-review](../yaydu-code-review/SKILL.md), then use a descriptive commit. Follow-up commits within the same task retain the selected version.
7. When pushing/reviewing/releasing is authorized, satisfy required checks and inspect the exact head before merge. A Cloudflare upload/build alone is not production deployment: check the exact merged/production commit and active deployment before reporting it live. Never bypass failed protection checks or expose runtime secrets.

Complete when classification, versions/changelog, focused validation and Git outcome are reported truthfully. If no deployment was requested/performed, do not claim one. Documentation-only changes do not need gameplay tests or a production deployment.
