var RAH01_HEADER_ROW = 3;
var RAH01_DATA_ROW = 4;
var RAH01_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
var RAH01_MAX_TOTAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;
var RAH01_DASHBOARD_MIN_REVIEW_ROWS = 150;
var RAH01_DASHBOARD_FIRST_REVIEW_ROW = 24;
var RAH01_DASHBOARD_CHART_FIRST_ROW = 8;
var RAH01_DASHBOARD_CATEGORY_CHART_COLUMN = 1;
var RAH01_DASHBOARD_PROGRESS_CHART_COLUMN = 5;
var RAH01_DASHBOARD_TOP_RISK_CHART_COLUMN = 9;
var RAH01_DASHBOARD_FORMULA_LAST_ROW = 1000;
var RAH01_DASHBOARD_CHART_WIDTH = 430;
var RAH01_DASHBOARD_CHART_HEIGHT = 280;

var RAH01_PROPERTY_KEYS = Object.freeze({
  SPREADSHEET_ID: 'RAH01_SPREADSHEET_ID',
  ATTACHMENT_FOLDER_ID: 'RAH01_ATTACHMENT_FOLDER_ID'
});

var RAH01_SHEETS = Object.freeze({
  ASSESSMENTS: '01 assessment',
  CHECKLIST: '02 OH system',
  WORK_STEPS: '03 work process',
  HAZARDS: '04 Hazards',
  ATTACHMENTS: 'Attachments',
  ADMIN_LOG: 'AdminLog',
  SETTINGS: 'Settings',
  DASHBOARD: 'Admin Dashboard'
});

var RAH01_HEADERS = Object.freeze({
  '01 assessment': ['department_name', 'assessment_date', 'status', 'evaluator_name', 'additional_evaluators', 'total_staff_count', 'overall_risk_score', 'overall_risk_level', 'report_number', 'submitted_at', 'department_code', 'department_id', 'assessment_id', 'schema_version', 'form_version'],
  '02 OH system': ['department_name', 'assessment_date', 'report_number', 'item_order', 'item_label_en', 'status', 'item_key', 'assessment_id', 'checklist_response_id'],
  '03 work process': ['department_name', 'assessment_date', 'report_number', 'step_order', 'work_step', 'primary_hazards', 'work_duration', 'staff_involved_count', 'assessment_id', 'work_step_id'],
  '04 Hazards': ['department_name', 'assessment_date', 'report_number', 'hazard_order', 'category_label_en', 'hazard_label_en', 'exposed_staff_count', 'exposed_client_count', 'exposure_score_a', 'severity_score_b', 'risk_score_c', 'risk_level', 'existing_controls', 'has_attachment', 'category_code', 'hazard_key', 'custom_title', 'has_risk', 'assessment_id', 'hazard_evaluation_id', 'has_exposure'],
  Attachments: ['department_name', 'assessment_date', 'report_number', 'file_name', 'mime_type', 'size_bytes', 'uploaded_at', 'drive_url', 'last_modified', 'drive_file_id', 'assessment_id', 'hazard_evaluation_id', 'attachment_id'],
  AdminLog: ['department_name', 'assessment_date', 'report_number', 'event_at', 'event_type', 'actor', 'admin_note', 'assessment_id', 'log_id'],
  Settings: ['department_name', 'department_code', 'active', 'sort_order', 'department_id']
});

function getRah01FormConfig() {
  var settingsSheet = getRah01Spreadsheet_().getSheetByName(RAH01_SHEETS.SETTINGS);
  var settings = getRah01SettingValues_(settingsSheet);
  var hospitalName = requiredText_(boundedText_(settings.hospital_name, 'Settings hospital_name', 200), 'Settings hospital_name');
  var rows = readSheetObjects_(settingsSheet);
  var ids = {};
  var codes = {};
  var sortOrders = {};
  var normalized = rows.map(function (row) {
    var departmentName = requiredText_(row.department_name, 'Settings department_name');
    var id = requiredText_(row.department_id, 'Settings department_id');
    var code = requiredText_(row.department_code, 'Settings department_code');
    var sortOrder = positiveInteger_(row.sort_order, 'Settings sort_order');
    if (ids[id]) throw new Error('Duplicate department ID: ' + id);
    if (codes[code]) throw new Error('Duplicate department code: ' + code);
    if (sortOrders[sortOrder]) throw new Error('Duplicate department sort_order: ' + sortOrder);
    ids[id] = true;
    codes[code] = true;
    sortOrders[sortOrder] = true;
    return {
      id: id,
      code: code,
      name: departmentName,
      active: settingsBoolean_(row.active, 'Settings active'),
      sortOrder: sortOrder
    };
  });
  var departments = normalized.filter(function (department) {
    return department.active;
  }).sort(function (left, right) {
    return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
  });
  return { schemaVersion: 'rah01-form-config.v1', hospitalName: hospitalName, departments: departments };
}

function getRah01SettingValues_(settingsSheet) {
  var rows = settingsSheet.getRange('G4:H100').getDisplayValues();
  var values = {};
  rows.forEach(function (row) {
    var key = String(row[0] || '').trim();
    if (key) values[key] = String(row[1] || '').trim();
  });
  return values;
}

function getDepartmentById_(departmentId) {
  var departments = getRah01FormConfig().departments;
  for (var index = 0; index < departments.length; index++) if (departments[index].id === departmentId) return departments[index];
  return null;
}
