/**
 * Local stand-in for Google Apps Script doPost — for frontend/proxy testing.
 * Does NOT touch the real spreadsheet.
 *
 * Usage:
 *   API_SECRET=test-secret node scripts/mock-apps-script.mjs
 * Then point .dev.vars APPS_SCRIPT_URL at http://127.0.0.1:8788/exec
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 8788);
const SECRET = process.env.API_SECRET || 'test-secret';

const members = [
  'Alex Rivera',
  'Jordan Lee',
  'Sam Patel',
  'Taylor Nguyen',
  'Test Member'
];

const attendance = [];
const nonMembers = [];

const server = http.createServer(async (req, res) => {
  // Simulate Apps Script 302 → GET echo pattern when ?redirect=1
  if (req.method === 'POST' && req.url.startsWith('/exec')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');

    if (process.env.MOCK_REDIRECT === '1') {
      const token = Buffer.from(raw).toString('base64url');
      res.writeHead(302, {
        Location: `http://127.0.0.1:${PORT}/echo?payload=${token}`
      });
      res.end();
      return;
    }

    const out = handleBody(raw);
    res.writeHead(out.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out.body));
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/echo')) {
    const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const raw = Buffer.from(u.searchParams.get('payload') || '', 'base64url').toString('utf8');
    const out = handleBody(raw);
    res.writeHead(out.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out.body));
    return;
  }

  if (req.method === 'GET' && req.url === '/_state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ members, attendance, nonMembers }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

function handleBody(raw) {
  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return { status: 400, body: { ok: false, error: 'Invalid JSON body.' } };
  }
  if (body.secret !== SECRET) {
    return { status: 200, body: { ok: false, error: 'Unauthorized.' } };
  }
  if (body.action === 'getMembers') {
    return { status: 200, body: { ok: true, members: [...members].sort() } };
  }
  if (body.action === 'recordAttendance') {
    const name = String(body.displayName || '').trim();
    if (!members.some((m) => m.toLowerCase() === name.toLowerCase())) {
      return {
        status: 200,
        body: {
          ok: false,
          error: 'Name not found in list. Please check spelling or use "I\'m not in the list".'
        }
      };
    }
    attendance.push({ name, at: new Date().toISOString() });
    return { status: 200, body: { ok: true } };
  }
  if (body.action === 'recordNonMember') {
    const form = body.form || {};
    if (!String(form.firstName || '').trim() || !String(form.lastName || '').trim()) {
      return { status: 200, body: { ok: false, error: 'First and last name are required.' } };
    }
    nonMembers.push({ ...form, at: new Date().toISOString() });
    return { status: 200, body: { ok: true } };
  }
  return { status: 200, body: { ok: false, error: 'Unknown action.' } };
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock Apps Script listening on http://127.0.0.1:${PORT}/exec`);
  console.log(`API_SECRET=${SECRET}`);
});
