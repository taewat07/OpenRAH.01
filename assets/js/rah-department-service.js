(function () {
  'use strict';

  const SETTINGS_METHOD = 'getRah01FormConfig';
  const SUBMIT_METHOD = 'submitRah01Assessment';
  let cachedConfig = null;

  function hasAppsScriptBridge() {
    return Boolean(window.google?.script?.run);
  }

  function callAppsScript(method, ...args) {
    return new Promise((resolve, reject) => {
      window.google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(error => reject(new Error(error?.message || String(error))))
        [method](...args);
    });
  }

  function normalizeDepartment(source) {
    const department = {
      id: String(source?.id ?? source?.departmentId ?? source?.department_id ?? '').trim(),
      code: String(source?.code ?? '').trim(),
      name: String(source?.name ?? source?.department_name ?? source?.nameTh ?? source?.name_th ?? source?.th ?? source?.nameEn ?? source?.name_en ?? source?.en ?? '').trim(),
      active: source?.active !== false && String(source?.active).toUpperCase() !== 'FALSE',
      sortOrder: Number(source?.sortOrder ?? source?.sort_order ?? 0)
    };
    if (!department.id || !department.name) return null;
    return Object.freeze(department);
  }

  function normalizeConfig(source) {
    const hospitalName = String(source?.hospitalName ?? source?.hospital_name ?? '').trim();
    if (!hospitalName) throw new Error('Hospital name is missing from Settings.');
    if (hospitalName.length > 200) throw new Error('Hospital name in Settings is too long.');
    const sourceDepartments = source?.departments || [];
    const normalizedDepartments = sourceDepartments.map(normalizeDepartment).filter(Boolean);
    const ids = new Set();
    normalizedDepartments.forEach(department => {
      if (ids.has(department.id)) throw new Error(`Duplicate department ID: ${department.id}`);
      ids.add(department.id);
    });
    const departments = normalizedDepartments
      .filter(department => department.active)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'th'));
    return Object.freeze({
      schemaVersion: String(source?.schemaVersion || 'rah01-form-config.v1'),
      hospitalName,
      departments: Object.freeze(departments)
    });
  }

  function previewConfig() {
    if (!window.RAH_SETTINGS_DATA) throw new Error('Preview Settings department catalog is unavailable.');
    return window.RAH_SETTINGS_DATA;
  }

  async function loadFormConfig({ force = false } = {}) {
    if (cachedConfig && !force) return cachedConfig;
    const source = hasAppsScriptBridge()
      ? await callAppsScript(SETTINGS_METHOD)
      : previewConfig();
    cachedConfig = normalizeConfig(source);
    return cachedConfig;
  }

  function getDepartment(departmentId) {
    return cachedConfig?.departments.find(department => department.id === departmentId) || null;
  }

  async function submitAssessment(payload) {
    if (!hasAppsScriptBridge()) throw new Error('Apps Script submission is unavailable in preview mode.');
    const department = getDepartment(payload?.header?.departmentId);
    if (!department) throw new Error('Selected department is not active in Settings.');
    return callAppsScript(SUBMIT_METHOD, payload);
  }

  window.RAHDepartmentService = Object.freeze({
    contract: Object.freeze({ settingsMethod: SETTINGS_METHOD, submitMethod: SUBMIT_METHOD }),
    loadFormConfig,
    getDepartment,
    submitAssessment
  });
})();
