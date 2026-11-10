/** Ward PTA Meeting Sign-In — Google Apps Script backend (API + legacy HTML host) */
const SPREADSHEET_ID = '1dAA7Nhw8tePkYR9-F5g9HLpTw7DORObqsYVrRK7DXhg';
const SHEET_NAME = 'Members 2026-2027';
const FIRST_ROW = 2;
const NAME_FIRST_COL = 1;
const NAME_LAST_COL = 2;

/** Max lengths accepted from the Cloudflare proxy (chars). */
const LIMITS = {
  displayName: 120,
  firstName: 80,
  lastName: 80,
  phone: 40,
  email: 120,
  childName: 80,
  childTeacher: 80
};

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Legacy HTML host — keep until Cloudflare Pages is confirmed working.
 * Parents should use the Cloudflare URL going forward.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('SignIn').setTitle('Ward PTA Sign-In');
}

/**
 * HTTP API for the Cloudflare Pages Function proxy.
 * Expects text/plain or JSON body:
 *   { secret, action, displayName?, form? }
 *
 * Script property required:
 *   API_SECRET — shared secret (same value as Cloudflare secret API_SECRET)
 */
function doPost(e) {
  try {
    const body = parseRequestBody_(e);
    assertSecret_(body.secret);

    const action = String(body.action || '').trim();
    if (action === 'getMembers') {
      return jsonOutput_({ ok: true, members: getMembers() });
    }
    if (action === 'recordAttendance') {
      const displayName = truncate_(body.displayName, LIMITS.displayName);
      return jsonOutput_(recordAttendance(displayName));
    }
    if (action === 'recordNonMember') {
      const form = sanitizeNonMemberForm_(body.form || {});
      return jsonOutput_(recordNonMember(form));
    }
    return jsonOutput_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'Request failed.';
    // Do not leak stack traces or property values to the proxy/browser.
    return jsonOutput_({ ok: false, error: message });
  }
}

function getMembers() {
  const sh = getSpreadsheet_().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Member tab not found: ' + SHEET_NAME);
  const lastRow = sh.getLastRow();
  if (lastRow < FIRST_ROW) return [];
  const rows = sh.getRange(FIRST_ROW, 1, lastRow - FIRST_ROW + 1, 2).getValues();
  const names = rows
    .map(r => [String(r[0] || '').trim(), String(r[1] || '').trim()].filter(Boolean).join(' '))
    .filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

function recordAttendance(displayName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getSpreadsheet_().getSheetByName(SHEET_NAME);
    if (!sh) throw new Error('Member tab not found: ' + SHEET_NAME);
    const lastRow = sh.getLastRow();
    if (lastRow < FIRST_ROW) throw new Error('No member rows found.');
    const data = sh.getRange(FIRST_ROW, 1, lastRow - FIRST_ROW + 1, 2).getValues();
    const term = String(displayName || '').trim().toLowerCase();
    if (!term) throw new Error('Please enter your name.');
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      const first = String(data[i][0] || '').trim().toLowerCase();
      const last = String(data[i][1] || '').trim().toLowerCase();
      if (!first && !last) continue;
      if (term === `${first} ${last}`.trim() || term === `${last} ${first}`.trim()) {
        rowIndex = FIRST_ROW + i;
        break;
      }
    }
    if (rowIndex === -1) {
      throw new Error('Name not found in list. Please check spelling or use "I\'m not in the list".');
    }
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    let col = headers.indexOf(today) + 1;
    if (!col) {
      col = lastCol + 1;
      sh.getRange(1, col).setValue(today);
    }
    sh.getRange(rowIndex, col).setValue('X');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function recordNonMember(form) {
  if (!form || !String(form.firstName || '').trim() || !String(form.lastName || '').trim()) {
    throw new Error('First and last name are required.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const sheetName = 'Meeting ' + today;
    let sh = ss.getSheetByName(sheetName);
    if (!sh) {
      sh = ss.insertSheet(sheetName);
      sh.appendRow([
        'Timestamp',
        'First Name',
        'Last Name',
        'Phone',
        'Email',
        "Youngest Attending Child's Name",
        "Youngest Attending Child's Teacher"
      ]);
    }
    // Prefix leading formula characters to prevent spreadsheet formula injection from form inputs.
    const safe = value => {
      const s = String(value || '').trim();
      return /^[=+\-@]/.test(s) ? "'" + s : s;
    };
    sh.appendRow([
      new Date(),
      safe(form.firstName),
      safe(form.lastName),
      safe(form.phone),
      safe(form.email),
      safe(form.childName),
      safe(form.childTeacher)
    ]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* ========== helpers ========== */

function parseRequestBody_(e) {
  if (!e || !e.postData || e.postData.contents == null) {
    throw new Error('Missing request body.');
  }
  const raw = String(e.postData.contents);
  if (raw.length > 8000) throw new Error('Request too large.');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON.');
    return parsed;
  } catch (err) {
    throw new Error('Invalid JSON body.');
  }
}

function assertSecret_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_SECRET');
  if (!expected) {
    throw new Error('Server is not configured (missing API_SECRET).');
  }
  if (String(provided || '') !== expected) {
    throw new Error('Unauthorized.');
  }
}

function sanitizeNonMemberForm_(form) {
  return {
    firstName: truncate_(form.firstName, LIMITS.firstName),
    lastName: truncate_(form.lastName, LIMITS.lastName),
    phone: truncate_(form.phone, LIMITS.phone),
    email: truncate_(form.email, LIMITS.email),
    childName: truncate_(form.childName, LIMITS.childName),
    childTeacher: truncate_(form.childTeacher, LIMITS.childTeacher)
  };
}

function truncate_(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
