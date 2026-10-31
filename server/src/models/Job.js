import mongoose from 'mongoose';

export const WORKPLACES = ['On-site', 'Hybrid', 'Remote'];
export const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

const applicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: true }
);

const jobSchema = new mongoose.Schema(
  {
    poster: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    company: { type: String, required: true, trim: true, maxlength: 100 },
    location: { type: String, trim: true, maxlength: 100, default: '' },
    workplace: { type: String, enum: WORKPLACES, default: 'On-site' },
    type: { type: String, enum: JOB_TYPES, default: 'Full-time' },
    salary: { type: String, trim: true, maxlength: 60, default: '' },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    skills: { type: [String], default: [] },
    applications: { type: [applicationSchema], default: [] },
    closed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

jobSchema.index({ createdAt: -1 });
jobSchema.index({ 'applications.user': 1 });

export default mongoose.model('Job', jobSchema);
