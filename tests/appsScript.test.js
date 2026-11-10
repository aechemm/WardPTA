import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { postToAppsScript } from '../functions/_lib/appsScript.js';

describe('postToAppsScript', () => {
  it('follows 302 with GET to Location', async () => {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      calls.push({ url, method: init.method || 'GET', redirect: init.redirect });
      if (calls.length === 1) {
        return {
          status: 302,
          headers: { get: (n) => (n === 'Location' ? 'https://script.googleusercontent.com/macros/echo?x=1' : null) },
          text: async () => ''
        };
      }
      return {
        status: 200,
        headers: { get: () => null },
        ok: true,
        text: async () => JSON.stringify({ ok: true, members: ['A B'] })
      };
    };

    const res = await postToAppsScript(
      'https://script.google.com/macros/s/ABC/exec',
      { secret: 'x', action: 'getMembers' },
      fetchImpl
    );
    const data = JSON.parse(await res.text());
    assert.equal(data.ok, true);
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].redirect, 'manual');
    assert.equal(calls[1].method, 'GET');
    assert.match(calls[1].url, /googleusercontent/);
  });

  it('retries with redirect follow on 405', async () => {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      calls.push({ url, method: init.method || 'GET', redirect: init.redirect });
      if (calls.length === 1) {
        return {
          status: 405,
          headers: { get: () => null },
          text: async () => 'Method Not Allowed'
        };
      }
      return {
        status: 200,
        ok: true,
        headers: { get: () => null },
        text: async () => JSON.stringify({ ok: true })
      };
    };

    const res = await postToAppsScript(
      'https://script.google.com/macros/s/ABC/exec',
      { secret: 'x', action: 'getMembers' },
      fetchImpl
    );
    assert.equal(JSON.parse(await res.text()).ok, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].redirect, 'follow');
  });
});
