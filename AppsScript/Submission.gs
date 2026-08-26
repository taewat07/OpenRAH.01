function submitRah01Assessment(payload, requestId, attachmentTransports) {
  var cleanRequestId = validateRequestId_(requestId);
  var assessmentId = 'ASM-' + cleanRequestId;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var existing = findAssessmentById_(assessmentId);
    if (existing) return { ok: true, duplicate: true, assessmentId: assessmentId, reportNumber: existing.report_number };

    var normalized = validateSubmission_(payload, attachmentTransports || []);
    var spreadsheet = getRah01Spreadsheet_();
    validateRah01Workbook_(spreadsheet);
    var now = new Date();
    var reportNumber = nextReportNumber_(readSheetObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.ASSESSMENTS)), now);
    var actor = String(Session.getActiveUser().getEmail() || normalized.header.evaluatorName || 'authenticated-user').trim();
    var context = {
      department_name: normalized.department.name,
      assessment_date: normalized.header.assessmentDate,
      report_number: reportNumber,
      assessment_id: assessmentId
    };
    var appends = [];
    var uploadedFiles = [];
    try {
      var attachmentFolder = normalized.totalAttachmentBytes > 0 ? getRah01AttachmentFolder_() : null;
      var hazardRows = [];
      var attachmentRows = [];
      normalized.hazards.forEach(function (hazard, index) {
        var hazardId = 'HZ-' + cleanRequestId + '-' + String(index + 1).padStart(2, '0');
        var transport = normalized.attachmentTransports[index];
        var file = transport ? saveAttachment_(attachmentFolder, reportNumber, hazardId, hazard.evidenceAttachment, transport) : null;
        if (file) uploadedFiles.push(file);
        hazardRows.push(Object.assign({}, context, {
          hazard_order: index + 1,
          category_label_en: RAH01_CATEGORIES[hazard.categoryCode],
          hazard_label_en: hazard.hazardKey === 'OTHER' ? hazard.customTitle : RAH01_HAZARDS[hazard.hazardKey][1],
          exposed_staff_count: hazard.exposedStaffCount,
          exposed_client_count: hazard.exposedClientCount,
          exposure_score_a: hazard.exposureScoreA,
          severity_score_b: hazard.severityScoreB,
          risk_score_c: hazard.riskScore,
          risk_level: hazard.riskLevel,
          existing_controls: hazard.existingControls,
          recommendation: hazard.recommendation,
          has_attachment: Boolean(file),
          category_code: hazard.categoryCode,
          hazard_key: hazard.hazardKey,
          custom_title: hazard.customTitle || '',
          has_risk: true,
          has_exposure: hazard.hasExposure,
          hazard_evaluation_id: hazardId
        }));
        if (file) attachmentRows.push(Object.assign({}, context, {
          file_name: hazard.evidenceAttachment.name,
          mime_type: hazard.evidenceAttachment.mimeType,
          size_bytes: hazard.evidenceAttachment.sizeBytes,
          uploaded_at: now,
          drive_url: file.getUrl(),
          last_modified: new Date(hazard.evidenceAttachment.lastModified),
          drive_file_id: file.getId(),
          hazard_evaluation_id: hazardId,
          attachment_id: 'ATT-' + cleanRequestId + '-' + String(index + 1).padStart(2, '0')
        }));
      });

      var assessmentRow = Object.assign({}, context, {
        status: 'SUBMITTED',
        evaluator_name: normalized.header.evaluatorName,
        additional_evaluators: normalized.header.additionalEvaluators,
        total_staff_count: normalized.header.totalStaffCount,
        overall_risk_score: normalized.overallRiskScore,
        overall_risk_level: normalized.overallRiskLevel,
        submitted_at: now,
        department_code: normalized.department.code,
        department_id: normalized.department.id,
        schema_version: payload.schemaVersion,
        form_version: payload.formVersion
      });
      var checklistRows = normalized.checklist.map(function (item, index) {
        return Object.assign({}, context, {
          item_order: index + 1,
          item_label_en: RAH01_CHECKLIST[item.itemKey].label,
          status: item.status,
          not_applicable_reason: item.notApplicableReason || '',
          item_key: item.itemKey,
          checklist_response_id: 'CHK-' + cleanRequestId + '-' + String(index + 1).padStart(2, '0')
        });
      });
      var stepRows = normalized.workSteps.map(function (step, index) {
        return Object.assign({}, context, {
          step_order: index + 1,
          work_step: step.workStep,
          primary_hazards: step.primaryHazards,
          work_duration: step.workDuration,
          staff_involved_count: step.staffInvolvedCount,
          work_step_id: 'STEP-' + cleanRequestId + '-' + String(index + 1).padStart(2, '0')
        });
      });
      var logRow = Object.assign({}, context, {
        event_at: now,
        event_type: 'SUBMITTED',
        actor: actor,
        admin_note: 'RAH.01 assessment submitted through the hospital web app.',
        log_id: 'LOG-' + cleanRequestId + '-01'
      });

      appends.push(appendObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.ASSESSMENTS), [assessmentRow]));
      appends.push(appendObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.CHECKLIST), checklistRows));
      appends.push(appendObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.WORK_STEPS), stepRows));
      appends.push(appendObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.HAZARDS), hazardRows));
      appends.push(appendObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.ATTACHMENTS), attachmentRows));
      appends.push(appendObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.ADMIN_LOG), [logRow]));
      SpreadsheetApp.flush();
      refreshRah01Dashboard_();
      return { ok: true, duplicate: false, assessmentId: assessmentId, reportNumber: reportNumber };
    } catch (error) {
      rollbackAppends_(appends);
      uploadedFiles.forEach(function (file) { try { file.setTrashed(true); } catch (ignored) {} });
      throw error;
    }
  } finally {
    lock.releaseLock();
  }
}

function updateRah01AssessmentStatus(assessmentId, status, adminNote) {
  var allowed = ['SUBMITTED', 'IN_REVIEW', 'RETURNED', 'CLOSED'];
  if (allowed.indexOf(status) < 0) throw new Error('Unsupported workflow status.');
  var note = boundedText_(adminNote, 'Admin note', 2000);
  if (!note) throw new Error('Admin note is required for a workflow change.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = getRah01Spreadsheet_();
    var sheet = spreadsheet.getSheetByName(RAH01_SHEETS.ASSESSMENTS);
    var rows = readSheetObjects_(sheet);
    var index = rows.findIndex(function (row) { return String(row.assessment_id) === String(assessmentId); });
    if (index < 0) throw new Error('Assessment not found.');
    var row = rows[index];
    var statusColumn = RAH01_HEADERS[RAH01_SHEETS.ASSESSMENTS].indexOf('status') + 1;
    sheet.getRange(RAH01_DATA_ROW + index, statusColumn).setValue(status);
    appendObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.ADMIN_LOG), [{
      department_name: row.department_name,
      assessment_date: row.assessment_date,
      report_number: row.report_number,
      event_at: new Date(),
      event_type: status,
      actor: String(Session.getActiveUser().getEmail() || 'hospital-admin'),
      admin_note: note,
      assessment_id: row.assessment_id,
      log_id: 'LOG-' + Utilities.getUuid()
    }]);
    refreshRah01Dashboard_();
    return { ok: true, assessmentId: assessmentId, status: status };
  } finally {
    lock.releaseLock();
  }
}

function validateSubmission_(payload, attachmentTransports) {
  if (!payload || typeof payload !== 'object') throw new Error('Submission payload is required.');
  if (payload.schemaVersion !== 'rah01-submission.v1') throw new Error('Unsupported submission schema.');
  if (payload.formVersion !== '1.2.0') throw new Error('Unsupported form version.');
  var header = payload.header || {};
  var departmentId = requiredText_(header.departmentId, 'Department');
  var department = getDepartmentById_(departmentId);
  if (!department) throw new Error('Selected department is not active in Settings.');
  var snapshot = header.departmentSnapshot || {};
  var snapshotName = String(snapshot.nameEn || snapshot.nameTh || '').trim();
  if (String(snapshot.code || '') !== department.code || snapshotName !== department.name) throw new Error('Department snapshot does not match current Settings. Reload the form and submit again.');
  var dateText = requiredText_(header.assessmentDate, 'Assessment date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || Number.isNaN(new Date(dateText + 'T00:00:00Z').getTime())) throw new Error('Assessment date is invalid.');

  var checklist = Array.isArray(payload.checklist) ? payload.checklist : [];
  var checklistKeys = Object.keys(RAH01_CHECKLIST);
  if (checklist.length !== checklistKeys.length) throw new Error('All 10 occupational-health checklist answers are required.');
  var seenChecklist = {};
  checklist = checklist.map(function (item) {
    var key = requiredText_(item.itemKey, 'Checklist item key');
    var definition = RAH01_CHECKLIST[key];
    if (!definition || seenChecklist[key]) throw new Error('Checklist keys must be canonical and unique.');
    seenChecklist[key] = true;
    var status = requiredText_(item.status, 'Checklist status');
    if (['YES', 'NO', 'NOT_APPLICABLE'].indexOf(status) < 0) throw new Error('Checklist status is invalid for ' + key + '.');
    var reason = boundedText_(item.notApplicableReason, 'N/A reason', 1000);
    if (status === 'NOT_APPLICABLE' && (!definition.na || !reason)) throw new Error('NOT_APPLICABLE is not valid without an eligible item and reason.');
    if (status !== 'NOT_APPLICABLE' && reason) throw new Error('N/A reason must be blank for YES or NO.');
    return { itemKey: key, status: status, notApplicableReason: reason };
  });

  var workSteps = Array.isArray(payload.workSteps) ? payload.workSteps : [];
  if (!workSteps.length || workSteps.length > 100) throw new Error('One to 100 work steps are required.');
  workSteps = workSteps.map(function (step, index) {
    if (Number(step.order) !== index + 1) throw new Error('Work-step order must be sequential.');
    return {
      order: index + 1,
      workStep: requiredText_(boundedText_(step.workStep, 'Work step', 2000), 'Work step'),
      primaryHazards: requiredText_(boundedText_(step.primaryHazards, 'Primary hazards', 2000), 'Primary hazards'),
      workDuration: requiredText_(boundedText_(step.workDuration, 'Work duration', 500), 'Work duration'),
      staffInvolvedCount: positiveInteger_(step.staffInvolvedCount, 'Staff involved')
    };
  });

  var hazards = Array.isArray(payload.hazardEvaluations) ? payload.hazardEvaluations : [];
  if (hazards.length > 100) throw new Error('Too many submitted hazards.');
  if (!Array.isArray(attachmentTransports) || attachmentTransports.length !== hazards.length) throw new Error('Attachment transport does not match submitted hazards.');
  var totalAttachmentBytes = 0;
  hazards = hazards.map(function (hazard, index) {
    var categoryCode = requiredText_(hazard.categoryCode, 'Hazard category');
    if (!RAH01_CATEGORIES[categoryCode]) throw new Error('Unknown hazard category: ' + categoryCode);
    var hazardKey = requiredText_(hazard.hazardKey, 'Hazard key');
    var customTitle = boundedText_(hazard.customTitle, 'Custom hazard title', 500);
    if (hazardKey === 'OTHER') {
      if (!customTitle) throw new Error('Custom hazards require a title.');
    } else {
      if (!RAH01_HAZARDS[hazardKey] || RAH01_HAZARDS[hazardKey][0] !== categoryCode || customTitle) throw new Error('Standard hazard key/category is invalid.');
    }
    if (hazard.hasRisk !== true) throw new Error('Version 1 submits only present hazards.');
    if (typeof hazard.hasExposure !== 'boolean') throw new Error('Exposure status is required for each present hazard.');
    var hasExposure = hazard.hasExposure;
    var a = hasExposure ? integerInRange_(hazard.exposureScoreA, 'Exposure score A', 1, 3) : '';
    var b = hasExposure ? integerInRange_(hazard.severityScoreB, 'Severity score B', 1, 3) : '';
    var score = hasExposure ? a * b : '';
    var recommendation = boundedText_(hazard.recommendation, 'Recommendation', 5000);
    var attachment = hazard.evidenceAttachment || null;
    var transport = attachmentTransports[index] || null;
    if (!hasExposure && attachment) throw new Error('Hazards without exposed people cannot include risk evidence.');
    if (attachment) {
      attachment = {
        name: sanitizeFileName_(attachment.name),
        mimeType: requiredText_(boundedText_(attachment.mimeType, 'Attachment MIME type', 150), 'Attachment MIME type'),
        sizeBytes: integerInRange_(attachment.sizeBytes, 'Attachment size', 0, RAH01_MAX_ATTACHMENT_BYTES),
        lastModified: integerInRange_(attachment.lastModified, 'Attachment last modified', 0, Number.MAX_SAFE_INTEGER)
      };
      if (attachment.mimeType.indexOf('image/') !== 0) throw new Error('Hazard evidence must be an image.');
      if (!transport || typeof transport.dataBase64 !== 'string') throw new Error('Attachment file bytes are missing for ' + attachment.name + '.');
      totalAttachmentBytes += attachment.sizeBytes;
    } else if (transport) throw new Error('Unexpected attachment transport at hazard ' + (index + 1) + '.');
    var exposedStaffCount = hasExposure ? nonnegativeInteger_(hazard.exposedStaffCount, 'Exposed staff count') : 0;
    var exposedClientCount = hasExposure ? nonnegativeInteger_(hazard.exposedClientCount, 'Exposed client count') : 0;
    if (hasExposure && exposedStaffCount + exposedClientCount < 1) throw new Error('At least one exposed person is required when exposure is present.');
    return {
      categoryCode: categoryCode,
      hazardKey: hazardKey,
      customTitle: customTitle,
      hasExposure: hasExposure,
      exposedStaffCount: exposedStaffCount,
      exposedClientCount: exposedClientCount,
      exposureScoreA: a,
      severityScoreB: b,
      riskScore: score,
      riskLevel: hasExposure ? riskLevel_(score) : '',
      existingControls: hasExposure ? requiredText_(boundedText_(hazard.existingControls, 'Existing controls', 5000), 'Existing controls') : '',
      recommendation: recommendation,
      evidenceAttachment: attachment
    };
  });
  if (totalAttachmentBytes > RAH01_MAX_TOTAL_ATTACHMENT_BYTES) throw new Error('Combined attachments exceed 15 MB.');

  var riskScores = hazards.filter(function (hazard) { return hazard.hasExposure; }).map(function (hazard) { return hazard.riskScore; });
  var overallRiskScore = riskScores.length ? Math.max.apply(null, riskScores) : '';
  return {
    department: department,
    header: {
      assessmentDate: new Date(dateText + 'T00:00:00Z'),
      evaluatorName: requiredText_(boundedText_(header.evaluatorName, 'Evaluator name', 500), 'Evaluator name'),
      additionalEvaluators: boundedText_(header.additionalEvaluators, 'Additional evaluators', 2000),
      totalStaffCount: positiveInteger_(header.totalStaffCount, 'Total staff count')
    },
    checklist: checklist,
    workSteps: workSteps,
    hazards: hazards,
    attachmentTransports: attachmentTransports,
    totalAttachmentBytes: totalAttachmentBytes,
    overallRiskScore: overallRiskScore,
    overallRiskLevel: overallRiskScore === '' ? '' : riskLevel_(overallRiskScore)
  };
}

function validateRequestId_(requestId) {
  var value = String(requestId || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) throw new Error('Submission request ID is invalid.');
  return value;
}
