import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS,
  truncate,
  buildUpstreamPayload,
  sanitizeClientError
} from '../functions/_lib/validate.js';

describe('truncate', () => {
  it('trims and caps length', () => {
    assert.equal(truncate('  hello  ', 5), 'hello');
    assert.equal(truncate('abcdefghij', 5), 'abcde');
    assert.equal(truncate(null, 5), '');
  });
});

describe('buildUpstreamPayload', () => {
  it('accepts getMembers', () => {
    const r = buildUpstreamPayload({ action: 'getMembers' });
    assert.equal(r.ok, true);
    assert.deepEqual(r.payload, { action: 'getMembers' });
  });

  it('requires displayName for attendance', () => {
    const bad = buildUpstreamPayload({ action: 'recordAttendance', displayName: '  ' });
    assert.equal(bad.ok, false);
    assert.equal(bad.status, 400);

    const good = buildUpstreamPayload({
      action: 'recordAttendance',
      displayName: '  Jane Doe  '
    });
    assert.equal(good.ok, true);
    assert.equal(good.payload.displayName, 'Jane Doe');
  });

  it('requires first and last name for non-members', () => {
    const bad = buildUpstreamPayload({
      action: 'recordNonMember',
      form: { firstName: 'Only' }
    });
    assert.equal(bad.ok, false);

    const long = 'x'.repeat(LIMITS.firstName + 20);
    const good = buildUpstreamPayload({
      action: 'recordNonMember',
      form: {
        firstName: long,
        lastName: 'Smith',
        phone: '555',
        email: 'a@b.c',
        childName: 'Kid',
        childTeacher: 'Teacher'
      }
    });
    assert.equal(good.ok, true);
    assert.equal(good.payload.form.firstName.length, LIMITS.firstName);
    assert.equal(good.payload.form.lastName, 'Smith');
  });

  it('rejects unknown actions', () => {
    const r = buildUpstreamPayload({ action: 'deleteAll' });
    assert.equal(r.ok, false);
    assert.match(r.error, /Unknown action/);
  });
});

describe('sanitizeClientError', () => {
  it('explains missing Apps Script API_SECRET without leaking values', () => {
    assert.match(
      sanitizeClientError('Server is not configured (missing API_SECRET).'),
      /Apps Script is missing Script Property API_SECRET/
    );
  });

  it('explains secret mismatch', () => {
    assert.match(sanitizeClientError('Unauthorized.'), /does not match/);
  });

  it('passes through normal user errors', () => {
    assert.equal(
      sanitizeClientError('Name not found in list.'),
      'Name not found in list.'
    );
  });
});
