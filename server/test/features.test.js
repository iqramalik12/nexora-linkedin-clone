import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startDb, stopDb, app, signup } from './helpers.js';

let server;
before(async () => { await startDb(); server = app(); });
after(stopDb);

// A 1x1 transparent PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('images, profile photos and photo posts', () => {
  test('upload, validate, attach, serve', async () => {
    const a = await signup(server);
    const b = await signup(server);
    const up = await a.agent.post('/api/images').send({ dataUrl: PNG });
    assert.equal(up.status, 201);
    assert.equal((await a.agent.post('/api/images').send({ dataUrl: 'data:image/png;base64,aGVsbG8=' })).status, 400, 'bytes must match the type');
    assert.equal((await a.agent.post('/api/images').send({ dataUrl: 'data:text/html;base64,aGVsbG8=' })).status, 400);

    const img = await b.agent.get(up.body.url);
    assert.equal(img.status, 200);
    assert.equal(img.headers['content-type'], 'image/png');
    assert.equal((await request(server).get(up.body.url)).status, 401);

    assert.equal((await b.agent.put('/api/users/me').send({ avatar: up.body.id })).status, 400, 'cannot use an image someone else uploaded');
    const me = await a.agent.put('/api/users/me').send({ avatar: up.body.id });
    assert.equal(me.body.user.avatarUrl, up.body.url);

    const up2 = await a.agent.post('/api/images').send({ dataUrl: PNG });
    const post = await a.agent.post('/api/posts').send({ image: up2.body.id });
    assert.equal(post.status, 201, 'a photo post needs no text');
    assert.equal(post.body.post.imageUrl, up2.body.url);
    assert.equal(post.body.post.author.avatarUrl, up.body.url);

    const off = await a.agent.put('/api/users/me').send({ avatar: null });
    assert.equal(off.body.user.avatarUrl, null);
    assert.equal((await a.agent.get(up.body.url)).status, 404, 'replaced photo is deleted');
  });
});

describe('repost and saved posts', () => {
  test('repost, undo, quote, save', async () => {
    const a = await signup(server);
    const b = await signup(server);
    const p = (await a.agent.post('/api/posts').send({ text: 'original' })).body.post;
    assert.equal(p.repostOf, undefined);
    assert.equal((await a.agent.post(`/api/posts/${p.id}/repost`)).status, 400, 'no reposting yourself');

    const r = await b.agent.post(`/api/posts/${p.id}/repost`);
    assert.equal(r.status, 201);
    assert.equal(r.body.post.repostOf.id, p.id);
    assert.equal(r.body.original.repostCount, 1);
    assert.equal(r.body.original.repostedByMe, true);
    assert.equal((await b.agent.post(`/api/posts/${p.id}/repost`)).status, 409);

    // Reposting a repost shares the original.
    const c = await signup(server);
    const r2 = await c.agent.post(`/api/posts/${r.body.post.id}/repost`).send({ text: 'Worth reading' });
    assert.equal(r2.body.post.repostOf.id, p.id);
    assert.equal(r2.body.post.text, 'Worth reading');

    const undo = await b.agent.delete(`/api/posts/${p.id}/repost`);
    assert.equal(undo.body.original.repostCount, 1);
    assert.equal(undo.body.original.repostedByMe, false);

    const s = await b.agent.post(`/api/posts/${p.id}/save`);
    assert.equal(s.body.post.savedByMe, true);
    assert.deepEqual((await b.agent.get('/api/posts/saved')).body.posts.map((x) => x.id), [p.id]);
    await b.agent.post(`/api/posts/${p.id}/save`);
    assert.equal((await b.agent.get('/api/posts/saved')).body.posts.length, 0);

    // Deleting the original leaves the quote repost showing it as unavailable.
    await b.agent.post(`/api/posts/${p.id}/repost`);
    await a.agent.delete(`/api/posts/${p.id}`);
    const after = await c.agent.get(`/api/posts/${r2.body.post.id}`);
    assert.equal(after.body.post.repostOf, null);
    const feed = (await a.agent.get('/api/posts?limit=50')).body.posts;
    assert.ok(!feed.some((x) => x.author.id === b.user.id), 'plain reposts go with the original');
  });
});

describe('notifications', () => {
  test('likes, comments, invites, accepts; only your own', async () => {
    const a = await signup(server);
    const b = await signup(server);
    const p = (await a.agent.post('/api/posts').send({ text: 'hi' })).body.post;
    await b.agent.post(`/api/posts/${p.id}/like`);
    await b.agent.post(`/api/posts/${p.id}/comments`).send({ text: 'yo' });
    await a.agent.post(`/api/posts/${p.id}/like`); // your own like: no notification
    let n = (await a.agent.get('/api/notifications')).body.notifications;
    assert.deepEqual(n.map((x) => x.type).sort(), ['comment', 'like']);
    assert.equal((await a.agent.get('/api/notifications/unread')).body.unread, 2);

    await b.agent.post(`/api/posts/${p.id}/like`); // unlike removes it
    n = (await a.agent.get('/api/notifications')).body.notifications;
    assert.deepEqual(n.map((x) => x.type), ['comment']);

    assert.equal((await b.agent.post(`/api/notifications/${n[0].id}/read`)).status, 404, 'cannot touch others');
    assert.equal((await a.agent.post('/api/notifications/read-all')).status, 204);
    assert.equal((await a.agent.get('/api/notifications/unread')).body.unread, 0);

    const inv = await b.agent.post(`/api/connections/request/${a.user.id}`);
    assert.equal((await a.agent.get('/api/notifications')).body.notifications[0].type, 'invite');
    await a.agent.post(`/api/connections/${inv.body.relationship.connectionId}/accept`);
    assert.ok(!(await a.agent.get('/api/notifications')).body.notifications.some((x) => x.type === 'invite'), 'invite cleared once accepted');
    assert.equal((await b.agent.get('/api/notifications')).body.notifications[0].type, 'accept');
  });
});

describe('jobs', () => {
  const job = { title: 'Designer', company: 'Acme', location: 'Lahore', workplace: 'Remote', type: 'Contract', description: 'Design things.', skills: ['Figma', 'Figma'] };

  test('post, search, apply, save, close, authorization', async () => {
    const a = await signup(server);
    const b = await signup(server);
    assert.equal((await a.agent.post('/api/jobs').send({ ...job, workplace: 'Moon' })).status, 400);
    assert.equal((await a.agent.post('/api/jobs').send({ ...job, title: '' })).status, 400);
    const created = await a.agent.post('/api/jobs').send(job);
    assert.equal(created.status, 201);
    const id = created.body.job.id;
    assert.deepEqual(created.body.job.skills, ['Figma']);

    assert.ok((await b.agent.get('/api/jobs?q=acme&workplace=Remote')).body.jobs.some((j) => j.id === id));
    assert.ok(!(await b.agent.get('/api/jobs?workplace=On-site')).body.jobs.some((j) => j.id === id));

    assert.equal((await a.agent.post(`/api/jobs/${id}/apply`)).status, 400, 'no applying to your own job');
    const ap = await b.agent.post(`/api/jobs/${id}/apply`).send({ note: 'Hire me' });
    assert.equal(ap.status, 201);
    assert.ok(ap.body.job.appliedAt);
    assert.equal(ap.body.job.applications, undefined, 'applicants hidden from non-posters');
    assert.equal((await b.agent.post(`/api/jobs/${id}/apply`)).status, 409);

    const forPoster = await a.agent.get(`/api/jobs/${id}`);
    assert.equal(forPoster.body.job.applications[0].note, 'Hire me');
    assert.equal((await a.agent.get('/api/notifications')).body.notifications[0].type, 'apply');

    assert.equal((await b.agent.post(`/api/jobs/${id}/save`)).body.job.savedByMe, true);
    const mine = (await b.agent.get('/api/jobs/mine')).body;
    assert.equal(mine.saved[0].id, id);
    assert.equal(mine.applied[0].id, id);

    assert.equal((await b.agent.put(`/api/jobs/${id}`).send({ closed: true })).status, 403);
    assert.equal((await a.agent.put(`/api/jobs/${id}`).send({ closed: true })).body.job.closed, true);
    assert.ok(!(await b.agent.get('/api/jobs')).body.jobs.some((j) => j.id === id), 'closed jobs leave the list');
    const c = await signup(server);
    assert.equal((await c.agent.post(`/api/jobs/${id}/apply`)).status, 400);

    assert.equal((await b.agent.delete(`/api/jobs/${id}`)).status, 403);
    assert.equal((await a.agent.delete(`/api/jobs/${id}`)).status, 204);
    assert.equal((await b.agent.get('/api/jobs/mine')).body.saved.length, 0);
  });

  test('account deletion removes applications and notifications', async () => {
    const a = await signup(server);
    const b = await signup(server);
    const id = (await a.agent.post('/api/jobs').send(job)).body.job.id;
    await b.agent.post(`/api/jobs/${id}/apply`);
    assert.equal((await b.agent.delete('/api/users/me').send({ password: b.body.password })).status, 204);
    assert.equal((await a.agent.get(`/api/jobs/${id}`)).body.job.applicantCount, 0);
    assert.equal((await a.agent.get('/api/notifications')).body.notifications.length, 0);
  });
});
