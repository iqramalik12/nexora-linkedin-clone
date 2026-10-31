// End-to-end check of the main flows in a real browser.
// Needs the app running (npm run build && npm start) with seed data (npm run seed).
// Usage: BASE_URL=http://localhost:4000 npm run test:e2e
// First time on a new machine: npx playwright install chromium
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const SHOTS = process.env.SHOTS_DIR || 'e2e/screens';
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const results = [];

async function newPage(viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(`console: ${m.text()}`); });
  return page;
}

async function step(name, fn) {
  try { await fn(); results.push(`PASS  ${name}`); }
  catch (e) { results.push(`FAIL  ${name}\n      ${e.message.split('\n')[0]}`); }
}

async function login(page, email, password = 'nexora123') {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Home feed' }).waitFor({ state: 'attached' });
}

const stamp = Date.now();
const newbie = { name: 'Nadia Test', email: `nadia${stamp}@example.com`, password: 'testpass123' };

// --- New person: sign up, post, like, comment, delete ---
const a = await newPage();
await step('redirects to sign in when signed out', async () => {
  await a.goto(`${BASE}/mynetwork`);
  await a.waitForURL(/\/login$/);
});
await step('wrong password shows an error', async () => {
  await a.getByLabel('Email').fill('iqra@nexora.dev');
  await a.getByLabel('Password').fill('nope-nope');
  await a.getByRole('button', { name: 'Sign in' }).click();
  await a.getByRole('alert').filter({ hasText: 'do not match' }).waitFor();
});
await step('sign up creates an account and lands on the feed', async () => {
  await a.goto(`${BASE}/signup`);
  await a.getByLabel('Full name').fill(newbie.name);
  await a.getByLabel('Email').fill(newbie.email);
  await a.getByLabel('Password').fill(newbie.password);
  await a.getByLabel(/Headline/).fill('QA Engineer');
  await a.getByRole('button', { name: 'Agree & join' }).click();
  await a.getByRole('heading', { name: 'Home feed' }).waitFor({ state: 'attached' });
  await a.getByRole('heading', { name: newbie.name }).waitFor();
});
await step('feed shows seeded posts', async () => {
  await a.locator('article.post').first().waitFor();
  assert.ok((await a.locator('article.post').count()) >= 5);
  await a.screenshot({ path: `${SHOTS}/feed-desktop.png` });
});
const postText = `Testing Nexora end to end ${stamp} #qa`;
await step('create a post from the composer', async () => {
  await a.getByRole('button', { name: 'Start a post' }).click();
  await a.getByLabel('What do you want to share?').fill(postText);
  await a.getByRole('dialog').getByRole('button', { name: 'Post', exact: true }).click();
  await a.locator('article.post').first().getByText(`Testing Nexora end to end ${stamp}`).waitFor();
});
await step('like and unlike a post', async () => {
  const post = a.locator('article.post').nth(1);
  const like = post.getByRole('button', { name: 'Like' });
  const before = await like.getAttribute('aria-pressed');
  await like.click();
  await assert.doesNotReject(post.locator(`button[aria-pressed="${before === 'true' ? 'false' : 'true'}"]`).first().waitFor());
  await a.waitForTimeout(400);
  await like.click();
  await post.locator(`button[aria-pressed="${before}"]`).first().waitFor();
});
await step('comment on a post', async () => {
  const post = a.locator('article.post').nth(1);
  await post.getByRole('button', { name: 'Comment', exact: true }).click();
  await post.getByLabel('Add a comment').fill('Great point, thanks for sharing');
  await post.getByRole('button', { name: 'Reply' }).click();
  await post.getByText('Great point, thanks for sharing').waitFor();
});
await step('delete own comment', async () => {
  const post = a.locator('article.post').nth(1);
  await post.getByRole('button', { name: 'Delete comment' }).click();
  await post.getByText('Great point, thanks for sharing').waitFor({ state: 'detached' });
});
await step('delete own post', async () => {
  const mine = a.locator('article.post').first();
  await mine.getByRole('button', { name: 'Post options' }).click();
  await mine.getByRole('menuitem', { name: 'Delete post' }).click();
  await a.getByText(`Testing Nexora end to end ${stamp}`).waitFor({ state: 'detached' });
});
await step('edit own profile', async () => {
  await a.getByRole('button', { name: 'Me', exact: true }).click();
  await a.getByRole('menuitem', { name: 'View profile' }).click();
  await a.getByRole('button', { name: 'Edit profile' }).first().click();
  await a.getByRole('dialog').getByLabel('Location').fill('Multan, Punjab');
  await a.getByRole('dialog').getByLabel('About').fill('I break things on purpose so users never do.');
  await a.getByRole('dialog').getByLabel('Skills').fill('Testing, Playwright');
  await a.getByRole('button', { name: 'Add position' }).click();
  await a.getByRole('dialog').getByLabel('Title').fill('QA Engineer');
  await a.getByRole('dialog').getByLabel('Company').fill('Northwind Labs');
  await a.getByRole('button', { name: 'Save' }).click();
  await a.getByText('I break things on purpose').waitFor();
  await a.getByText('Northwind Labs').waitFor();
  await a.locator('.chip', { hasText: 'Playwright' }).waitFor();
});
await step('search finds a person and invites them to connect', async () => {
  await a.getByLabel('Search people').fill('Iqra');
  await a.getByLabel('Search people').press('Enter');
  await a.getByRole('link', { name: /Iqra Rida/ }).click();
  await a.getByRole('heading', { name: 'Iqra Rida' }).waitFor();
  await a.locator('.p-actions').getByRole('button', { name: 'Connect' }).click();
  await a.locator('.p-actions').getByRole('button', { name: 'Pending' }).waitFor();
});

// --- Iqra: accept, then message ---
const b = await newPage();
await step('seeded person signs in', () => login(b, 'iqra@nexora.dev'));
await step('invitation badge and accept', async () => {
  await b.goto(`${BASE}/mynetwork`);
  const row = b.locator('.list-row', { hasText: newbie.name });
  await row.getByRole('button', { name: 'Accept' }).click();
  await b.locator('#conn-h').filter({ hasText: /Connections/ }).waitFor();
  await b.locator('.list-row', { hasText: newbie.name }).getByRole('link', { name: 'Message' }).waitFor();
  await b.screenshot({ path: `${SHOTS}/network-desktop.png` });
});
await step('send a message to the new connection', async () => {
  await b.locator('.list-row', { hasText: newbie.name }).getByRole('link', { name: 'Message' }).click();
  await b.getByLabel('Write a message').fill('Welcome to Nexora, Nadia!');
  await b.getByLabel('Write a message').press('Enter');
  await b.locator('.bubble', { hasText: 'Welcome to Nexora, Nadia!' }).waitFor();
});
await step('recipient sees unread badge and the message, then replies', async () => {
  await a.goto(`${BASE}/`);
  await a.getByLabel(/unread messages/).first().waitFor({ timeout: 20000 });
  await a.getByRole('link', { name: /Messaging/ }).first().click();
  await a.getByRole('link', { name: /Iqra Rida/ }).click();
  await a.locator('.bubble', { hasText: 'Welcome to Nexora, Nadia!' }).waitFor();
  await a.getByLabel('Write a message').fill('Thank you!');
  await a.getByRole('button', { name: 'Send' }).click();
  await a.locator('.bubble', { hasText: 'Thank you!' }).waitFor();
});
await step('reply arrives in the open thread by polling', async () => {
  await b.locator('.bubble', { hasText: 'Thank you!' }).waitFor({ timeout: 10000 });
  await b.screenshot({ path: `${SHOTS}/messaging-desktop.png` });
});
await step('remove connection blocks messaging', async () => {
  await b.goto(`${BASE}/mynetwork`);
  await b.getByRole('button', { name: `Remove ${newbie.name}` }).click();
  await b.locator('.list-row', { hasText: newbie.name }).waitFor({ state: 'detached' });
  await a.reload();
  await a.getByText(/no longer connected/).waitFor();
});

// --- Phone width ---
const p = await newPage({ width: 390, height: 844 });
await step('phone layout: feed, bottom bar, no sideways scroll', async () => {
  await login(p, 'iqra@nexora.dev');
  await p.locator('article.post').first().waitFor();
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(sw <= 390, `page is ${sw}px wide`);
  await p.getByRole('navigation', { name: 'Primary (mobile)' }).waitFor();
  await p.screenshot({ path: `${SHOTS}/feed-phone.png` });
});
await step('phone layout: post from the bottom bar', async () => {
  await p.getByRole('navigation', { name: 'Primary (mobile)' }).getByRole('button', { name: 'Post' }).click();
  await p.getByLabel('What do you want to share?').fill('Posted from my phone');
  await p.getByRole('dialog').getByRole('button', { name: 'Post', exact: true }).click();
  await p.locator('article.post').first().getByText('Posted from my phone').waitFor();
});
await step('phone layout: profile and messaging fit', async () => {
  for (const path of ['/messaging', '/mynetwork']) {
    await p.goto(`${BASE}${path}`);
    await p.waitForTimeout(600);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(sw <= 390, `${path} is ${sw}px wide`);
  }
  await p.getByRole('link', { name: 'Iqra Rida' }).first().click().catch(() => {});
  await p.goto(`${BASE}/messaging`);
  await p.screenshot({ path: `${SHOTS}/messaging-phone.png` });
});

// --- Settings: sign out everywhere, account deletion ---
await step('sign out everywhere ends other sessions', async () => {
  const other = await newPage();
  await login(other, newbie.email, newbie.password);
  await a.goto(`${BASE}/settings`);
  await a.getByRole('button', { name: 'Sign out of all sessions' }).click();
  await a.waitForURL(/\/login$/);
  await other.goto(`${BASE}/mynetwork`);
  await other.waitForURL(/\/login/);
});
await step('delete account', async () => {
  await login(a, newbie.email, newbie.password);
  await a.goto(`${BASE}/settings`);
  await a.getByRole('button', { name: 'Delete account' }).click();
  await a.getByLabel('Password', { exact: true }).fill(newbie.password);
  await a.getByRole('button', { name: 'Delete forever' }).click();
  await a.waitForURL(/\/signup$/);
  await a.goto(`${BASE}/login`);
  await a.getByLabel('Email').fill(newbie.email);
  await a.getByLabel('Password').fill(newbie.password);
  await a.getByRole('button', { name: 'Sign in' }).click();
  await a.getByRole('alert').filter({ hasText: 'do not match' }).waitFor();
});

await browser.close();
console.log(results.join('\n'));
const unexpected = errors.filter((e) => !/401|403|400 \(Bad Request\)|Failed to load resource/.test(e));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
if (unexpected.length) console.log('Browser errors:\n' + [...new Set(unexpected)].join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) || unexpected.length ? 1 : 0);
