import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';

process.env.NODE_ENV = 'test';
let mem;

// Uses TEST_MONGODB_URI when set (any MongoDB-compatible server), otherwise starts mongodb-memory-server.
export async function startDb() {
  let uri = process.env.TEST_MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mem = await MongoMemoryServer.create();
    uri = mem.getUri();
  }
  const db = `nexora_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await mongoose.connect(uri, { dbName: db });
}

export async function stopDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mem) await mem.stop();
}

export const app = () => createApp();

let n = 0;
export async function signup(server, overrides = {}) {
  const agent = request.agent(server);
  n += 1;
  const body = { name: `Test Person ${n}`, email: `person${n}_${Date.now()}@example.com`, password: 'password123', ...overrides };
  const res = await agent.post('/api/auth/signup').send(body);
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user, body };
}
