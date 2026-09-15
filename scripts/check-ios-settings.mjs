import { webkit, devices, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const env = await fs.readFile('.env', 'utf8');
const ref = env.match(/VITE_SUPABASE_URL=.*?https:\/\/([^.]+)/)[1];
const browser = await webkit.launch();
try {
  const page = await browser.newPage({ ...devices['iPhone 13'] });
  await page.route('https://fonts.**/*', route => route.abort());
  await page.route('**/*.supabase.co/**', route => {
    const request = route.request();
    if (request.url().includes('/functions/v1/hm-installation')) {
      return route.fulfill({ json: request.postDataJSON().action === 'register' ? { id: 'test', credential: 'test' } : { ok: true } });
    }
    return route.fulfill({ json: [] });
  });
  await page.addInitScript(ref => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'test-user', email: 'test@example.test', user_metadata: {} },
    }));
    localStorage.setItem('hm-notification-prompt-dismissed', '1');
    Object.defineProperty(window, 'Notification', { value: { permission: 'granted' } });
    Object.defineProperty(window, 'PushManager', { value: function () {} });
    const subscription = { toJSON: () => ({ endpoint: 'https://example.test/push' }) };
    Object.defineProperty(navigator, 'serviceWorker', { value: {
      register: async () => ({}),
      ready: Promise.resolve({ pushManager: { getSubscription: async () => subscription } }),
    } });
  }, ref);
  await page.goto('http://127.0.0.1:5175/#/nastaveni', { waitUntil: 'domcontentloaded' });
  const boxes = page.locator('.switch-row input[type=checkbox]');
  await expect(boxes).toHaveCount(2);
  console.log('Initial controls:', await boxes.evaluateAll(elements => elements.map(el => ({
    disabled: el.disabled, checked: el.checked, padding: getComputedStyle(el).padding,
  }))));
  await boxes.nth(0).tap();
  await expect(boxes.nth(0)).toBeChecked();
  await boxes.nth(1).tap();
  await expect(boxes.nth(1)).toBeChecked();
  await boxes.nth(0).tap();
  await expect(boxes.nth(0)).not.toBeChecked();
  await page.screenshot({ path: `${process.env.TEMP}/hm-ios-settings.png` });
  console.log('PASS: WebKit mobile touch toggles daily and news settings with mocked push/server.');
} finally {
  await browser.close();
}
