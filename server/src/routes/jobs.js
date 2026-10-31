import { Router } from 'express';
import Job, { JOB_TYPES, WORKPLACES } from '../models/Job.js';
import User, { PUBLIC_FIELDS } from '../models/User.js';
import Notification from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, HttpError, text, validId } from '../middleware/errors.js';
import { brief, notify } from '../lib.js';

const router = Router();
router.use(requireAuth);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function serialize(job, meId, savedIds) {
  const me = meId.toString();
  const isPoster = job.poster._id.toString() === me;
  const mine = job.applications.find((a) => a.user?._id.toString() === me);
  return {
    id: job._id.toString(),
    poster: brief(job.poster),
    title: job.title,
    company: job.company,
    location: job.location,
    workplace: job.workplace,
    type: job.type,
    salary: job.salary,
    description: job.description,
    skills: job.skills,
    closed: job.closed,
    createdAt: job.createdAt,
    applicantCount: job.applications.length,
    appliedAt: mine ? mine.createdAt : null,
    savedByMe: savedIds.has(job._id.toString()),
    isPoster,
    // Only the person who posted the job sees who applied.
    applications: isPoster
      ? job.applications.filter((a) => a.user?.name).map((a) => ({ id: a._id.toString(), user: brief(a.user), note: a.note, createdAt: a.createdAt }))
      : undefined,
  };
}

const withPeople = (q) => q.populate('poster', PUBLIC_FIELDS).populate('applications.user', PUBLIC_FIELDS);

async function savedSet(meId) {
  const me = await User.findById(meId).select('+savedJobs');
  return new Set((me?.savedJobs || []).map(String));
}

async function load(id) {
  const job = await withPeople(Job.findById(validId(id)));
  if (!job || !job.poster) throw new HttpError(404, 'This job was removed or never existed.');
  return job;
}

function fields(b) {
  const pick = (v, list, field) => {
    if (v === undefined) return list[0];
    if (!list.includes(v)) throw new HttpError(400, `${field} must be one of: ${list.join(', ')}.`);
    return v;
  };
  if (b.skills !== undefined && !Array.isArray(b.skills)) throw new HttpError(400, 'Skills must be a list.');
  return {
    title: text(b.title, 'Job title', 100),
    company: text(b.company, 'Company', 100),
    location: text(b.location, 'Location', 100, { required: false }),
    workplace: pick(b.workplace, WORKPLACES, 'Workplace'),
    type: pick(b.type, JOB_TYPES, 'Job type'),
    salary: text(b.salary, 'Salary', 60, { required: false }),
    description: text(b.description, 'Description', 5000),
    skills: [...new Set((b.skills || []).map((s) => text(s, 'Skill', 40)))].slice(0, 15),
  };
}

// Open jobs, newest first. Filters: ?q= (title, company, skills), ?location=, ?workplace=, ?type=
router.get('/', ah(async (req, res) => {
  const filter = { closed: false };
  const str = (v) => (typeof v === 'string' ? v.trim().slice(0, 80) : '');
  const q = str(req.query.q);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { company: rx }, { skills: rx }];
  }
  const loc = str(req.query.location);
  if (loc) filter.location = new RegExp(escapeRegex(loc), 'i');
  if (WORKPLACES.includes(req.query.workplace)) filter.workplace = req.query.workplace;
  if (JOB_TYPES.includes(req.query.type)) filter.type = req.query.type;
  const [jobs, saved] = await Promise.all([withPeople(Job.find(filter).sort({ createdAt: -1 }).limit(50)), savedSet(req.user._id)]);
  res.json({ jobs: jobs.filter((j) => j.poster).map((j) => serialize(j, req.user._id, saved)) });
}));

// Your jobs: saved, applied to, and posted by you (open and closed).
router.get('/mine', ah(async (req, res) => {
  const me = req.user._id;
  const saved = await savedSet(me);
  const [savedJobs, applied, posted] = await Promise.all([
    withPeople(Job.find({ _id: { $in: [...saved] } }).sort({ createdAt: -1 })),
    withPeople(Job.find({ 'applications.user': me }).sort({ createdAt: -1 })),
    withPeople(Job.find({ poster: me }).sort({ createdAt: -1 })),
  ]);
  const s = (list) => list.filter((j) => j.poster).map((j) => serialize(j, me, saved));
  res.json({ saved: s(savedJobs), applied: s(applied), posted: s(posted) });
}));

router.get('/:id', ah(async (req, res) => {
  res.json({ job: serialize(await load(req.params.id), req.user._id, await savedSet(req.user._id)) });
}));

router.post('/', ah(async (req, res) => {
  const job = await Job.create({ poster: req.user._id, ...fields(req.body || {}) });
  res.status(201).json({ job: serialize(await load(job._id), req.user._id, new Set()) });
}));

// Edit a job you posted, or close / reopen it with { closed: true | false }.
router.put('/:id', ah(async (req, res) => {
  const job = await load(req.params.id);
  if (!job.poster._id.equals(req.user._id)) throw new HttpError(403, 'You can only edit jobs you posted.');
  const b = req.body || {};
  if ('closed' in b) {
    if (typeof b.closed !== 'boolean') throw new HttpError(400, 'closed must be true or false.');
    job.closed = b.closed;
  }
  if ('title' in b) Object.assign(job, fields(b));
  await job.save();
  res.json({ job: serialize(await load(job._id), req.user._id, await savedSet(req.user._id)) });
}));

router.delete('/:id', ah(async (req, res) => {
  const job = await load(req.params.id);
  if (!job.poster._id.equals(req.user._id)) throw new HttpError(403, 'You can only delete jobs you posted.');
  await job.deleteOne();
  await Promise.all([Notification.deleteMany({ job: job._id }), User.updateMany({ savedJobs: job._id }, { $pull: { savedJobs: job._id } })]);
  res.status(204).end();
}));

router.post('/:id/apply', ah(async (req, res) => {
  const job = await load(req.params.id);
  const me = req.user._id;
  if (job.poster._id.equals(me)) throw new HttpError(400, 'You cannot apply to a job you posted.');
  if (job.closed) throw new HttpError(400, 'This job is no longer accepting applications.');
  if (job.applications.some((a) => a.user?._id.equals(me))) throw new HttpError(409, 'You already applied to this job.');
  job.applications.push({ user: me, note: text(req.body?.note, 'Note', 2000, { required: false }) });
  await job.save();
  await notify(job.poster._id, me, 'apply', { job: job._id });
  res.status(201).json({ job: serialize(await load(job._id), me, await savedSet(me)) });
}));

// Toggle saved.
router.post('/:id/save', ah(async (req, res) => {
  const job = await load(req.params.id);
  const me = await User.findById(req.user._id).select('+savedJobs');
  const saved = me.savedJobs.some((id) => id.equals(job._id));
  me.savedJobs = saved ? me.savedJobs.filter((id) => !id.equals(job._id)) : [...me.savedJobs, job._id].slice(-500);
  await me.save();
  res.json({ job: serialize(job, req.user._id, new Set(me.savedJobs.map(String))) });
}));

export default router;
