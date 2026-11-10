import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: false,
  defaultViewport: null,
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1100,900', '--window-position=40,40']
});
const page = (await browser.pages())[0] || await browser.newPage();
await page.setViewport({ width: 1100, height: 850 });
await page.goto('http://127.0.0.1:8787/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => (document.getElementById('msg')?.textContent || '') !== 'Loading member list…');
await sleep(1200);
await page.click('#nameInput', { clickCount: 3 });
await page.type('#nameInput', 'Test Member', { delay: 60 });
await sleep(800);
await page.click('#btn');
await page.waitForFunction(() => (document.getElementById('msg')?.textContent || '').includes('Signed in'));
await sleep(1500);
await page.click('#notMemberBtn');
await page.waitForSelector('#nonMemberForm', { visible: true });
await sleep(600);
await page.type('#nmFirstName', 'Casey', { delay: 40 });
await page.type('#nmLastName', 'Guest', { delay: 40 });
await page.type('#nmPhone', '555-0100', { delay: 30 });
await page.type('#nmEmail', 'casey@example.com', { delay: 30 });
await sleep(500);
await page.click('#nmSubmitBtn');
await page.waitForFunction(() => (document.getElementById('msg')?.textContent || '').includes('Thank you'));
await sleep(1800);
await page.type('#nameInput', 'Nobody Fake', { delay: 50 });
await page.click('#btn');
await page.waitForFunction(() => (document.getElementById('msg')?.textContent || '').toLowerCase().includes('not found'));
await sleep(2000);
await browser.close();
console.log('HEADED_DEMO_OK');
