# YAYDU repository instructions

## Permanent versioning and Git workflow

Apply these rules automatically to all future YAYDU development tasks without requiring reminders. Preserve all other repository instructions. These rules replace the earlier patch-only versioning policy described in `ChangeLog.md`; retain historical release entries.

### Classify each task

Automatically classify the complete task by its highest-impact change:

| Classification | Scope | Version increment | Git workflow |
| --- | --- | --- | --- |
| **PATCH — small changes** | Bug fixes, styling adjustments, and minor improvements. | Increment PATCH only: `1.2.3 → 1.2.4`. | Commit directly to the current working branch. Do not create a PR. |
| **MINOR — medium changes** | New features, moderate functionality changes, and significant UI improvements. | Increment MINOR and reset PATCH: `1.2.3 → 1.3.0`. | Create a dedicated branch and a PR. |
| **MAJOR — major upgrades** | Major redesigns, architectural changes, breaking changes, and substantial upgrades. | Increment MAJOR and reset MINOR and PATCH: `1.2.3 → 2.0.0`. | Create a dedicated branch and a PR. |

### General rules

- Update all relevant version references and `ChangeLog.md` for the task's release.
- Use descriptive commit messages that explain the change.
- Never bump the version more than once per task. Follow-up fixes, validation, and additional commits within the same task use that task's version.
- Never push MINOR or MAJOR changes directly to `main`; use their dedicated branch and PR.
- Follow this workflow by default unless the user explicitly overrides it for a task.
