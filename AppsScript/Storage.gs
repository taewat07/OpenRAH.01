function getRah01Spreadsheet_() {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = properties.getProperty(RAH01_PROPERTY_KEYS.SPREADSHEET_ID);
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Run setupRah01Production once from the bound Google Sheet.');
  properties.setProperty(RAH01_PROPERTY_KEYS.SPREADSHEET_ID, active.getId());
  return active;
}

function getFolderIfAvailable_(folderId) {
  try { return DriveApp.getFolderById(folderId); } catch (error) { return null; }
}

function getRah01AttachmentFolder_() {
  var folderId = PropertiesService.getScriptProperties().getProperty(RAH01_PROPERTY_KEYS.ATTACHMENT_FOLDER_ID);
  var folder = folderId ? getFolderIfAvailable_(folderId) : null;
  if (!folder) throw new Error('Run setupRah01Production once to configure private attachment storage.');
  return folder;
}

function validateRah01Workbook_(spreadsheet) {
  Object.keys(RAH01_HEADERS).forEach(function (sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error('Missing required sheet: ' + sheetName);
    var expected = RAH01_HEADERS[sheetName];
    var actual = sheet.getRange(RAH01_HEADER_ROW, 1, 1, expected.length).getDisplayValues()[0].map(function (value) { return String(value).trim(); });
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Row 3 headers do not match the contract in ' + sheetName + '.');
  });
  var settingsSheet = spreadsheet.getSheetByName(RAH01_SHEETS.SETTINGS);
  var configHeaders = settingsSheet.getRange('G3:H3').getDisplayValues()[0].map(function (value) { return String(value).trim(); });
  if (JSON.stringify(configHeaders) !== JSON.stringify(['setting_key', 'setting_value'])) throw new Error('Settings G3:H3 must contain setting_key and setting_value.');
  var settings = getRah01SettingValues_(settingsSheet);
  requiredText_(boundedText_(settings.hospital_name, 'Settings hospital_name', 200), 'Settings hospital_name');
  if (!spreadsheet.getSheetByName(RAH01_SHEETS.DASHBOARD)) throw new Error('Missing required sheet: ' + RAH01_SHEETS.DASHBOARD);
  return true;
}

function readSheetObjects_(sheet) {
  var headers = RAH01_HEADERS[sheet.getName()];
  if (!headers) throw new Error('No header contract for sheet ' + sheet.getName());
  var lastRow = sheet.getLastRow();
  if (lastRow < RAH01_DATA_ROW) return [];
  return sheet.getRange(RAH01_DATA_ROW, 1, lastRow - RAH01_DATA_ROW + 1, headers.length).getValues()
    .filter(function (row) { return row.some(function (value) { return value !== '' && value !== null; }); })
    .map(function (row) {
      var result = {};
      headers.forEach(function (header, index) { result[header] = row[index]; });
      return result;
    });
}

function appendObjects_(sheet, objects) {
  if (!objects.length) return null;
  var headers = RAH01_HEADERS[sheet.getName()];
  var startRow = Math.max(RAH01_DATA_ROW, sheet.getLastRow() + 1);
  var rows = objects.map(function (object) {
    return headers.map(function (header) {
      return safeCellValue_(object[header] === undefined ? '' : object[header]);
    });
  });
  sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
  return { sheet: sheet, startRow: startRow, rowCount: rows.length };
}

function rollbackAppends_(appends) {
  appends.slice().reverse().forEach(function (append) {
    if (!append || !append.rowCount) return;
    append.sheet.getRange(append.startRow, 1, append.rowCount, append.sheet.getLastColumn()).clearContent();
  });
}

function findAssessmentById_(assessmentId) {
  var rows = readSheetObjects_(getRah01Spreadsheet_().getSheetByName(RAH01_SHEETS.ASSESSMENTS));
  for (var index = 0; index < rows.length; index++) if (String(rows[index].assessment_id) === assessmentId) return rows[index];
  return null;
}

function nextReportNumber_(assessmentRows, date) {
  var year = Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy');
  var prefix = 'RAH01-' + year + '-';
  var maximum = assessmentRows.reduce(function (max, row) {
    var match = String(row.report_number || '').match(new RegExp('^' + prefix + '(\\d+)$'));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return prefix + String(maximum + 1).padStart(5, '0');
}

function saveAttachment_(rootFolder, reportNumber, hazardId, attachment, fileTransport) {
  if (!attachment || !fileTransport) return null;
  var bytes = Utilities.base64Decode(fileTransport.dataBase64);
  if (bytes.length !== attachment.sizeBytes) throw new Error('Attachment byte count does not match metadata for ' + attachment.name + '.');
  var assessmentFolders = rootFolder.getFoldersByName(reportNumber);
  var folder = assessmentFolders.hasNext() ? assessmentFolders.next() : rootFolder.createFolder(reportNumber);
  var safeName = sanitizeFileName_(attachment.name);
  var blob = Utilities.newBlob(bytes, attachment.mimeType, safeName);
  var file = folder.createFile(blob);
  file.setDescription('OpenRAH01 evidence for ' + reportNumber + ' / ' + hazardId);
  return file;
}

function refreshRah01Dashboard_() {
  var spreadsheet = getRah01Spreadsheet_();
  var dashboard = spreadsheet.getSheetByName(RAH01_SHEETS.DASHBOARD);
  if (!dashboard) return;
  var assessments = readSheetObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.ASSESSMENTS));
  var hazards = readSheetObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.HAZARDS));
  dashboard.getRange('A5').setValue(assessments.length);
  dashboard.getRange('D5').setValue(assessments.filter(function (row) { return row.status === 'SUBMITTED'; }).length);
  dashboard.getRange('G5').setValue(assessments.filter(function (row) { return row.status === 'IN_REVIEW'; }).length);
  dashboard.getRange('J5').setValue(assessments.filter(function (row) { return Number(row.overall_risk_score) >= 6 && Number(row.overall_risk_score) <= 9; }).length);

  var sorted = assessments.slice().sort(function (left, right) {
    return String(left.department_name).localeCompare(String(right.department_name)) || new Date(right.assessment_date) - new Date(left.assessment_date) || String(left.assessment_id).localeCompare(String(right.assessment_id));
  }).slice(0, RAH01_DASHBOARD_REVIEW_ROWS);
  var indexRows = Array.from({ length: RAH01_DASHBOARD_REVIEW_ROWS }, function (_, index) {
    var row = sorted[index];
    if (!row) return [index + 1, '', '', '', '', '', '', '', ''];
    var score = Number(row.overall_risk_score);
    var action = score >= 6 ? 'Immediate corrective action' : score >= 3 ? 'Document improvement plan' : score ? 'Maintain controls' : '';
    return [index + 1, row.department_name, row.total_staff_count, row.status, row.overall_risk_score, row.overall_risk_level, row.assessment_date, row.report_number, action];
  });
  dashboard.getRange(10, 1, RAH01_DASHBOARD_REVIEW_ROWS, 9).setValues(indexRows.map(function (row) { return row.map(safeCellValue_); }));
  dashboard.getRange(10, 20, RAH01_DASHBOARD_REVIEW_ROWS, 1).setValues(Array.from({ length: RAH01_DASHBOARD_REVIEW_ROWS }, function (_, index) { return [safeCellValue_(sorted[index] ? sorted[index].assessment_id : '')]; }));

  var categoryCodes = ['PHYSICAL', 'BIOLOGICAL', 'CHEMICAL', 'ERGONOMIC', 'SAFETY_ACCIDENT', 'FIRE_DISASTER', 'PSYCHOSOCIAL', 'INDOOR_AIR_QUALITY'];
  dashboard.getRange('O4:O11').setValues(categoryCodes.map(function (code) { return [hazards.filter(function (row) { return row.category_code === code && asBoolean_(row.has_risk); }).length]; }));
  var top = assessments.slice().sort(function (left, right) { return Number(right.overall_risk_score) - Number(left.overall_risk_score) || String(left.department_name).localeCompare(String(right.department_name)); }).slice(0, 4);
  dashboard.getRange('Q4:R7').setValues(Array.from({ length: 4 }, function (_, index) {
    return (top[index] ? [top[index].department_name, top[index].overall_risk_score] : ['', '']).map(safeCellValue_);
  }));
}

function requiredText_(value, label) { var text = String(value === undefined || value === null ? '' : value).trim(); if (!text) throw new Error(label + ' is required.'); return text; }
function boundedText_(value, label, maximum) { var text = String(value === undefined || value === null ? '' : value).trim(); if (text.length > maximum) throw new Error(label + ' is too long.'); return text; }
function integerInRange_(value, label, minimum, maximum) { var number = Number(value); if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(label + ' must be an integer from ' + minimum + ' to ' + maximum + '.'); return number; }
function positiveInteger_(value, label) { return integerInRange_(value, label, 1, 1000000); }
function nonnegativeInteger_(value, label) { return integerInRange_(value, label, 0, 1000000); }
function asBoolean_(value) { return value === true || value === 1 || String(value).toUpperCase() === 'TRUE' || String(value).toUpperCase() === 'ACTIVE'; }
function settingsBoolean_(value, label) {
  var normalized = String(value).trim().toUpperCase();
  if (value === true || value === 1 || normalized === 'TRUE' || normalized === 'ACTIVE') return true;
  if (value === false || value === 0 || normalized === 'FALSE' || normalized === 'INACTIVE') return false;
  throw new Error(label + ' must be TRUE or FALSE.');
}
function safeCellValue_(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}
function sanitizeFileName_(value) { return requiredText_(value, 'Attachment name').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 255); }
function riskLevel_(score) { return score <= 2 ? 'LOW' : score <= 4 ? 'MEDIUM' : 'HIGH'; }
