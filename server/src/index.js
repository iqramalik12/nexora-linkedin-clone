import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import User from './models/User.js';
import Job from './models/Job.js';
import { DEMO, seed, seedJobs } from './seed.js';

const port = Number(process.env.PORT) || 4000;
let uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexora';

// MONGODB_URI=embedded runs a private MongoDB for this app, with no separate install.
// Data is kept in server/.data/db between restarts. The first start downloads MongoDB (~100 MB).
if (uri === 'embedded') {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.data/db');
  fs.mkdirSync(dbPath, { recursive: true });
  console.log('Starting the built-in database (the first start downloads MongoDB, please wait)…');
  const mem = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger', port: 27018 } });
  uri = mem.getUri('nexora');
  const stop = async () => { await mongoose.disconnect().catch(() => {}); await mem.stop({ doCleanup: false }); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

await mongoose.connect(uri);
console.log(`MongoDB connected: ${uri.replace(/\/\/[^@]*@/, '//***@')}`);

// First run on an empty database: load the sample people so the demo sign-in works.
// Set SEED_DEMO=false to turn this off (it is always off in production).
if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO !== 'false' && (await User.estimatedDocumentCount()) === 0) {
  const r = await seed();
  console.log(`Empty database: loaded ${r.users} sample people. Sign in as ${DEMO.email} / ${DEMO.password}`);
}

// Databases seeded before jobs existed get the sample jobs once.
if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO !== 'false' && (await Job.estimatedDocumentCount()) === 0) {
  const n = await seedJobs();
  if (n) console.log(`Loaded ${n} sample jobs.`);
}

createApp().listen(port, () => console.log(`Nexora API on http://localhost:${port}`));
