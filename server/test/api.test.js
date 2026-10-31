import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startDb, stopDb, app, signup } from './helpers.js';

let server;
before(async () => { await startDb(); server = app(); });
after(stopDb);

describe('auth', () => {
  test('signup, me, logout, login', async () => {
    const { agent, body, user } = await signup(server, { name: '  Iqra Rida ' });
    assert.equal(user.name, 'Iqra Rida');
    assert.equal(user.passwordHash, undefined);
    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.id, user.id);
    assert.match(me.headers['set-cookie']?.[0] ?? 'none', /none|HttpOnly/);

    assert.equal((await agent.post('/api/auth/logout')).status, 204);
    assert.equal((await agent.get('/api/auth/me')).status, 401);

    const bad = await agent.post('/api/auth/login').send({ email: body.email, password: 'wrong-pass' });
    assert.equal(bad.status, 401);
    const ok = await agent.post('/api/auth/login').send({ email: body.email.toUpperCase(), password: body.password });
    assert.equal(ok.status, 200);
    assert.match(ok.headers['set-cookie'][0], /HttpOnly/);
    assert.equal((await agent.get('/api/auth/me')).status, 200);
  });

  test('signup validation and duplicate email', async () => {
    const r = (b) => request(server).post('/api/auth/signup').send(b);
    assert.equal((await r({ name: 'A', email: 'nope', password: 'password123' })).status, 400);
    assert.equal((await r({ name: 'A', email: 'a@b.co', password: 'short' })).status, 400);
    assert.equal((await r({ name: '', email: 'a@b.co', password: 'password123' })).status, 400);
    assert.equal((await r({ name: 'A', email: { $gt: '' }, password: 'password123' })).status, 400);
    const { body } = await signup(server);
    const dup = await r({ name: 'B', email: body.email, password: 'password123' });
    assert.equal(dup.status, 409);
  });

  test('login rejects NoSQL operator injection', async () => {
    const res = await request(server).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 401);
  });

  test('protected routes need a session', async () => {
    for (const path of ['/api/posts', '/api/users/suggestions', '/api/connections', '/api/messages']) {
      assert.equal((await request(server).get(path)).status, 401, path);
    }
  });

  test('sign out everywhere invalidates other sessions', async () => {
    const { agent, body } = await signup(server);
    const other = request.agent(server);
    await other.post('/api/auth/login').send({ email: body.email, password: body.password });
    assert.equal((await other.get('/api/auth/me')).status, 200);
    assert.equal((await agent.post('/api/auth/logout-all')).status, 204);
    assert.equal((await other.get('/api/auth/me')).status, 401);
  });

  test('change password', async () => {
    const { agent, body } = await signup(server);
    assert.equal((await agent.put('/api/auth/password').send({ currentPassword: 'nope', newPassword: 'newpassword1' })).status, 400);
    assert.equal((await agent.put('/api/auth/password').send({ currentPassword: body.password, newPassword: 'newpassword1' })).status, 204);
    assert.equal((await agent.get('/api/auth/me')).status, 200, 'current device stays signed in');
    const login = await request(server).post('/api/auth/login').send({ email: body.email, password: 'newpassword1' });
    assert.equal(login.status, 200);
  });
});

describe('profiles', () => {
  test('edit own profile and view another', async () => {
    const a = await signup(server);
    const b = await signup(server);
    const put = await a.agent.put('/api/users/me').send({
      headline: 'Designer', location: 'Lahore', about: 'Hello', skills: ['Figma', 'Figma', 'Research'],
      experience: [{ title: 'Designer', company: 'Acme', start: '2022', end: 'Present' }],
    });
    assert.equal(put.status, 200);
    assert.deepEqual(put.body.user.skills, ['Figma', 'Research']);
    assert.equal(put.body.user.experience[0].company, 'Acme');

    const view = await b.agent.get(`/api/users/${a.user.id}`);
    assert.equal(view.status, 200);
    assert.equal(view.body.user.headline, 'Designer');
    assert.equal(view.body.relationship.status, 'none');
    assert.equal(view.body.user.email, undefined, 'email is private');

    assert.equal((await a.agent.put('/api/users/me').send({ name: '' })).status, 400);
    assert.equal((await a.agent.put('/api/users/me').send({ headline: 'x'.repeat(161) })).status, 400);
    assert.equal((await b.agent.get('/api/users/not-an-id')).status, 404);
    assert.equal((await b.agent.get('/api/users/64b7f0000000000000000000')).status, 404);
  });

  test('search and suggestions', async () => {
    const a = await signup(server, { name: 'Zainab Unique' });
    const b = await signup(server);
    const s = await b.agent.get('/api/users?q=zainab uni');
    assert.ok(s.body.users.some((u) => u.id === a.user.id));
    const s2 = await b.agent.get('/api/users?q=' + encodeURIComponent('.*'));
    assert.equal(s2.status, 200);
    const sug = await b.agent.get('/api/users/suggestions?limit=30');
    assert.ok(!sug.body.users.some((u) => u.id === b.user.id), 'never suggests yourself');
  });
});

describe('posts, likes, comments', () => {
  test('full flow with authorization', async () => {
    const a = await signup(server);
    const b = await signup(server);
    const created = await a.agent.post('/api/posts').send({ text: '  Hello #world  ' });
    assert.equal(created.status, 201);
    const id = created.body.post.id;
    assert.equal(created.body.post.text, 'Hello #world');
    assert.equal(created.body.post.author.id, a.user.id);

    assert.equal((await a.agent.post('/api/posts').send({ text: '   ' })).status, 400);
    assert.equal((await a.agent.post('/api/posts').send({ text: 'x'.repeat(3001) })).status, 400);

    const feed = await b.agent.get('/api/posts');
    assert.ok(feed.body.posts.some((p) => p.id === id));

    let like = await b.agent.post(`/api/posts/${id}/like`);
    assert.equal(like.body.post.likeCount, 1);
    assert.equal(like.body.post.likedByMe, true);
    like = await b.agent.post(`/api/posts/${id}/like`);
    assert.equal(like.body.post.likeCount, 0);

    const c = await b.agent.post(`/api/posts/${id}/comments`).send({ text: 'Nice post' });
    assert.equal(c.status, 201);
    assert.equal(c.body.post.comments[0].author.id, b.user.id);
    const commentId = c.body.post.comments[0].id;

    const third = await signup(server);
    assert.equal((await third.agent.delete(`/api/posts/${id}/comments/${commentId}`)).status, 403);
    const del = await a.agent.delete(`/api/posts/${id}/comments/${commentId}`);
    assert.equal(del.status, 200, 'post owner can remove comments');
    assert.equal(del.body.post.comments.length, 0);
    assert.equal((await b.agent.get(`/api/posts?author=${a.user.id}`)).body.posts[0].comments.length, 0, 'removal is saved');

    assert.equal((await b.agent.delete(`/api/posts/${id}`)).status, 403);
    assert.equal((await a.agent.delete(`/api/posts/${id}`)).status, 204);
    assert.equal((await b.agent.post(`/api/posts/${id}/like`)).status, 404);
  });

  test('feed pagination and author filter', async () => {
    const a = await signup(server);
    for (let i = 0; i < 5; i += 1) {
      await a.agent.post('/api/posts').send({ text: `post ${i}` });
      await new Promise((r) => setTimeout(r, 5));
    }
    const p1 = await a.agent.get(`/api/posts?author=${a.user.id}&limit=3`);
    assert.equal(p1.body.posts.length, 3);
    assert.equal(p1.body.posts[0].text, 'post 4');
    assert.ok(p1.body.nextCursor);
    const p2 = await a.agent.get(`/api/posts?author=${a.user.id}&limit=3&before=${encodeURIComponent(p1.body.nextCursor)}`);
    assert.deepEqual(p2.body.posts.map((p) => p.text), ['post 1', 'post 0']);
    assert.equal(p2.body.nextCursor, null);
    assert.equal((await a.agent.get('/api/posts?before=garbage')).status, 400);
  });
});

describe('connections and messaging', () => {
  test('invite, accept, message, remove', async () => {
    const a = await signup(server);
    const b = await signup(server);

    const blocked = await a.agent.post(`/api/messages/${b.user.id}`).send({ text: 'hi' });
    assert.equal(blocked.status, 403, 'cannot message strangers');

    const inv = await a.agent.post(`/api/connections/request/${b.user.id}`);
    assert.equal(inv.status, 201);
    assert.equal(inv.body.relationship.status, 'sent');
    assert.equal((await a.agent.post(`/api/connections/request/${a.user.id}`)).status, 400);

    const invites = await b.agent.get('/api/connections/invitations');
    assert.equal(invites.body.received.length, 1);
    const cid = invites.body.received[0].id;
    assert.equal((await a.agent.post(`/api/connections/${cid}/accept`)).status, 404, 'sender cannot accept own invite');
    const acc = await b.agent.post(`/api/connections/${cid}/accept`);
    assert.equal(acc.body.relationship.status, 'connected');

    const list = await a.agent.get('/api/connections');
    assert.equal(list.body.connections[0].user.id, b.user.id);

    const m1 = await a.agent.post(`/api/messages/${b.user.id}`).send({ text: 'Hello there' });
    assert.equal(m1.status, 201);
    assert.equal((await a.agent.post(`/api/messages/${b.user.id}`).send({ text: ' ' })).status, 400);
    assert.equal((await b.agent.get('/api/messages/unread')).body.unread, 1);

    const convs = await b.agent.get('/api/messages');
    assert.equal(convs.body.conversations[0].user.id, a.user.id);
    assert.equal(convs.body.conversations[0].unread, 1);

    const thread = await b.agent.get(`/api/messages/${a.user.id}`);
    assert.equal(thread.body.messages[0].text, 'Hello there');
    assert.equal(thread.body.canMessage, true);
    assert.equal((await b.agent.get('/api/messages/unread')).body.unread, 0, 'opening marks read');

    // A third person sees nothing of their conversation.
    const c = await signup(server);
    assert.equal((await c.agent.get('/api/messages')).body.conversations.length, 0);
    assert.equal((await c.agent.get(`/api/messages/${a.user.id}`)).body.messages.length, 0);
    assert.equal((await c.agent.delete(`/api/connections/${cid}`)).status, 404, 'outsider cannot remove');

    assert.equal((await a.agent.delete(`/api/connections/${cid}`)).status, 204);
    assert.equal((await a.agent.post(`/api/messages/${b.user.id}`).send({ text: 'still there?' })).status, 403);
  });

  test('mutual invites become a connection', async () => {
    const a = await signup(server);
    const b = await signup(server);
    await a.agent.post(`/api/connections/request/${b.user.id}`);
    const r = await b.agent.post(`/api/connections/request/${a.user.id}`);
    assert.equal(r.body.relationship.status, 'connected');
  });
});

describe('account deletion', () => {
  test('removes the person and their data', async () => {
    const a = await signup(server);
    const b = await signup(server);
    const post = (await b.agent.post('/api/posts').send({ text: 'B post' })).body.post;
    await a.agent.post(`/api/posts/${post.id}/like`);
    await a.agent.post(`/api/posts/${post.id}/comments`).send({ text: 'from A' });
    await a.agent.post('/api/posts').send({ text: 'A post' });

    assert.equal((await a.agent.delete('/api/users/me').send({ password: 'wrong' })).status, 400);
    assert.equal((await a.agent.delete('/api/users/me').send({ password: a.body.password })).status, 204);
    assert.equal((await a.agent.get('/api/auth/me')).status, 401);

    const feed = await b.agent.get('/api/posts?limit=50');
    const bp = feed.body.posts.find((p) => p.id === post.id);
    assert.equal(bp.likeCount, 0);
    assert.equal(bp.comments.length, 0);
    assert.ok(!feed.body.posts.some((p) => p.text === 'A post'));
    assert.equal((await b.agent.get(`/api/users/${a.user.id}`)).status, 404);
  });
});

test('unknown API route and bad JSON', async () => {
  assert.equal((await request(server).get('/api/nope')).status, 404);
  const bad = await request(server).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
  assert.equal(bad.status, 400);
});

describe('messaging replies and live updates', () => {
  async function connected() {
    const a = await signup(server);
    const b = await signup(server);
    await a.agent.post(`/api/connections/request/${b.user.id}`);
    await b.agent.post(`/api/connections/request/${a.user.id}`);
    return [a, b];
  }

  test('both people can send and receive replies', async () => {
    const [a, b] = await connected();
    assert.equal((await a.agent.post(`/api/messages/${b.user.id}`).send({ text: 'Hi B' })).status, 201);
    assert.equal((await b.agent.post(`/api/messages/${a.user.id}`).send({ text: 'Hi A, got it' })).status, 201);
    assert.equal((await a.agent.get('/api/messages/unread')).body.unread, 1, 'reply counts as unread');
    const thread = await a.agent.get(`/api/messages/${b.user.id}`);
    assert.deepEqual(thread.body.messages.map((m) => m.text), ['Hi B', 'Hi A, got it']);
    assert.equal(thread.body.messages[1].from, b.user.id);
    const convs = await a.agent.get('/api/messages');
    assert.equal(convs.body.conversations[0].last.text, 'Hi A, got it');
  });

  test('long threads show the newest messages', async () => {
    const [a, b] = await connected();
    const { default: Message } = await import('../src/models/Message.js');
    const t0 = Date.now() - 1e6;
    await Message.insertMany(Array.from({ length: 510 }, (_, i) => ({ from: a.user.id, to: b.user.id, text: `old ${i}`, createdAt: new Date(t0 + i * 1000) })));
    await b.agent.post(`/api/messages/${a.user.id}`).send({ text: 'newest reply' });
    const msgs = (await a.agent.get(`/api/messages/${b.user.id}`)).body.messages;
    assert.equal(msgs.length, 500);
    assert.equal(msgs.at(-1).text, 'newest reply');
    assert.ok(new Date(msgs[0].createdAt) < new Date(msgs.at(-1).createdAt), 'oldest first');
  });

  test('new messages are pushed over the live stream', async () => {
    const [a, b] = await connected();
    const http = server.listen(0);
    try {
      const base = `http://127.0.0.1:${http.address().port}`;
      const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: b.body.email, password: b.body.password }) });
      const cookie = login.headers.get('set-cookie').split(';')[0];
      const ctrl = new AbortController();
      const stream = await fetch(`${base}/api/messages/stream`, { headers: { cookie }, signal: ctrl.signal });
      assert.equal(stream.status, 200);
      assert.match(stream.headers.get('content-type'), /text\/event-stream/);
      const reader = stream.body.getReader();
      const sent = await a.agent.post(`/api/messages/${b.user.id}`).send({ text: 'live hello' });
      let buf = '';
      while (!buf.includes('live hello')) buf += new TextDecoder().decode((await reader.read()).value);
      assert.match(buf, /event: message/);
      assert.ok(buf.includes(sent.body.message.id));
      ctrl.abort();
      assert.equal((await request(server).get('/api/messages/stream')).status, 401, 'stream needs sign-in');
    } finally { http.close(); }
  });
});
