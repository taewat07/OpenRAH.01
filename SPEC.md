# OpenRAH01 — HTML-aligned implementation specification

## 1. Product definition

OpenRAH01 is an open-source, low-code implementation of the Thai RAH.01 hospital occupational-health assessment. It is designed for one hospital to assess many departments, with the department list controlled by hospital administrators in Google Sheets.

The deployment target is:

```text
RAH.01 HTML form -> Google Apps Script web app -> Google Sheets data store
                                               -> private Google Drive attachments
                                               -> administrator dashboard
```

The project must be deployable without changing form source code. Hospital-specific departments are configured in the `Settings` worksheet.

## 2. Canonical source and compatibility

`rah01-form.html` is the canonical source for form behavior, field names, validation, hazard definitions, scoring, and submission payload shape.

- Submission schema: `rah01-submission.v1`
- Form version: `1.1.0`
- Workbook and Apps Script code must remain compatible with those versions.
- Workbook formulas may derive values, but must not redefine form rules.
- Changes to the HTML payload require a schema-version review and matching workbook migration.

## 3. Assessment flow

The assessment contains five sections.

### 3.1 Assessment details

Required:

- Assessment date
- Department selected from the active `Settings` list
- Total staff count greater than zero

Optional:

- Evaluator name
- Additional evaluators

The submission includes a department snapshot so historical assessments retain the department code and names that existed at submission time.

### 3.2 Occupational-health system checklist

The assessor must answer all 10 items.

Allowed statuses:

- `YES`
- `NO`
- `NOT_APPLICABLE` only for checklist items that allow it

`notApplicableReason` is stored only when status is `NOT_APPLICABLE`.

Checklist item keys:

1. `occ_fire_safety`
2. `occ_health_education`
3. `occ_waste_management`
4. `occ_ppe_measures`
5. `occ_annual_health_exam`
6. `occ_risk_exam_lung`
7. `occ_risk_exam_hearing`
8. `occ_risk_exam_vision`
9. `occ_bio_exam`
10. `occ_env_exam`

### 3.3 Work processes

At least one work step is required. Every step must include:

- Sequential order
- Work step or task
- Primary hazards
- Work duration
- Staff involved count greater than zero

### 3.4 Hazard assessment

The assessor must explicitly answer all 49 predefined hazards across eight categories:

| Category code | Category | Predefined hazards |
|---|---|---:|
| `PHYSICAL` | Physical hazards | 5 |
| `BIOLOGICAL` | Biological hazards | 3 |
| `CHEMICAL` | Chemical hazards | 8 |
| `ERGONOMIC` | Ergonomic hazards | 8 |
| `SAFETY_ACCIDENT` | Safety and accident hazards | 8 |
| `FIRE_DISASTER` | Fire and disaster hazards | 6 |
| `PSYCHOSOCIAL` | Psychosocial hazards | 4 |
| `INDOOR_AIR_QUALITY` | Indoor-air-quality hazards | 7 |

Custom hazards are allowed within any category. A custom hazard is submitted with `hazardKey = OTHER` and a non-empty `customTitle`.

For every hazard marked as present, the assessor must provide:

- Exposed staff count, including zero
- Exposed client count, including zero
- Exposure score A
- Severity score B
- Existing controls; enter `ไม่มี` when no control exists
- Recommendation when calculated score is at least 3

Evidence attachment is optional.

### 3.5 Derived summary

The browser and dashboard derive summaries from submitted hazard evaluations. Risks are sorted from highest score to lowest score. Derived values are never accepted as authoritative client input by the backend.

## 4. Risk scoring contract

Exposure and severity are integers from 1 through 3.

```text
C = A × B
```

| Score C | Stored level | Thai display | Meaning |
|---:|---|---|---|
| 1–2 | `LOW` | ต่ำ | Low/acceptable risk |
| 3–4 | `MEDIUM` | ปานกลาง | Medium risk |
| 6–9 | `HIGH` | สูง | High/unacceptable risk |

Score 5 cannot occur with valid A and B values. Blank or invalid A/B values must produce a blank score and blank level, never a misleading classification.

The Apps Script backend validates A and B and recalculates C and its level before writing data. It never trusts a browser-supplied derived score.

## 5. Draft and submission behavior

- Preview drafts are stored in browser `sessionStorage` under `rah01:preview:draft:1.1.0`.
- Draft attachment storage contains metadata only; file bytes are not persisted by `sessionStorage`.
- A draft is limited to the current browser session.
- Review-ready payloads use `rah01:preview:review:1.1.0` and emit `rah01:ready-for-review`.
- Final persistence and Drive upload are responsibilities of the Apps Script backend.

## 6. Submission payload contract

The canonical payload is:

```text
schemaVersion: "rah01-submission.v1"
formVersion: "1.1.0"
header
  assessmentDate: YYYY-MM-DD
  departmentId: string
  departmentSnapshot
    code: string
    nameTh: string
    nameEn: string
  evaluatorName: string
  totalStaffCount: positive integer
  additionalEvaluators: string
checklist[]
  itemKey: string
  status: YES | NO | NOT_APPLICABLE
  notApplicableReason: string | null
workSteps[]
  order: positive integer
  workStep: string
  primaryHazards: string
  workDuration: string
  staffInvolvedCount: positive integer
hazardEvaluations[]
  categoryCode: category code
  hazardKey: predefined key | OTHER
  customTitle: string | null
  hasRisk: true
  exposedStaffCount: non-negative integer
  exposedClientCount: non-negative integer
  exposureScoreA: 1 | 2 | 3
  severityScoreB: 1 | 2 | 3
  existingControls: string
  recommendation: string
  evidenceAttachment
    name: string
    mimeType: string
    sizeBytes: non-negative integer
    lastModified: non-negative integer
```

Only hazards marked as present appear in `hazardEvaluations`; completion of all 49 answers is enforced by browser validation before review.

## 7. Google Sheets data contract

Row 3 contains machine-readable column names. Data begins on row 4. Every operational table is ordered for human review: immutable department name, assessment date, and report number appear first; machine keys appear at the far right.

The three review columns are denormalized submission snapshots. The Apps Script backend copies them from the accepted parent assessment into every child row at write time. They never use live `Settings` formulas or lookups because later department renaming must not rewrite historical records. IDs remain stable strings generated by the backend and remain authoritative for joins.

### 7.1 `Assessments`

One row per submission:

```text
department_name, assessment_date, status, evaluator_name,
additional_evaluators, total_staff_count, overall_risk_score,
overall_risk_level, report_number, submitted_at, department_code,
department_id, assessment_id, schema_version, form_version
```

Allowed workflow statuses are `SUBMITTED`, `IN_REVIEW`, `RETURNED`, and `CLOSED`. Overall risk is the maximum valid hazard score within the assessment; an assessment with no submitted risk rows has blank overall score and level.

### 7.2 `Checklist`

One row per checklist response:

```text
department_name, assessment_date, report_number, item_order,
item_label_en, status, not_applicable_reason, item_key,
assessment_id, checklist_response_id
```

`item_label_en` is copied from the canonical English checklist dictionary in the HTML for the submitted `item_key`.

### 7.3 `WorkSteps`

One row per work step:

```text
department_name, assessment_date, report_number, step_order,
work_step, primary_hazards, work_duration, staff_involved_count,
assessment_id, work_step_id
```

### 7.4 `Hazards`

One row per submitted risk:

```text
department_name, assessment_date, report_number, hazard_order,
category_label_en, hazard_label_en, exposed_staff_count,
exposed_client_count, exposure_score_a, severity_score_b, risk_score_c,
risk_level, existing_controls, recommendation, has_attachment,
category_code, hazard_key, custom_title, has_risk, assessment_id,
hazard_evaluation_id
```

`category_label_en` and standard `hazard_label_en` values come from the canonical HTML dictionaries. For `hazard_key=OTHER`, `hazard_label_en` equals the submitted `custom_title`. `risk_score_c` and `risk_level` are workbook formulas derived from A and B. A and B use whole-number validation from 1 through 3. Version 1 rows use `has_risk=TRUE`; the column is reserved for future explicit negative answers.

### 7.5 `Attachments`

One row per uploaded evidence file:

```text
department_name, assessment_date, report_number, file_name,
mime_type, size_bytes, uploaded_at, drive_url, last_modified,
drive_file_id, assessment_id, hazard_evaluation_id, attachment_id
```

Attachment files must be stored in a private hospital-controlled Drive folder. Spreadsheet rows contain metadata and access references, not file bytes.

### 7.6 `AdminLog`

One immutable row per workflow event:

```text
department_name, assessment_date, report_number, event_at,
event_type, actor, admin_note, assessment_id, log_id
```

### 7.7 `Settings`

The low-code form configuration occupies `G3:H100` as `setting_key, setting_value`. The required `hospital_name` key controls the hospital identity shown in the form hero and browser title. Administrators edit only the yellow `setting_value` cell; code changes are not required. The browser inserts this value as plain text.

The native `tblDepartments` table in `A3:E73` contains one row per department:

```text
department_name, department_code, active, sort_order, department_id
```

Only active departments are returned to the form, ordered by `sort_order` and then code.

### 7.8 `Admin Dashboard`

The dashboard is read-only and formula-driven. It shows assessment totals, workflow counts, high-risk totals, and a visible index sorted by department name and assessment date. Assessment IDs are excluded from the visible index and retained only in hidden helper columns. High risk begins at score 6; no dashboard threshold may exceed the valid maximum score of 9.

## 8. Apps Script implementation

The copy-ready bound-script package is in `AppsScript/`. `Index.html`, `Styles.html`, and `Scripts.html` are generated from the canonical `rah01-form.html` and its local assets by `SafeCode/build_apps_script_package.mjs`; the canonical form and `rah01-submission.v1` payload remain unchanged. Attachment bytes travel as a separate RPC argument and therefore do not alter the payload schema.

The backend must:

- Return the configured `hospital_name` and active department catalog to the form.
- Authenticate and authorize hospital users according to deployment policy.
- Validate the complete payload server-side.
- Generate stable assessment, child-row, report, attachment, and log IDs.
- Resolve canonical English checklist, hazard-category, and standard-hazard labels from the same dictionaries used by the HTML.
- Copy the accepted parent `department_name`, `assessment_date`, and `report_number` snapshots into every checklist, work-step, hazard, attachment, and admin-log row; never derive historical display fields from live Settings lookups.
- Recalculate risk scores and overall risk.
- Write one assessment and its child rows under a script lock to prevent interleaving.
- Make repeated submission requests idempotent.
- Retain a browser request UUID only while its outcome is uncertain; retire it after a successful response so the same user can submit another assessment.
- Upload attachment bytes to private Drive storage and record metadata.
- Append audit events for submission and every administrative status change.
- Return structured success or error responses without exposing spreadsheet or Drive internals.
- Neutralize formula-like text before every Sheet write so submitted text cannot execute as a spreadsheet formula.

## 9. Template and sample-data rules

- `RAH01_Template.xlsx` mirrors this specification and the canonical HTML payload.
- Bundled synthetic rows must contain no `DEMO` prefix or marker in review data.
- All sample A/B values must be between 1 and 3.
- Sample scores and levels must be formula-derived.
- Production deployment instructions must require removal or archival of sample transactional rows.
- Settings may be edited without source-code changes.

## 10. Acceptance criteria

- The workbook contains exactly eight sheets in this order: `01 assessment`, `02 OH system`, `03 work process`, `04 Hazards`, `Attachments`, `AdminLog`, `Settings`, and `Admin Dashboard`.
- Every payload field has a documented storage location.
- `1×1=1 LOW`, `1×3=3 MEDIUM`, `2×3=6 HIGH`, and `3×3=9 HIGH`.
- Blank or invalid A/B values do not produce a risk level.
- Dashboard high-risk logic uses score 6 through 9.
- Dashboard counts reconcile to the table-backed operational data.
- Every child row directly exposes its immutable department name, assessment date, and report number and matches its parent assessment.
- Human-readable English checklist, hazard-category, and hazard labels are present while technical IDs remain at the far right.
- A normal hazard, custom hazard, checklist N/A reason, and attachment can be represented without losing payload data.
- Workbook formulas contain no `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, or circular references.
- All sheets remain readable in Excel and after import into Google Sheets.
