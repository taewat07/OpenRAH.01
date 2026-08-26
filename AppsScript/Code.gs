function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('RAH.01 — แบบประเมินความเสี่ยงทางสุขภาพ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupRah01Production() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open this function from the Google Sheet-bound Apps Script project.');

  PropertiesService.getScriptProperties().setProperty(RAH01_PROPERTY_KEYS.SPREADSHEET_ID, spreadsheet.getId());
  ensureRah01FormConfiguration_(spreadsheet);
  ensureRah01HazardExposureColumn_(spreadsheet);
  validateRah01Workbook_(spreadsheet);

  var folderId = PropertiesService.getScriptProperties().getProperty(RAH01_PROPERTY_KEYS.ATTACHMENT_FOLDER_ID);
  var folder = folderId ? getFolderIfAvailable_(folderId) : null;
  if (!folder) {
    folder = DriveApp.createFolder('OpenRAH01 Private Attachments');
    PropertiesService.getScriptProperties().setProperty(RAH01_PROPERTY_KEYS.ATTACHMENT_FOLDER_ID, folder.getId());
  }

  refreshRah01Dashboard_();
  return {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    attachmentFolderId: folder.getId(),
    attachmentFolderName: folder.getName()
  };
}

function ensureRah01HazardExposureColumn_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(RAH01_SHEETS.HAZARDS);
  if (!sheet) throw new Error('Missing required sheet: ' + RAH01_SHEETS.HAZARDS);
  var expected = RAH01_HEADERS[RAH01_SHEETS.HAZARDS];
  var newColumn = expected.length;
  if (String(sheet.getRange(RAH01_HEADER_ROW, newColumn).getDisplayValue() || '').trim() === 'has_exposure') return;
  var legacy = expected.slice(0, -1);
  var actual = sheet.getRange(RAH01_HEADER_ROW, 1, 1, legacy.length).getDisplayValues()[0].map(function (value) { return String(value).trim(); });
  if (JSON.stringify(actual) !== JSON.stringify(legacy)) return;

  sheet.insertColumnAfter(legacy.length);
  sheet.getRange(RAH01_HEADER_ROW, legacy.length).copyTo(sheet.getRange(RAH01_HEADER_ROW, newColumn), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sheet.getRange(RAH01_HEADER_ROW, newColumn).setValue('has_exposure');
  var lastRow = sheet.getLastRow();
  if (lastRow >= RAH01_DATA_ROW) {
    sheet.getRange(RAH01_DATA_ROW, legacy.length, lastRow - RAH01_DATA_ROW + 1, 1).copyTo(
      sheet.getRange(RAH01_DATA_ROW, newColumn, lastRow - RAH01_DATA_ROW + 1, 1),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
    sheet.getRange(RAH01_DATA_ROW, newColumn, lastRow - RAH01_DATA_ROW + 1, 1).setValue(true);
  }
  sheet.setColumnWidth(newColumn, sheet.getColumnWidth(legacy.length));
}

function ensureRah01FormConfiguration_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(RAH01_SHEETS.SETTINGS);
  if (!sheet) throw new Error('Missing required sheet: ' + RAH01_SHEETS.SETTINGS);

  if (!sheet.getRange('G1:H1').isPartOfMerge()) sheet.getRange('G1:H1').merge();
  if (!sheet.getRange('G2:H2').isPartOfMerge()) sheet.getRange('G2:H2').merge();
  sheet.getRange('G1').setValue('Form configuration / ตั้งค่าแบบฟอร์ม');
  sheet.getRange('G2').setValue('Admin: edit the yellow value before deployment.');
  sheet.getRange('G3:H3').setValues([['setting_key', 'setting_value']]);
  sheet.getRange('G4').setValue('hospital_name');
  if (!String(sheet.getRange('H4').getDisplayValue() || '').trim()) sheet.getRange('H4').setValue(spreadsheet.getName());

  sheet.getRange('G1:H1').setBackground('#103B4C').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(14);
  sheet.getRange('G2:H2').setBackground('#EAF2F4').setFontColor('#52656D').setFontStyle('italic').setWrap(true);
  sheet.getRange('G3:H3').setBackground('#1E6F7A').setFontColor('#FFFFFF').setFontWeight('bold');
  sheet.getRange('G4').setBackground('#EEF3F6').setFontColor('#24343A').setFontWeight('bold');
  sheet.getRange('H4').setBackground('#FFF8D6').setFontColor('#24343A').setFontWeight('bold');
  sheet.setColumnWidth(7, 190);
  sheet.setColumnWidth(8, 300);
  sheet.getRange('H4').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=AND($H4<>"",LEN($H4)<=200)')
    .setAllowInvalid(false)
    .setHelpText('Hospital name is required and must contain no more than 200 characters.')
    .build());
}

function clearBundledSyntheticData() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var spreadsheet = getRah01Spreadsheet_();
    validateRah01Workbook_(spreadsheet);
    var assessmentRows = readSheetObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.ASSESSMENTS));
    var unsafe = assessmentRows.filter(function (row) {
      return !/^ASM-2026-\d{3}$/.test(String(row.assessment_id || '')) || !/^RAH01-2026-\d{3}$/.test(String(row.report_number || ''));
    });
    if (unsafe.length) throw new Error('Safety guard refused cleanup because non-bundled assessment data exists.');

    [
      RAH01_SHEETS.ASSESSMENTS,
      RAH01_SHEETS.CHECKLIST,
      RAH01_SHEETS.WORK_STEPS,
      RAH01_SHEETS.HAZARDS,
      RAH01_SHEETS.ATTACHMENTS,
      RAH01_SHEETS.ADMIN_LOG
    ].forEach(function (sheetName) {
      var sheet = spreadsheet.getSheetByName(sheetName);
      var lastRow = sheet.getLastRow();
      if (lastRow >= RAH01_DATA_ROW) sheet.getRange(RAH01_DATA_ROW, 1, lastRow - RAH01_DATA_ROW + 1, sheet.getLastColumn()).clearContent();
    });
    refreshRah01Dashboard_();
    return { ok: true, clearedAssessments: assessmentRows.length };
  } finally {
    lock.releaseLock();
  }
}
