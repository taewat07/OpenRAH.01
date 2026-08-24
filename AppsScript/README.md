# OpenRAH01 Apps Script deployment

This directory is the copy-ready Google Apps Script package for the native Google Sheet created from `RAH01_Template.xlsx`.

## Install

1. Open the native Google Sheet.
2. Open **Extensions → Apps Script**.
3. Rename the Apps Script project to `OpenRAH01`.
4. Replace the default `Code.gs` with this directory's `Code.gs`.
5. Add the remaining `.gs` files with the exact filenames shown here.
6. Add three HTML files named `Index`, `Styles`, and `Scripts`, then paste the matching `.html` contents.
7. Open **Project Settings**, enable showing `appsscript.json`, and replace its contents with this directory's manifest.
8. Select `setupRah01Production` in the function menu and run it once. Approve the requested Sheet, Drive-file, and identity permissions. Rerunning this function safely adds the configuration panel to older templates.
9. In `Settings`, replace the yellow `H4` value beside `hospital_name` with the hospital's official display name.
10. Review the returned execution log and record the private attachment folder ID.
11. Run `clearBundledSyntheticData` once before accepting real submissions. Its safety guard refuses to run when non-bundled assessment IDs are present.
12. Select **Deploy → New deployment → Web app**. Execute as the deploying hospital administrator and restrict access to the hospital Google Workspace domain.
13. Open the `/exec` URL and confirm the hero subtitle shows the configured hospital name. Complete one controlled test submission, then confirm rows in all six operational sheets plus the private attachment folder.

## Required files

- `Code.gs`
- `Config.gs`
- `Dictionaries.gs`
- `Storage.gs`
- `Submission.gs`
- `Index.html`
- `Styles.html`
- `Scripts.html`
- `appsscript.json`

## Operational rules

- Never share the attachment folder publicly.
- Do not give ordinary form users edit access to the database Sheet.
- Keep the deployment restricted to the hospital domain.
- Add administrators as Sheet editors separately.
- Run a real pilot with non-sensitive test data before hospital rollout.
- The browser payload stays `rah01-submission.v1`; attachment bytes use a separate transport argument.
- `submitRah01Assessment` is retry-safe because the browser request UUID becomes the immutable assessment ID.
- Server code recalculates every risk score and writes department/date/report snapshots into every child row.
