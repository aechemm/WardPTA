/** Shared request validation for the Cloudflare Pages API proxy. */

export const LIMITS = {
  displayName: 120,
  firstName: 80,
  lastName: 80,
  phone: 40,
  email: 120,
  childName: 80,
  childTeacher: 80,
  bodyBytes: 8000
};

export function truncate(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/**
 * Build the Apps Script payload (without secret) or return a client error.
 * @returns {{ ok: true, payload: object } | { ok: false, status: number, error: string }}
 */
export function buildUpstreamPayload(body) {
  const action = String((body && body.action) || '').trim();

  if (action === 'getMembers') {
    return { ok: true, payload: { action } };
  }

  if (action === 'recordAttendance') {
    const displayName = truncate(body.displayName, LIMITS.displayName);
    if (!displayName) {
      return { ok: false, status: 400, error: 'Please enter or select your name.' };
    }
    return { ok: true, payload: { action, displayName } };
  }

  if (action === 'recordNonMember') {
    const formIn = (body && body.form) || {};
    const form = {
      firstName: truncate(formIn.firstName, LIMITS.firstName),
      lastName: truncate(formIn.lastName, LIMITS.lastName),
      phone: truncate(formIn.phone, LIMITS.phone),
      email: truncate(formIn.email, LIMITS.email),
      childName: truncate(formIn.childName, LIMITS.childName),
      childTeacher: truncate(formIn.childTeacher, LIMITS.childTeacher)
    };
    if (!form.firstName || !form.lastName) {
      return {
        ok: false,
        status: 400,
        error: 'Please enter at least first and last name.'
      };
    }
    return { ok: true, payload: { action, form } };
  }

  return { ok: false, status: 400, error: 'Unknown action.' };
}

export function sanitizeClientError(message) {
  const msg = String(message || 'Request failed.');
  // Setup guidance — do not echo secret values.
  if (/missing API_SECRET|not configured \(missing API_SECRET\)/i.test(msg)) {
    return 'Apps Script is missing Script Property API_SECRET (or an old deployment is still live). Add it, then Deploy → New version.';
  }
  if (/script property/i.test(msg)) {
    return 'Apps Script Script Properties are not set up correctly.';
  }
  if (/unauthorized/i.test(msg)) {
    return 'Unauthorized — Cloudflare API_SECRET does not match Apps Script API_SECRET.';
  }
  return msg.slice(0, 300);
}
