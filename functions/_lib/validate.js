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
  if (/api_secret|script property|not configured/i.test(msg)) {
    return 'Sign-in service is temporarily unavailable.';
  }
  return msg.slice(0, 300);
}
