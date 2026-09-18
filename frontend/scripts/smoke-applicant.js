const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', err => console.log('PAGE EXCEPTION:', err.message));

  await page.goto('http://localhost:3000/register');
  const email = `applicant${Date.now()}@example.com`;
  await page.fill('input[type=text]', 'Test Applicant');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', 'password123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/applications', { timeout: 5000 });
  console.log('registered + logged in as new applicant');
  await page.screenshot({ path: '/tmp/10_applicant_empty.png' });

  await page.click('text=+ New Application');
  await page.waitForURL('**/applications/new');
  await page.fill('input[type=number] >> nth=0', '400000');
  const numberInputs = await page.$$('input[type=number]');
  await numberInputs[1].fill('24'); // tenure
  await page.fill('input[placeholder*="Home renovation"]', 'Business expansion');
  await numberInputs[2].fill('32'); // age
  await numberInputs[3].fill('55000'); // income
  await numberInputs[4].fill('12000'); // debt
  await page.click('button[type=submit]');
  await page.waitForURL(/\/applications\/\d+/, { timeout: 5000 });
  console.log('application created, now on detail page');
  await page.screenshot({ path: '/tmp/11_applicant_upload_widget.png' });

  const fileInput = await page.$('input[type=file]');
  await fileInput.setInputFiles('/home/user/loan_tampering/backend-forensics/sample_docs/sample_clean.pdf');
  await page.selectOption('select', 'BANK_STATEMENT');
  await page.click('text=Upload & Analyze');
  await page.waitForSelector('text=Ledger Reconciliation', { timeout: 15000 });
  console.log('upload + analysis complete, ledger rendered');
  await page.screenshot({ path: '/tmp/12_applicant_after_upload.png', fullPage: true });

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
