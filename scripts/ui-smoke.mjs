import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=390,844']
});
const page = await browser.newPage();
page.setViewport({ width: 390, height: 844 });
const logs = [];
page.on('console', m => logs.push(['console', m.type(), m.text()]));
page.on('pageerror', e => logs.push(['pageerror', e.message]));

await page.goto('http://127.0.0.1:8787/', { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => {
  const t = document.getElementById('msg')?.textContent || '';
  return t !== 'Loading member list…';
}, { timeout: 15000 });

const options = await page.$$eval('#memberList option', els => els.map(o => o.value));
console.log('MEMBERS', options.length, options.includes('Test Member'));

// Member check-in
await page.type('#nameInput', 'Test Member');
await page.click('#btn');
await page.waitForFunction(() => (document.getElementById('msg')?.textContent || '').includes('Signed in'), { timeout: 10000 });
console.log('SIGNIN_MSG', await page.$eval('#msg', el => el.textContent));
await page.screenshot({ path: '/opt/cursor/artifacts/mobile_member_signin_success.png', fullPage: true });

// Non-member form
await page.click('#notMemberBtn');
await page.waitForSelector('#nonMemberForm', { visible: true, timeout: 5000 });
await page.type('#nmFirstName', 'Casey');
await page.type('#nmLastName', 'Guest');
await page.type('#nmPhone', '555-0100');
await page.type('#nmEmail', 'casey@example.com');
await page.type('#nmChildName', 'Jamie');
await page.type('#nmChildTeacher', 'Ms. Smith');
await page.click('#nmSubmitBtn');
await page.waitForFunction(() => (document.getElementById('msg')?.textContent || '').includes('Thank you'), { timeout: 10000 });
console.log('NONMEMBER_MSG', await page.$eval('#msg', el => el.textContent));
await page.screenshot({ path: '/opt/cursor/artifacts/mobile_nonmember_success.png', fullPage: true });

// Error path
await page.type('#nameInput', 'Nobody Fake');
await page.click('#btn');
await page.waitForFunction(() => (document.getElementById('msg')?.textContent || '').toLowerCase().includes('not found'), { timeout: 10000 });
console.log('ERROR_MSG', await page.$eval('#msg', el => el.textContent));
await page.screenshot({ path: '/opt/cursor/artifacts/mobile_signin_error.png', fullPage: true });

// Desktop viewport load
await page.setViewport({ width: 1280, height: 800 });
await page.goto('http://127.0.0.1:8787/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => {
  const t = document.getElementById('msg')?.textContent || '';
  return t !== 'Loading member list…';
}, { timeout: 15000 });
await page.screenshot({ path: '/opt/cursor/artifacts/desktop_signin_loaded.png', fullPage: true });

console.log('LOGS', JSON.stringify(logs.slice(0, 20), null, 2));
await browser.close();
console.log('UI_SMOKE_OK');
