/**
 * Integration test: mock Apps Script + validation + postToAppsScript path.
 * Does not require Cloudflare or the real spreadsheet.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { buildUpstreamPayload } from '../functions/_lib/validate.js';
import { postToAppsScript } from '../functions/_lib/appsScript.js';

const SECRET = 'integration-test-secret';
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;

describe('proxy → mock Apps Script', () => {
  let child;

  before(async () => {
    child = spawn(
      process.execPath,
      ['scripts/mock-apps-script.mjs'],
      {
        cwd: new URL('..', import.meta.url).pathname,
        env: { ...process.env, API_SECRET: SECRET, MOCK_PORT: String(PORT), MOCK_REDIRECT: '1' },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    // Wait until server is up
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(`${BASE}/_state`);
        if (r.ok) return;
      } catch {
        // not ready
      }
      await sleep(50);
    }
    throw new Error('Mock Apps Script did not start');
  });

  after(() => {
    if (child) child.kill('SIGTERM');
  });

  async function call(actionBody) {
    const built = buildUpstreamPayload(actionBody);
    assert.equal(built.ok, true, built.error);
    const res = await postToAppsScript(`${BASE}/exec`, {
      ...built.payload,
      secret: SECRET
    });
    return JSON.parse(await res.text());
  }

  it('loads members through redirect', async () => {
    const data = await call({ action: 'getMembers' });
    assert.equal(data.ok, true);
    assert.ok(data.members.includes('Test Member'));
  });

  it('records member attendance', async () => {
    const data = await call({
      action: 'recordAttendance',
      displayName: 'Test Member'
    });
    assert.equal(data.ok, true);
    const state = await (await fetch(`${BASE}/_state`)).json();
    assert.ok(state.attendance.some((a) => a.name === 'Test Member'));
  });

  it('rejects unknown members with a clear error', async () => {
    const data = await call({
      action: 'recordAttendance',
      displayName: 'Not A Real Person'
    });
    assert.equal(data.ok, false);
    assert.match(data.error, /not found/i);
  });

  it('records non-member submissions', async () => {
    const data = await call({
      action: 'recordNonMember',
      form: {
        firstName: 'Casey',
        lastName: 'Guest',
        phone: '555-0100',
        email: 'casey@example.com',
        childName: 'Jamie',
        childTeacher: 'Ms. Smith'
      }
    });
    assert.equal(data.ok, true);
    const state = await (await fetch(`${BASE}/_state`)).json();
    assert.ok(state.nonMembers.some((n) => n.firstName === 'Casey' && n.lastName === 'Guest'));
  });

  it('rejects bad secret', async () => {
    const res = await postToAppsScript(`${BASE}/exec`, {
      secret: 'wrong',
      action: 'getMembers'
    });
    const data = JSON.parse(await res.text());
    assert.equal(data.ok, false);
    assert.equal(data.error, 'Unauthorized.');
  });
});
