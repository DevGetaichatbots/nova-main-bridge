import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { getFirstSupportErrorField } from '../src/utils/supportForm.js';

test('getFirstSupportErrorField returns the first invalid field in form order', () => {
  const errors = {
    email: 'Email is required',
    name: 'Name is required',
  };

  assert.equal(getFirstSupportErrorField(errors), 'name');
});

test('getFirstSupportErrorField returns null when there are no errors', () => {
  assert.equal(getFirstSupportErrorField({}), null);
});

test('Support form scrolls and focuses the first invalid field after submit validation', () => {
  const source = fs.readFileSync(
    path.resolve('src', 'components', 'Support.jsx'),
    'utf8',
  );

  assert.match(source, /scrollIntoView\s*\(/, 'Support form should scroll invalid fields into view');
  assert.match(source, /preventScroll:\s*true/, 'Support form should focus without a second scroll jump');
  assert.match(source, /getFirstSupportErrorField/, 'Support form should derive the first invalid field from validation errors');
});
