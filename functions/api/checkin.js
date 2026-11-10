/**
 * Cloudflare Pages Function — secure proxy to Google Apps Script.
 *
 * POST /api/checkin
 * Body: { action: "getMembers"|"recordAttendance"|"recordNonMember", ... }
 *
 * Secrets (Cloudflare Pages → Settings → Environment variables):
 *   APPS_SCRIPT_URL  — Apps Script /exec web app URL
 *   API_SECRET       — shared secret (must match Apps Script property API_SECRET)
 */

import { LIMITS, buildUpstreamPayload, sanitizeClientError } from '../_lib/validate.js';
import { postToAppsScript } from '../_lib/appsScript.js';

/** Soft per-IP rate limit via Cache API (best-effort on free tier). */
const RATE_LIMIT = {
  windowSeconds: 60,
  maxRequests: 40
};

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const limited = await enforceRateLimit_(request);
    if (limited) return limited;

    if (!env.APPS_SCRIPT_URL || !env.API_SECRET) {
      return json_(503, {
        ok: false,
        error: 'Sign-in service is not configured yet. Please try again later.'
      });
    }

    const raw = await request.text();
    if (raw.length > LIMITS.bodyBytes) {
      return json_(413, { ok: false, error: 'Request too large.' });
    }

    let body;
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      return json_(400, { ok: false, error: 'Invalid JSON body.' });
    }

    const built = buildUpstreamPayload(body);
    if (!built.ok) {
      return json_(built.status, { ok: false, error: built.error });
    }

    const payload = { ...built.payload, secret: env.API_SECRET };
    const upstream = await postToAppsScript(env.APPS_SCRIPT_URL, payload);
    const text = await upstream.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return json_(502, {
        ok: false,
        error: 'Sign-in service returned an unexpected response. Please try again.'
      });
    }

    if (data && data.ok === false) {
      const status = data.error === 'Unauthorized.' ? 401 : 400;
      return json_(status, {
        ok: false,
        error: sanitizeClientError(data.error)
      });
    }

    return json_(200, data);
  } catch (err) {
    console.error('checkin proxy error', err && err.message ? err.message : err);
    return json_(500, {
      ok: false,
      error: 'Unable to reach the sign-in service. Please try again.'
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      ...JSON_HEADERS
    }
  });
}

export async function onRequestGet() {
  return json_(405, { ok: false, error: 'Use POST.' });
}

function json_(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}

async function enforceRateLimit_(request) {
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const bucket = Math.floor(Date.now() / (RATE_LIMIT.windowSeconds * 1000));
    const cacheKey = new Request(
      `https://ward-pta-signin.rate-limit/api/checkin/${encodeURIComponent(ip)}/${bucket}`
    );
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    let count = 0;
    if (hit) {
      count = Number(await hit.text()) || 0;
    }
    count += 1;
    const response = new Response(String(count), {
      headers: {
        'Cache-Control': `max-age=${RATE_LIMIT.windowSeconds}`,
        'Content-Type': 'text/plain'
      }
    });
    try {
      const p = cache.put(cacheKey, response.clone());
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // ignore cache write failures
    }

    if (count > RATE_LIMIT.maxRequests) {
      return json_(429, {
        ok: false,
        error: 'Too many requests. Please wait a moment and try again.'
      });
    }
  } catch {
    // Rate limiting is best-effort; never block legitimate check-ins if Cache API fails.
  }
  return null;
}
