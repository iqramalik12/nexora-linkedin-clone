// Quick browser pass over jobs, notifications, reposts, saved posts and photos.
// Usage: BASE_URL=http://localhost:5173 node e2e/smoke-new.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const SHOTS = process.env.SHOTS_DIR || 'e2e/screens';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const errors = [];
const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push(`PASS  ${name}`); } catch (e) {
    results.push(`FAIL  ${name}\n      ${e.message.split('\n')[0]}`);
    const pages = browser.contexts().flatMap((c) => c.pages());
    for (const [i, p] of pages.entries()) await p.screenshot({ path: `${SHOTS}/fail-${name.replace(/\W+/g, '-')}-${i}.png` }).catch(() => {});
    for (const p of pages) await p.keyboard.press('Escape').catch(() => {});
  }
};

// A small PNG to upload.
const png = path.join(os.tmpdir(), `nx-${Date.now()}.png`);
fs.writeFileSync(png, makePng(64, 64));

// Builds a valid solid-colour RGB PNG.
function makePng(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [13, 110, 110]).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(`console: ${m.text()}`); });

const stamp = Date.now();
await step('sign up a fresh account', async () => {
  await page.goto(`${BASE}/signup`);
  await page.getByLabel('Full name').fill('Zara Smoke');
  await page.getByLabel('Email').fill(`zara${stamp}@example.com`);
  await page.getByLabel('Password').fill('testpass123');
  await page.getByRole('button', { name: 'Agree & join' }).click();
  await page.getByRole('heading', { name: 'Home feed' }).waitFor({ state: 'attached' });
});

await step('photo post', async () => {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Photo' }).click();
  await (await chooser).setFiles(png);
  await page.getByAltText('Selected photo').waitFor();
  await page.getByLabel('What do you want to share?').fill(`Photo test ${stamp}`);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const card = page.getByRole('article').filter({ hasText: `Photo test ${stamp}` });
  await card.locator('img.post-img').waitFor();
});

await step('repost someone else and undo', async () => {
  const card = page.getByRole('article').filter({ hasText: 'Boring technology' }).first();
  await card.getByRole('button', { name: 'Repost' }).click();
  await card.getByRole('menuitem', { name: 'Repost', exact: true }).click();
  const mine = page.getByRole('article').filter({ hasText: /You\s*reposted this/ }).first();
  await mine.waitFor();
  await mine.getByRole('button', { name: 'Repost' }).click();
  await mine.getByRole('menuitem', { name: 'Undo repost' }).click();
  await page.getByText('Repost removed').waitFor();
});

await step('repost with thoughts', async () => {
  // The original post, not an earlier quote of it.
  const card = page.getByRole('article', { name: 'Post by Bilal Qureshi' }).filter({ hasText: 'accessibility habit' }).first();
  await card.getByRole('button', { name: 'Repost' }).click();
  await card.getByRole('menuitem', { name: 'Repost with your thoughts' }).click();
  await page.getByLabel('Your thoughts', { exact: true }).fill(`Great tip ${stamp}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Post' }).click();
  await page.getByRole('article').filter({ hasText: `Great tip ${stamp}` }).locator('.embed').first().waitFor();
});

await step('save a post and see it in Saved posts', async () => {
  const card = page.getByRole('article').filter({ hasText: 'portfolio case study' }).first();
  await card.getByRole('button', { name: 'Post options' }).click();
  await card.getByRole('menuitem', { name: 'Save' }).click();
  await page.goto(`${BASE}/saved`);
  await page.getByRole('article').filter({ hasText: 'portfolio case study' }).waitFor();
});

await step('profile photo upload', async () => {
  await page.getByRole('button', { name: 'Me', exact: true }).click();
  await page.getByRole('menuitem', { name: 'View profile' }).click();
  await page.getByRole('button', { name: 'Change profile photo' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload photo' }).click();
  await (await chooser).setFiles(png);
  await page.getByRole('button', { name: 'Save photo' }).click();
  await page.getByText('Profile photo updated').waitFor();
  await page.locator('img.avatar.av-152').waitFor();
  await page.screenshot({ path: `${SHOTS}/new-profile.png` });
});

let jobTitle = `QA Lead ${stamp}`;
await step('post a job', async () => {
  await page.goto(`${BASE}/jobs`);
  await page.getByRole('button', { name: 'Post a job' }).click();
  await page.getByLabel('Job title', { exact: true }).fill(jobTitle);
  await page.getByLabel('Company', { exact: true }).fill('Smoke Co');
  await page.getByLabel('Workplace type').selectOption('Remote');
  await page.getByLabel('Description').fill('Test everything.');
  await page.getByRole('button', { name: 'Post job' }).click();
  await page.getByRole('heading', { name: jobTitle }).waitFor();
});

await step('search, filter, save and apply to a job', async () => {
  await page.goto(`${BASE}/jobs`);
  await page.getByLabel('Title, skill or company').fill('designer');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: /Senior Product Designer/ }).click();
  await page.getByRole('heading', { name: 'Senior Product Designer' }).waitFor();
  await page.getByRole('button', { name: 'Remote', exact: true }).click();
  await page.getByRole('button', { name: /^Product Designer/ }).waitFor();
  await page.getByRole('button', { name: /Senior Product Designer/ }).waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Saved', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Easy Apply' }).click();
  await page.getByLabel(/Note to the hiring team/).fill('Hello!');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await page.getByText(/^Applied/).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/new-jobs.png` });
  await page.getByRole('tab', { name: 'Applied' }).click();
  await page.getByRole('button', { name: /^Product Designer/ }).waitFor();
});

await step('people and job search together', async () => {
  await page.getByLabel('Search people').fill('engineer');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: /Jobs matching/ }).waitFor();
});

// Second person: as the demo account, get notified.
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => errors.push(`pageerror(phone): ${e.message}`));
await step('demo account sees notifications (phone)', async () => {
  await p2.goto(`${BASE}/login`);
  await p2.getByLabel('Email').fill('iqra@nexora.dev');
  await p2.getByLabel('Password').fill('nexora123');
  await p2.getByRole('button', { name: 'Sign in' }).click();
  await p2.getByRole('heading', { name: 'Home feed' }).waitFor({ state: 'attached' });
  await p2.getByRole('navigation', { name: 'Primary (mobile)' }).getByRole('link', { name: /Alerts/ }).click();
  await p2.getByRole('heading', { name: 'Notifications' }).waitFor();
  await p2.locator('.notif').first().waitFor();
  await p2.screenshot({ path: `${SHOTS}/new-notifications-phone.png` });
  const markAll = p2.getByRole('button', { name: 'Mark all as read' });
  if (await markAll.isEnabled()) await markAll.click();
  await p2.locator('.notif.unread').first().waitFor({ state: 'detached' });
});
await step('jobs on phone: list then detail', async () => {
  await p2.goto(`${BASE}/jobs`);
  await p2.locator('.job-row').first().click();
  await p2.getByRole('button', { name: 'All jobs' }).waitFor();
  await p2.screenshot({ path: `${SHOTS}/new-job-phone.png` });
});

console.log(results.join('\n'));
console.log(errors.length ? `\nBrowser errors:\n${[...new Set(errors)].join('\n')}` : '\nNo browser errors.');
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) || errors.length ? 1 : 0);
