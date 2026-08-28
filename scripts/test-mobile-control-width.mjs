import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stylesheets = [
  'AppsScript/Styles.html',
  'assets/css/rah-assessment-editor.css',
];

for (const stylesheet of stylesheets) {
  const css = await readFile(stylesheet, 'utf8');
  const sharedControlRules = [...css.matchAll(/input, select, textarea\s*\{([^}]*)\}/g)];
  const sharedControlRule = sharedControlRules.find((match) => /width:\s*100%\s*;/.test(match[1]));

  assert.ok(sharedControlRule, `${stylesheet}: shared form-control rule is missing`);
  assert.match(
    sharedControlRule[1],
    /min-width:\s*0\s*;/,
    `${stylesheet}: native controls must be allowed to shrink inside a grid track`,
  );
  assert.match(
    sharedControlRule[1],
    /max-width:\s*100%\s*;/,
    `${stylesheet}: native controls must not exceed their container`,
  );
}

console.log('PASS: form controls stay within their grid track in both frontends');
