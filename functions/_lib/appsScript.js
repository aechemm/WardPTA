/**
 * Post JSON to a Google Apps Script web app (/exec).
 *
 * Apps Script typically responds with a 302; following while keeping POST
 * can yield HTTP 405. Prefer manual redirect + GET of Location.
 * Content-Type text/plain avoids CORS preflight when called from browsers;
 * the Cloudflare Function calls this server-side.
 */
export async function postToAppsScript(url, payload, fetchImpl = fetch) {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'text/plain;charset=utf-8' };

  let res = await fetchImpl(url, {
    method: 'POST',
    redirect: 'manual',
    headers,
    body
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('Location');
    if (!location) {
      throw new Error('Apps Script redirect missing Location header.');
    }
    return fetchImpl(location, { method: 'GET', redirect: 'follow' });
  }

  if (res.status === 405) {
    return fetchImpl(url, {
      method: 'POST',
      redirect: 'follow',
      headers,
      body
    });
  }

  return res;
}
