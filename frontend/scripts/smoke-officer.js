const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('console', msg => { if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text()); });
  page.on('pageerror', err => console.log('PAGE EXCEPTION:', err.message));

  await page.goto('http://localhost:3000');
  await page.waitForURL('**/login', { timeout: 5000 });
  console.log('landed on login OK');

  // login as officer
  await page.fill('input[type=email]', 'officer@example.com');
  await page.fill('input[type=password]', 'password123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/applications', { timeout: 5000 });
  console.log('officer logged in, on applications list');
  await page.screenshot({ path: '/tmp/01_officer_queue.png', fullPage: true });

  // click into application #3 (photoshopped/fraud)
  await page.click('text=#3');
  await page.waitForURL('**/applications/3', { timeout: 5000 });
  await page.waitForTimeout(500);
  console.log('on application 3 detail');
  await page.screenshot({ path: '/tmp/02_app3_detail.png', fullPage: true });

  // go back and check application #2 (math tampered, under review -> now pre-approved after override)
  await page.goto('http://localhost:3000/applications/2');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/03_app2_detail.png', fullPage: true });

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
