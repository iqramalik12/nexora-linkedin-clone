// Fills the database with sample people, posts, connections and messages.
// Every person here is made up. Run: npm run seed  (wipes existing data first)
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Post from './models/Post.js';
import Connection from './models/Connection.js';
import Message from './models/Message.js';
import Job from './models/Job.js';
import Notification from './models/Notification.js';

export const DEMO = { email: 'iqra@nexora.dev', password: 'nexora123' };

const people = [
  { name: 'Iqra Rida', email: DEMO.email, headline: 'Product Designer · Building calm interfaces for busy teams', location: 'Lahore, Punjab', avatarColor: '#7a4fa8',
    about: 'I design tools that help small teams do focused work. Currently leading design for onboarding and collaboration features.',
    skills: ['Product design', 'Design systems', 'Prototyping', 'User research', 'Accessibility'],
    experience: [{ title: 'Product Designer', company: 'Brightpath', start: '2023', end: 'Present' }, { title: 'UI Designer', company: 'Pixel Lane Studio', start: '2020', end: '2023' }] },
  { name: 'Ayesha Siddiqui', email: 'ayesha@nexora.dev', headline: 'Head of Design at Brightpath · Mentor', location: 'Karachi, Sindh', avatarColor: '#2c6e8f' },
  { name: 'Bilal Qureshi', email: 'bilal@nexora.dev', headline: 'Frontend Engineer · CSS, accessibility, performance', location: 'Islamabad', avatarColor: '#b4532a' },
  { name: 'Sana Mirza', email: 'sana@nexora.dev', headline: 'Career coach for designers and researchers', location: 'Lahore, Punjab', avatarColor: '#8a3b6b' },
  { name: 'Hamza Aslam', email: 'hamza@nexora.dev', headline: 'Staff Engineer at Northwind Labs · Writes about systems design', location: 'Remote', avatarColor: '#9a5b13' },
  { name: 'Maryam Khalid', email: 'maryam@nexora.dev', headline: 'Talent Partner · Hiring designers across South Asia', location: 'Dubai', avatarColor: '#4f7a2b' },
  { name: 'Usman Tariq', email: 'usman@nexora.dev', headline: 'Data Analyst · SQL, dashboards, storytelling', location: 'Faisalabad', avatarColor: '#3d5a99' },
];

// Sample accounts other than the demo sign-in. Used for demo auto-replies in messaging.
export const SAMPLE_EMAILS = people.map((p) => p.email).filter((e) => e !== DEMO.email);

const posts = [
  ['ayesha', 'Six weeks ago our onboarding flow lost more than half of new users before the first project. We cut it from nine screens to four, moved the workspace invite after the first win, and rewrote every empty state.\n\nCompletion went from 41% to 68%. The biggest lift came from the empty states, not the screen count. #productdesign #ux', 3],
  ['bilal', 'Small accessibility habit that pays off every week: test every new component with only the keyboard before you open a pull request. Tab through it, press Enter and Space, try Escape.\n\nIt takes two minutes and catches focus traps, missing labels and buttons built from divs.', 6],
  ['sana', 'A portfolio case study that gets interviews answers three questions in the first screen: what was the problem, what did you do, and what changed.\n\nRecruiters skim, so lead with the outcome and let the curious ones scroll.', 26],
  ['hamza', 'Boring technology is a feature. Our team moved a queue from a shiny new broker back to Postgres and on-call pages dropped by two thirds.', 40],
  ['maryam', 'We are hiring two product designers for a fintech team in Dubai. Remote friendly within GMT+3 to GMT+6. Send me a message with your portfolio link. #hiring', 52],
];

export async function seed() {
  await Promise.all([User.deleteMany({}), Post.deleteMany({}), Connection.deleteMany({}), Message.deleteMany({}), Job.deleteMany({}), Notification.deleteMany({})]);
  const hash = await bcrypt.hash(DEMO.password, 10);
  const users = await User.insertMany(people.map((p) => ({ ...p, passwordHash: hash, profileViews: Math.floor(Math.random() * 150) })));
  const by = Object.fromEntries(users.map((u) => [u.email.split('@')[0], u]));
  const me = by.iqra;

  const now = Date.now();
  for (const [who, text, hoursAgo] of posts) {
    const at = new Date(now - hoursAgo * 3600e3);
    await Post.create({
      author: by[who]._id, text, createdAt: at, updatedAt: at,
      likes: users.filter((u) => u._id !== by[who]._id).slice(0, 2 + (hoursAgo % 4)).map((u) => u._id),
      comments: who === 'ayesha' ? [{ author: by.bilal._id, text: 'The empty state point is so true. Would love to see before and after screens.' }] : [],
    });
  }

  await Connection.create([
    { requester: me._id, recipient: by.ayesha._id, status: 'accepted' },
    { requester: by.bilal._id, recipient: me._id, status: 'accepted' },
    { requester: me._id, recipient: by.sana._id, status: 'accepted' },
    { requester: by.maryam._id, recipient: me._id, status: 'pending' },
    { requester: by.usman._id, recipient: me._id, status: 'pending' },
  ]);

  const t = (m) => new Date(now - m * 60e3);
  await Message.create([
    { from: by.ayesha._id, to: me._id, text: 'Hi Iqra! Are you joining the design systems meetup next week?', createdAt: t(180), readAt: t(170) },
    { from: me._id, to: by.ayesha._id, text: 'Yes, I will be there. Want to grab chai before it starts?', createdAt: t(160) },
    { from: by.ayesha._id, to: me._id, text: 'Perfect, see you at 5:30.', createdAt: t(20) },
    { from: by.bilal._id, to: me._id, text: 'Thanks for the review on the button component, merged it this morning.', createdAt: t(600) },
  ]);
  await seedJobs();
  return { users: users.length };
}

const jobs = [
  ['maryam', 'Senior Product Designer', 'Fintrail', 'Dubai', 'Hybrid', 'Full-time', 'AED 22k–28k / month', ['Product design', 'Figma', 'Design systems'],
    'Fintrail builds money tools for freelancers across the Gulf and South Asia. You will own the end-to-end design of our invoicing and payouts flows, work closely with two engineers and a PM, and help grow our design system.\n\nYou have 5+ years designing web or mobile products, a portfolio that shows how you reason about trade-offs, and comfort presenting to leadership.', 30],
  ['maryam', 'Product Designer', 'Fintrail', 'Remote (GMT+3 to GMT+6)', 'Remote', 'Full-time', '', ['Product design', 'Prototyping', 'User research'],
    'Join a small team designing onboarding and identity verification. You will run quick research rounds, prototype in Figma and ship weekly.\n\n2+ years of product design experience. Fintech is a plus, not a requirement.', 50],
  ['hamza', 'Backend Engineer (Node.js)', 'Northwind Labs', 'Islamabad', 'On-site', 'Full-time', 'PKR 450k–650k / month', ['Node.js', 'PostgreSQL', 'System design'],
    'We run logistics software for 300+ warehouses. You will build APIs, own background jobs and help us keep on-call quiet.\n\nYou write clear code, test what matters, and like boring technology.', 70],
  ['ayesha', 'Design Intern', 'Brightpath', 'Karachi', 'Hybrid', 'Internship', 'Paid', ['Figma', 'Visual design'],
    'A three-month paid internship on the Brightpath design team. You will pair with a senior designer on real features and present your work at the end.\n\nStudents and recent graduates welcome. Share a portfolio, even a small one.', 120],
  ['usman', 'Data Analyst', 'Kitebird Retail', 'Faisalabad', 'On-site', 'Contract', '6-month contract', ['SQL', 'Dashboards', 'Excel'],
    'Help our merchandising team understand what sells. You will build dashboards, clean messy sales data and present findings every two weeks.', 200],
];

// Sample jobs and a few notifications for the demo person. Safe to call on a database seeded before jobs existed.
export async function seedJobs() {
  const users = await User.find({ email: { $in: [DEMO.email, ...SAMPLE_EMAILS] } });
  const by = Object.fromEntries(users.map((u) => [u.email.split('@')[0], u]));
  const me = by.iqra;
  if (!me) return 0;
  const now = Date.now();
  const created = await Job.insertMany(jobs.filter(([who]) => by[who]).map(([who, title, company, location, workplace, type, salary, skills, description, hoursAgo]) => {
    const at = new Date(now - hoursAgo * 3600e3);
    const applications = ['bilal', 'usman'].filter((x) => x !== who && by[x]).slice(0, hoursAgo % 3).map((x) => ({ user: by[x]._id, note: '', createdAt: at, updatedAt: at }));
    return { poster: by[who]._id, title, company, location, workplace, type, salary, skills, description, applications, createdAt: at, updatedAt: at };
  }));
  const post = await Post.findOne({ author: { $ne: me._id } }).sort({ createdAt: -1 });
  const mine = await Post.create({ author: me._id, text: 'Shipped a new onboarding checklist this week. Small change, but support tickets about setup dropped noticeably. #productdesign', createdAt: new Date(now - 5 * 3600e3), likes: [by.ayesha, by.bilal].filter(Boolean).map((u) => u._id) });
  const t = (h) => new Date(now - h * 3600e3);
  await Notification.insertMany([
    by.ayesha && { user: me._id, actor: by.ayesha._id, type: 'like', post: mine._id, createdAt: t(4) },
    by.bilal && { user: me._id, actor: by.bilal._id, type: 'like', post: mine._id, createdAt: t(3) },
    by.maryam && { user: me._id, actor: by.maryam._id, type: 'invite', createdAt: t(20) },
    by.usman && { user: me._id, actor: by.usman._id, type: 'invite', createdAt: t(26), readAt: t(25) },
    by.sana && post && { user: me._id, actor: by.sana._id, type: 'accept', createdAt: t(48), readAt: t(47) },
  ].filter(Boolean));
  return created.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.MONGODB_URI === 'embedded') {
    console.log('With the built-in database, sample data loads automatically the first time the app starts.');
    console.log('To start over: stop the app, delete the server/.data folder, then run npm run dev again.');
    process.exit(0);
  }
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nexora');
  const r = await seed();
  console.log(`Seeded ${r.users} people. Sign in as ${DEMO.email} / ${DEMO.password}`);
  await mongoose.disconnect();
}
