import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb, app, signup } from './helpers.js';

let server;
before(async () => { await startDb(); server = app(); });
after(stopDb);

test('top sort ranks by engagement and pages by offset', async () => {
  const a = await signup(server);
  const b = await signup(server);
  const quiet = (await a.agent.post('/api/posts').send({ text: 'quiet' })).body.post;
  const busy = (await a.agent.post('/api/posts').send({ text: 'busy' })).body.post;
  const newest = (await a.agent.post('/api/posts').send({ text: 'newest' })).body.post;
  await b.agent.post(`/api/posts/${busy.id}/like`);
  await b.agent.post(`/api/posts/${busy.id}/comments`).send({ text: 'great' });

  const top = await b.agent.get('/api/posts?sort=top&limit=2');
  assert.equal(top.status, 200);
  assert.equal(top.body.posts[0].id, busy.id);
  assert.equal(top.body.nextCursor, 'offset:2');
  const next = await b.agent.get(`/api/posts?sort=top&limit=2&before=${top.body.nextCursor}`);
  assert.deepEqual([...top.body.posts, ...next.body.posts].map((p) => p.id).sort(), [quiet.id, busy.id, newest.id].sort());
  assert.equal(next.body.nextCursor, null);
  assert.equal((await b.agent.get('/api/posts?sort=top&before=2020-01-01')).status, 400);
});

test('posts carry your connection to the author; stats count reactions', async () => {
  const a = await signup(server);
  const b = await signup(server);
  const p = (await a.agent.post('/api/posts').send({ text: 'hi' })).body.post;
  assert.equal(p.authorStatus, 'self');
  const one = async () => (await b.agent.get(`/api/posts/${p.id}`)).body.post.authorStatus;
  assert.equal(await one(), 'none');
  const inv = await b.agent.post(`/api/connections/request/${a.user.id}`);
  assert.equal(await one(), 'sent');
  await a.agent.post(`/api/connections/${inv.body.relationship.connectionId}/accept`);
  assert.equal(await one(), 'connected');

  await b.agent.post(`/api/posts/${p.id}/like`);
  await b.agent.post(`/api/posts/${p.id}/comments`).send({ text: 'nice' });
  assert.equal((await a.agent.get('/api/users/me/stats')).body.reactions, 2);
});
