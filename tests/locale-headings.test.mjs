import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const localesDir = path.resolve('src', 'locales');
const da = JSON.parse(fs.readFileSync(path.join(localesDir, 'da.json'), 'utf8'));

test('Danish locale translates support and admin portal headings', () => {
  assert.equal(da.support.title, 'Supportcenter');
  assert.equal(da.support.titleSmile, 'Supportcenter :)');
  assert.equal(da.admin.title, 'Adminportal');
  assert.equal(da.superAdmin.title, 'Superadminportal');
});
