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
  var append = { sheet: sheet, startRow: startRow, rowCount: rows.length };
  try {
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
    installRah01DerivedFormulasForRows_(sheet, startRow, rows.length);
    return append;
  } catch (error) {
    sheet.getRange(startRow, 1, rows.length, sheet.getLastColumn()).clearContent();
    throw error;
  }
}

function installRah01OperationalFormulas_(spreadsheet) {
  [RAH01_SHEETS.ASSESSMENTS, RAH01_SHEETS.HAZARDS].forEach(function (sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error('Missing required sheet: ' + sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow >= RAH01_DATA_ROW) installRah01DerivedFormulasForRows_(sheet, RAH01_DATA_ROW, lastRow - RAH01_DATA_ROW + 1);
  });
}

function rah01AssessmentRiskFormula_(row) {
  var criteria = '\'04 Hazards\'!$S$4:$S,M' + row + ',\'04 Hazards\'!$R$4:$R,TRUE,\'04 Hazards\'!$U$4:$U,TRUE';
  var scoreRange = '\'04 Hazards\'!$K$4:$K';
  function countAtLeast(score) { return 'COUNTIFS(' + criteria + ',' + scoreRange + ',">=' + score + '")'; }
  return '=IF(M' + row + '="","",IF(' + countAtLeast(1) + '=0,"",IF(' + countAtLeast(9) + '>0,9,IF(' + countAtLeast(6) + '>0,6,IF(' + countAtLeast(4) + '>0,4,IF(' + countAtLeast(3) + '>0,3,IF(' + countAtLeast(2) + '>0,2,1)))))))';
}

function installRah01DerivedFormulasForRows_(sheet, startRow, rowCount) {
  if (!rowCount) return;
  var sheetName = sheet.getName();
  if (sheetName === RAH01_SHEETS.ASSESSMENTS) {
    sheet.getRange(startRow, 7, rowCount, 1).setFormulas(Array.from({ length: rowCount }, function (_, index) {
      var row = startRow + index;
      return [rah01AssessmentRiskFormula_(row)];
    }));
    sheet.getRange(startRow, 8, rowCount, 1).setFormulas(Array.from({ length: rowCount }, function (_, index) {
      var row = startRow + index;
      return ['=IF(G' + row + '="","",IF(G' + row + '<=2,"LOW",IF(G' + row + '<=4,"MEDIUM","HIGH")))'];
    }));
  } else if (sheetName === RAH01_SHEETS.HAZARDS) {
    sheet.getRange(startRow, 11, rowCount, 1).setFormulas(Array.from({ length: rowCount }, function (_, index) {
      var row = startRow + index;
      return ['=IF(AND(R' + row + '=TRUE,U' + row + '=TRUE,ISNUMBER(I' + row + '),I' + row + '=INT(I' + row + '),I' + row + '>=1,I' + row + '<=3,ISNUMBER(J' + row + '),J' + row + '=INT(J' + row + '),J' + row + '>=1,J' + row + '<=3),I' + row + '*J' + row + ',"")'];
    }));
    sheet.getRange(startRow, 12, rowCount, 1).setFormulas(Array.from({ length: rowCount }, function (_, index) {
      var row = startRow + index;
      return ['=IF(K' + row + '="","",IF(K' + row + '<=2,"LOW",IF(K' + row + '<=4,"MEDIUM","HIGH")))'];
    }));
  }
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

function refreshRah01Dashboard_(forceChartRebuild) {
  var spreadsheet = getRah01Spreadsheet_();
  var dashboard = spreadsheet.getSheetByName(RAH01_SHEETS.DASHBOARD);
  if (!dashboard) return;
  var assessments = readSheetObjects_(spreadsheet.getSheetByName(RAH01_SHEETS.ASSESSMENTS));
  var reviewCapacity = ensureRah01DashboardReviewCapacity_(dashboard, assessments.length);
  installRah01DashboardFormulas_(dashboard, reviewCapacity);
  SpreadsheetApp.flush();
  ensureRah01DashboardCharts_(dashboard, forceChartRebuild === true);
  SpreadsheetApp.flush();
}

function installRah01DashboardFormulas_(dashboard, reviewCapacity) {
  if (dashboard.getMaxColumns() < 36) dashboard.insertColumnsAfter(dashboard.getMaxColumns(), 36 - dashboard.getMaxColumns());
  dashboard.getRange('A5').setFormula("=COUNTIF('01 assessment'!M4:M,\"<>\")");
  dashboard.getRange('D5').setFormula("=COUNTIF('01 assessment'!C4:C,\"SUBMITTED\")");
  dashboard.getRange('G5').setFormula("=COUNTIF('01 assessment'!C4:C,\"IN_REVIEW\")");
  dashboard.getRange('J5').setFormula("=COUNTIFS('01 assessment'!G4:G,\">=6\",'01 assessment'!G4:G,\"<=9\")");

  var firstRow = RAH01_DASHBOARD_FIRST_REVIEW_ROW;
  dashboard.getRange('W4:AD' + dashboard.getMaxRows()).clearContent();
  dashboard.getRange('W4').setFormula("=IFERROR(SORT(FILTER({'01 assessment'!A4:A,'01 assessment'!F4:F,'01 assessment'!C4:C,'01 assessment'!G4:G,'01 assessment'!H4:H,'01 assessment'!B4:B,'01 assessment'!I4:I,'01 assessment'!M4:M},'01 assessment'!M4:M<>\"\"),1,TRUE,6,FALSE,8,TRUE),\"\")");
  dashboard.getRange(firstRow, 1, reviewCapacity, 1).setValues(Array.from({ length: reviewCapacity }, function (_, index) { return [index + 1]; }));
  dashboard.getRange(firstRow, 2, reviewCapacity, 7).setFormulas(Array.from({ length: reviewCapacity }, function (_, index) {
    var row = firstRow + index;
    return Array.from({ length: 7 }, function (_, column) {
      return '=IFERROR(INDEX($W$4:$AD,$A' + row + ',' + (column + 1) + '),\"\")';
    });
  }));
  dashboard.getRange(firstRow, 9, reviewCapacity, 1).setFormulas(Array.from({ length: reviewCapacity }, function (_, index) {
    var row = firstRow + index;
    return ['=IF(E' + row + '=\"\",\"\",IF(E' + row + '>=6,\"Immediate corrective action\",IF(E' + row + '>=3,\"Document improvement plan\",\"Maintain controls\")))'];
  }));
  dashboard.getRange(firstRow, 20, reviewCapacity, 1).setFormulas(Array.from({ length: reviewCapacity }, function (_, index) {
    var row = firstRow + index;
    return ['=IFERROR(INDEX($W$4:$AD,$A' + row + ',8),\"\")'];
  }));

  var formulaLastRow = RAH01_DASHBOARD_FORMULA_LAST_ROW;
  var categoryRows = [
    ['Biological', 'BIOLOGICAL'], ['Chemical', 'CHEMICAL'], ['Ergonomic', 'ERGONOMIC'],
    ['Fire / disaster', 'FIRE_DISASTER'], ['Indoor air', 'INDOOR_AIR_QUALITY'], ['Physical', 'PHYSICAL'],
    ['Psychosocial', 'PSYCHOSOCIAL'], ['Safety / accident', 'SAFETY_ACCIDENT']
  ];
  dashboard.getRange('N3:O3').setValues([['category_code', 'hazard_count']]);
  dashboard.getRange('N4:N11').setValues(categoryRows.map(function (row) { return [row[0]]; }));
  dashboard.getRange('O4:O11').setFormulas(categoryRows.map(function (row) {
    return ['=SUMPRODUCT((\'04 Hazards\'!$O$4:$O$' + formulaLastRow + '=\"' + row[1] + '\")*(\'04 Hazards\'!$R$4:$R$' + formulaLastRow + '=TRUE))'];
  }));

  var helperRowCount = formulaLastRow - 3;
  dashboard.getRange('AG3:AJ3').setValues([['latest_department_assessment_rank', 'latest_assessment_total_risk', 'top_risk_rank', 'review_sort_rank']]);
  dashboard.getRange('AG4:AG' + formulaLastRow).setFormulas(Array.from({ length: helperRowCount }, function (_, index) {
    var row = index + 4;
    return [`=IF('01 assessment'!$M${row}="","",1+COUNTIFS('01 assessment'!$L$4:$L$${formulaLastRow},'01 assessment'!$L${row},'01 assessment'!$J$4:$J$${formulaLastRow},">"&'01 assessment'!$J${row})+COUNTIFS('01 assessment'!$L$4:$L$${formulaLastRow},'01 assessment'!$L${row},'01 assessment'!$J$4:$J$${formulaLastRow},'01 assessment'!$J${row},'01 assessment'!$M$4:$M$${formulaLastRow},"<"&'01 assessment'!$M${row}))`];
  }));
  dashboard.getRange('AH4:AH' + formulaLastRow).setFormulas(Array.from({ length: helperRowCount }, function (_, index) {
    var row = index + 4;
    return [`=IF(OR($AG${row}<>1,'01 assessment'!$M${row}=""),"",SUMIFS('04 Hazards'!$K$4:$K$${formulaLastRow},'04 Hazards'!$S$4:$S$${formulaLastRow},'01 assessment'!$M${row},'04 Hazards'!$R$4:$R$${formulaLastRow},TRUE,'04 Hazards'!$U$4:$U$${formulaLastRow},TRUE))`];
  }));
  dashboard.getRange('AI4:AI' + formulaLastRow).setFormulas(Array.from({ length: helperRowCount }, function (_, index) {
    var row = index + 4;
    return [`=IF(OR($AG${row}<>1,$AH${row}<=0),"",1+COUNTIFS($AG$4:$AG$${formulaLastRow},1,$AH$4:$AH$${formulaLastRow},">"&$AH${row})+COUNTIFS($AG$4:$AG$${formulaLastRow},1,$AH$4:$AH$${formulaLastRow},$AH${row},'01 assessment'!$A$4:$A$${formulaLastRow},"<"&'01 assessment'!$A${row}))`];
  }));
  dashboard.getRange('AJ4:AJ' + formulaLastRow).setFormulas(Array.from({ length: helperRowCount }, function (_, index) {
    var row = index + 4;
    return [`=IF('01 assessment'!$M${row}="","",1+COUNTIFS('01 assessment'!$A$4:$A$${formulaLastRow},"<"&'01 assessment'!$A${row},'01 assessment'!$M$4:$M$${formulaLastRow},"<>")+COUNTIFS('01 assessment'!$A$4:$A$${formulaLastRow},'01 assessment'!$A${row},'01 assessment'!$B$4:$B$${formulaLastRow},">"&'01 assessment'!$B${row},'01 assessment'!$M$4:$M$${formulaLastRow},"<>")+COUNTIFS('01 assessment'!$A$4:$A$${formulaLastRow},'01 assessment'!$A${row},'01 assessment'!$B$4:$B$${formulaLastRow},'01 assessment'!$B${row},'01 assessment'!$M$4:$M$${formulaLastRow},"<"&'01 assessment'!$M${row}))`];
  }));

  var statuses = ['CLOSED', 'SUBMITTED', 'IN_REVIEW', 'RETURNED'];
  dashboard.getRange('Q3:R3').setValues([['assessment_status', 'department_count']]);
  dashboard.getRange('Q4:Q7').setValues(statuses.map(function (status) { return [status]; }));
  dashboard.getRange('R4:R7').setFormulas(statuses.map(function (_, index) {
    var row = index + 4;
    return [`=COUNTIFS($AG$4:$AG$${formulaLastRow},1,'01 assessment'!$C$4:$C$${formulaLastRow},Q${row})`];
  }));

  dashboard.getRange('AE3:AF3').setValues([['department_name', 'total_risk_score']]);
  dashboard.getRange('AE4:AE13').setFormulas(Array.from({ length: 10 }, function (_, index) {
    var row = index + 4;
    return [`=IFERROR(INDEX('01 assessment'!$A$4:$A$${formulaLastRow},MATCH(ROWS($AE$4:AE${row}),$AI$4:$AI$${formulaLastRow},0)),"")`];
  }));
  dashboard.getRange('AF4:AF13').setFormulas(Array.from({ length: 10 }, function (_, index) {
    var row = index + 4;
    return [`=IF(AE${row}="","",INDEX($AH$4:$AH$${formulaLastRow},MATCH(ROWS($AF$4:AF${row}),$AI$4:$AI$${formulaLastRow},0)))`];
  }));

  dashboard.hideColumns(14, 23);
  dashboard.getRange('U4').setValue(reviewCapacity);
  dashboard.getRange('A2').setValue('Google Sheets live dashboard · Formulas and charts maintained automatically by OpenRAH01.');
}

function ensureRah01DashboardCharts_(dashboard, forceChartRebuild) {
  var charts = dashboard.getCharts();
  var requiredTitles = ['Total Hazards Identified by Category', 'Risk Assessment Progress Across Departments', 'Top 10 High-Risk Departments'];
  var existingTitles = charts.map(function (chart) { return String(chart.getOptions().get('title') || ''); });
  if (!forceChartRebuild && charts.length === 3 && requiredTitles.every(function (title) { return existingTitles.indexOf(title) >= 0; })) return;
  charts.forEach(function (chart) { dashboard.removeChart(chart); });

  var categoryChart = dashboard.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(dashboard.getRange('N3:O11'))
    .setNumHeaders(1)
    .setTransposeRowsAndColumns(false)
    .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH)
    .setPosition(RAH01_DASHBOARD_CHART_FIRST_ROW, RAH01_DASHBOARD_CATEGORY_CHART_COLUMN, 0, 0)
    .setOption('title', 'Total Hazards Identified by Category')
    .setOption('legend', { position: 'none' })
    .setOption('colors', ['#1E6F7A'])
    .setOption('hAxis', { title: 'Number of Identified Hazards', viewWindow: { min: 0 } })
    .setOption('vAxis', { title: 'Hazard Category', direction: -1 })
    .setOption('width', RAH01_DASHBOARD_CHART_WIDTH)
    .setOption('height', RAH01_DASHBOARD_CHART_HEIGHT)
    .build();
  dashboard.insertChart(categoryChart);

  var progressChart = dashboard.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dashboard.getRange('Q3:R7'))
    .setNumHeaders(1)
    .setTransposeRowsAndColumns(false)
    .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH)
    .setPosition(RAH01_DASHBOARD_CHART_FIRST_ROW, RAH01_DASHBOARD_PROGRESS_CHART_COLUMN, 0, 0)
    .setOption('title', 'Risk Assessment Progress Across Departments')
    .setOption('legend', { position: 'none' })
    .setOption('colors', ['#1E6F7A'])
    .setOption('hAxis', { title: 'Assessment Status' })
    .setOption('vAxis', { title: 'Number of Departments', viewWindow: { min: 0 } })
    .setOption('width', RAH01_DASHBOARD_CHART_WIDTH)
    .setOption('height', RAH01_DASHBOARD_CHART_HEIGHT)
    .build();
  dashboard.insertChart(progressChart);

  var topRiskChart = dashboard.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(dashboard.getRange('AE3:AF13'))
    .setNumHeaders(1)
    .setTransposeRowsAndColumns(false)
    .setHiddenDimensionStrategy(Charts.ChartHiddenDimensionStrategy.SHOW_BOTH)
    .setPosition(RAH01_DASHBOARD_CHART_FIRST_ROW, RAH01_DASHBOARD_TOP_RISK_CHART_COLUMN, 0, 0)
    .setOption('title', 'Top 10 High-Risk Departments')
    .setOption('legend', { position: 'none' })
    .setOption('colors', ['#1E6F7A'])
    .setOption('hAxis', { title: 'Total Risk Score', viewWindow: { min: 0 } })
    .setOption('vAxis', { title: 'Department', direction: -1 })
    .setOption('width', RAH01_DASHBOARD_CHART_WIDTH)
    .setOption('height', RAH01_DASHBOARD_CHART_HEIGHT)
    .build();
  dashboard.insertChart(topRiskChart);
}

function ensureRah01DashboardReviewCapacity_(dashboard, requiredRows) {
  var storedCapacity = Number(dashboard.getRange('U4').getValue());
  var capacity = Number.isInteger(storedCapacity) && storedCapacity >= RAH01_DASHBOARD_MIN_REVIEW_ROWS
    ? storedCapacity
    : RAH01_DASHBOARD_MIN_REVIEW_ROWS;
  if (requiredRows <= capacity) {
    dashboard.getRange('U4').setValue(capacity);
    return capacity;
  }
  var additionalRows = requiredRows - capacity;
  var currentLastRow = RAH01_DASHBOARD_FIRST_REVIEW_ROW + capacity - 1;
  dashboard.insertRowsAfter(currentLastRow, additionalRows);
  dashboard.getRange(currentLastRow, 1, 1, 9).copyTo(
    dashboard.getRange(currentLastRow + 1, 1, additionalRows, 9),
    SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
    false
  );
  dashboard.getRange('U4').setValue(requiredRows);
  return requiredRows;
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
