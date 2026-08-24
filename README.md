# OpenRAH01

OpenRAH01 is an open-source, low-code implementation of the Thai RAH.01 occupational-health risk assessment for hospitals. Staff complete a guided web form, submissions are stored in Google Sheets through Apps Script, and administrators review results through a department-first dashboard.

## Preview

![OpenRAH01 hospital occupational-health risk assessment form](docs/images/openrah01-form.png)

## Features

- Five-section bilingual RAH.01 assessment form
- Configurable hospital name and department catalog in Google Sheets
- Ready for up to 70 hospital departments
- Repeatable work-process and hazard-assessment rows
- Automatic A × B risk scoring and LOW, MEDIUM, or HIGH classification
- Image evidence uploads to a private Google Drive folder
- Department-first database tables with human-readable labels
- Administrator dashboard, workflow statuses, and audit log
- Idempotent submissions and server-side validation
- No paid backend, external database, or proprietary runtime required

## Architecture

```text
Browser form
    ↓
Google Apps Script web app
    ↓
Google Sheets database + private Google Drive attachments
```

The workbook contains eight tabs:

1. `01 assessment`
2. `02 OH system`
3. `03 work process`
4. `04 Hazards`
5. `Attachments`
6. `AdminLog`
7. `Settings`
8. `Admin Dashboard`

## Deploy

1. Upload `RAH01_Template.xlsx` to Google Drive and open it as a Google Sheet.
2. Open **Extensions → Apps Script**.
3. Copy the files from `AppsScript/` into the bound Apps Script project.
4. Run `setupRah01Production` once and approve the requested permissions.
5. In the `Settings` sheet, replace the yellow `hospital_name` value with the hospital's official name.
6. Review the 70 departments and update their names, codes, status, and order as required.
7. Run `clearBundledSyntheticData` before accepting real submissions.
8. Deploy the Apps Script project as a web app restricted to the hospital's Google Workspace domain.
9. Complete a controlled test submission and verify every operational sheet and the private attachment folder.

Detailed instructions are available in [`AppsScript/README.md`](AppsScript/README.md).

## Low-code administration

Hospital administrators manage the deployment from the `Settings` sheet:

- `Settings!H4` controls the hospital name shown in the form.
- `tblDepartments` controls department names, codes, active status, and display order.
- Historical submissions preserve their submitted department name even if Settings changes later.

No source-code edit is required for these changes.

## Data protection

OpenRAH01 handles occupational-health assessment data. Production deployments must:

- restrict the web app to authorized hospital users;
- keep the database Sheet and attachment folder private;
- avoid entering identifiable patient information;
- assign administrators separately from ordinary form users;
- follow applicable hospital policy and privacy law;
- pilot with non-sensitive test data before rollout.

This project provides software infrastructure, not medical or legal advice.

## Project files

- `rah01-form.html` — canonical local form and preview
- `RAH01_Template.xlsx` — Google Sheets-ready database template
- `AppsScript/` — copy-ready Apps Script backend and packaged web app
- `assets/` — styles, scripts, icons, and section artwork
- `SPEC.md` — data contract and implementation specification

## License

Released under the [MIT License](LICENSE).
