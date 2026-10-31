import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { fmt, timeAgo } from '../lib/format.js';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';

const WORKPLACES = ['On-site', 'Hybrid', 'Remote'];
const TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

const where = (j) => [j.company, j.location].filter(Boolean).join(' · ');

function CompanyLogo({ name, size = 48 }) {
  // A tile with the company initial, coloured from the name so each company keeps its colour.
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return <span className="co-logo" style={{ width: size, height: size, background: `hsl(${hue} 45% 38%)`, fontSize: size * 0.42 }} aria-hidden="true">{name.trim()[0]?.toUpperCase() || '?'}</span>;
}

function JobForm({ job, onClose, onSaved }) {
  const [f, setF] = useState({
    title: job?.title || '', company: job?.company || '', location: job?.location || '',
    workplace: job?.workplace || 'On-site', type: job?.type || 'Full-time', salary: job?.salary || '',
    description: job?.description || '', skills: (job?.skills || []).join(', '),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    setBusy(true); setError('');
    try {
      const body = { ...f, skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean) };
      const d = job ? await api.put(`/jobs/${job.id}`, body) : await api.post('/jobs', body);
      onSaved(d.job); // the caller closes the form
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <Modal title={job ? 'Edit job' : 'Post a job'} onClose={onClose}
      footer={<button className="btn btn-primary" type="button" disabled={busy || !f.title.trim() || !f.company.trim() || !f.description.trim()} onClick={save}>{busy ? 'Saving…' : job ? 'Save' : 'Post job'}</button>}>
      <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="field"><label htmlFor="j-title">Job title</label><input id="j-title" className="input" maxLength={100} placeholder="Product Designer" value={f.title} onChange={set('title')} /></div>
        <div className="field"><label htmlFor="j-company">Company</label><input id="j-company" className="input" maxLength={100} value={f.company} onChange={set('company')} /></div>
        <div className="grid-2">
          <div className="field"><label htmlFor="j-workplace">Workplace type</label><select id="j-workplace" className="input" value={f.workplace} onChange={set('workplace')}>{WORKPLACES.map((w) => <option key={w}>{w}</option>)}</select></div>
          <div className="field"><label htmlFor="j-type">Job type</label><select id="j-type" className="input" value={f.type} onChange={set('type')}>{TYPES.map((w) => <option key={w}>{w}</option>)}</select></div>
        </div>
        <div className="grid-2">
          <div className="field"><label htmlFor="j-location">Location</label><input id="j-location" className="input" maxLength={100} placeholder="Lahore, Punjab" value={f.location} onChange={set('location')} /></div>
          <div className="field"><label htmlFor="j-salary">Salary (optional)</label><input id="j-salary" className="input" maxLength={60} placeholder="PKR 300k–400k / month" value={f.salary} onChange={set('salary')} /></div>
        </div>
        <div className="field"><label htmlFor="j-desc">Description</label><textarea id="j-desc" className="textarea" style={{ minHeight: 160 }} maxLength={5000} placeholder="What the role involves and who you are looking for." value={f.description} onChange={set('description')} /></div>
        <div className="field"><label htmlFor="j-skills">Skills</label><input id="j-skills" className="input" placeholder="Figma, User research" value={f.skills} onChange={set('skills')} /><span className="hint">Separate skills with commas. Up to 15.</span></div>
      </div>
    </Modal>
  );
}

function ApplyModal({ job, onClose, onApplied }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function apply() {
    setBusy(true); setError('');
    try { onApplied((await api.post(`/jobs/${job.id}/apply`, { note })).job); onClose(); }
    catch (e) { setError(e.message); setBusy(false); }
  }
  return (
    <Modal title={`Apply to ${job.company}`} onClose={onClose}
      footer={<><button className="btn btn-plain" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="button" disabled={busy} onClick={apply}>{busy ? 'Sending…' : 'Submit application'}</button></>}>
      <div className="modal-body">
        <p style={{ margin: 0 }}>Your Nexora profile is shared with <b>{job.poster.name}</b> as your application for <b>{job.title}</b>.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="field"><label htmlFor="apply-note">Note to the hiring team (optional)</label><textarea id="apply-note" className="textarea" maxLength={2000} placeholder="Why you are a good fit, a portfolio link, when you can start…" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function JobDetail({ job, onChange, onRemoved, onBack }) {
  const toast = useToast();
  const [applying, setApplying] = useState(false);
  const [editing, setEditing] = useState(false);

  async function save() {
    try { onChange((await api.post(`/jobs/${job.id}/save`)).job); } catch (e) { toast(e.message); }
  }
  async function setClosed(closed) {
    try { onChange((await api.put(`/jobs/${job.id}`, { closed })).job); toast(closed ? 'Job closed. It no longer accepts applications.' : 'Job reopened'); }
    catch (e) { toast(e.message); }
  }
  async function remove() {
    if (!window.confirm('Delete this job and its applications?')) return;
    try { await api.del(`/jobs/${job.id}`); onRemoved(job.id); toast('Job deleted'); } catch (e) { toast(e.message); }
  }

  return (
    <article className="job-detail" aria-labelledby="jd-title">
      <button className="btn btn-plain show-phone-only" type="button" onClick={onBack} style={{ justifySelf: 'start', marginBottom: 8 }}><Icon name="arrowLeft" size="xs" />All jobs</button>
      <div className="jd-co"><CompanyLogo name={job.company} size={40} /><span>{job.company}</span></div>
      <h2 id="jd-title" className="jd-title">{job.title}</h2>
      <p className="muted" style={{ margin: '4px 0 0' }}>{[job.location, `Posted ${timeAgo(job.createdAt)}`,`${fmt(job.applicantCount)} ${job.applicantCount === 1 ? 'applicant' : 'applicants'}`].filter(Boolean).join(' · ')}</p>
      <div className="chips" style={{ marginTop: 12 }}>
        <span className="chip"><Icon name="briefcase" size="xs" />{job.workplace}</span>
        <span className="chip">{job.type}</span>
        {job.salary && <span className="chip">{job.salary}</span>}
        {job.closed && <span className="chip chip-danger">Closed</span>}
      </div>
      <div className="p-actions">
        {job.isPoster ? (
          <>
            <button className="btn btn-primary" type="button" onClick={() => setEditing(true)}><Icon name="pencil" size="xs" />Edit</button>
            <button className="btn btn-secondary" type="button" onClick={() => setClosed(!job.closed)}>{job.closed ? 'Reopen job' : 'Close job'}</button>
            <button className="btn btn-plain" type="button" onClick={remove}><Icon name="trash" size="xs" />Delete</button>
          </>
        ) : (
          <>
            {job.appliedAt
              ? <span className="applied"><Icon name="check" size="sm" />Applied {timeAgo(job.appliedAt)}</span>
              : <button className="btn btn-primary" type="button" disabled={job.closed} onClick={() => setApplying(true)}>{job.closed ? 'No longer accepting applications' : 'Easy Apply'}</button>}
            <button className="btn btn-secondary" type="button" aria-pressed={job.savedByMe} onClick={save}><Icon name="bookmark" size="xs" />{job.savedByMe ? 'Saved' : 'Save'}</button>
          </>
        )}
      </div>

      <section className="jd-section" aria-labelledby="jd-poster">
        <h3 id="jd-poster">Meet the hiring team</h3>
        <Link className="person-row" to={`/in/${job.poster.id}`} style={{ textDecoration: 'none' }}>
          <Avatar user={job.poster} size={48} />
          <div className="info"><div className="person-name">{job.poster.name}</div><div className="person-desc">{job.poster.headline}</div><div className="small muted">Job poster</div></div>
        </Link>
        {!job.isPoster && <Link className="btn btn-secondary" to={`/messaging/${job.poster.id}`} style={{ marginTop: 4 }}><Icon name="send" size="xs" />Message</Link>}
      </section>

      <section className="jd-section" aria-labelledby="jd-about">
        <h3 id="jd-about">About the job</h3>
        <p className="about">{job.description}</p>
        {job.skills.length > 0 && <><h4 style={{ margin: '16px 0 8px' }}>Skills</h4><div className="chips">{job.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</div></>}
      </section>

      {job.isPoster && (
        <section className="jd-section" aria-labelledby="jd-apps">
          <h3 id="jd-apps">Applicants ({fmt(job.applications.length)})</h3>
          {job.applications.length === 0 && <p className="muted" style={{ margin: 0 }}>No applications yet. Share the job with your network.</p>}
          {job.applications.map((a) => (
            <div className="applicant" key={a.id}>
              <Link to={`/in/${a.user.id}`} tabIndex={-1}><Avatar user={a.user} size={48} /></Link>
              <div className="info">
                <Link className="person-name" to={`/in/${a.user.id}`}>{a.user.name}</Link>
                <div className="person-desc">{a.user.headline}</div>
                <div className="small muted">Applied {timeAgo(a.createdAt)}</div>
                {a.note && <p className="applicant-note">{a.note}</p>}
              </div>
              <Link className="btn btn-secondary" to={`/messaging/${a.user.id}`}>Message</Link>
            </div>
          ))}
        </section>
      )}
      {applying && <ApplyModal job={job} onClose={() => setApplying(false)} onApplied={(j) => { onChange(j); toast('Application sent'); }} />}
      {editing && <JobForm job={job} onClose={() => setEditing(false)} onSaved={(j) => { onChange(j); setEditing(false); toast('Job updated'); }} />}
    </article>
  );
}

function JobRow({ job, active, onSelect }) {
  return (
    <button type="button" className={`job-row${active ? ' active' : ''}`} aria-current={active || undefined} onClick={() => onSelect(job.id)}>
      <CompanyLogo name={job.company} />
      <span className="info">
        <span className="job-title">{job.title}</span>
        <span className="person-desc">{where(job)}</span>
        <span className="small muted">{job.workplace} · {job.type}{job.salary ? ` · ${job.salary}` : ''}</span>
        <span className="small job-flags">
          {job.closed && <span className="flag-closed">Closed</span>}
          {job.appliedAt && <span className="flag-ok">Applied</span>}
          {job.isPoster && <span>Posted by you · {fmt(job.applicantCount)} applicants</span>}
          {!job.isPoster && !job.appliedAt && <span className="muted">{timeAgo(job.createdAt)}</span>}
        </span>
      </span>
      {job.savedByMe && <Icon name="bookmark" size="sm" className="job-saved" label="Saved" />}
    </button>
  );
}

const MINE = [['saved', 'Saved'], ['applied', 'Applied'], ['posted', 'Posted by you']];

export default function Jobs() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'search';
  const selectedId = params.get('id');
  const [q, setQ] = useState(params.get('q') || '');
  const [loc, setLoc] = useState(params.get('location') || '');
  const [jobs, setJobs] = useState(null);
  const [mine, setMine] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(params.get('post') === '1');
  useEffect(() => { if (params.get('post') === '1') setPosting(true); }, [params]);
  const toast = useToast();

  const setParam = (changes) => setParams((p) => {
    const n = new URLSearchParams(p);
    Object.entries(changes).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    return n;
  }, { replace: true });

  const query = ['q', 'location', 'workplace', 'type'].map((k) => `${k}=${encodeURIComponent(params.get(k) || '')}`).join('&');
  const load = useCallback(async () => {
    setError('');
    try {
      if (tab === 'search') setJobs((await api.get(`/jobs?${query}`)).jobs);
      else setMine(await api.get('/jobs/mine'));
    } catch (e) { setError(e.message); setJobs((j) => j || []); }
  }, [tab, query]);
  useEffect(() => { load(); }, [load]);

  const list = tab === 'search' ? jobs : mine?.[tab];

  // Selected job: from the list when it is there, otherwise fetched (e.g. from a notification link).
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    const inList = list?.find((j) => j.id === selectedId);
    if (inList) { setDetail(inList); return; }
    if (list === undefined || list === null) return;
    api.get(`/jobs/${selectedId}`).then((d) => setDetail(d.job)).catch((e) => { toast(e.message); setParam({ id: null }); });
  }, [selectedId, list]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desktop shows the first job when nothing is chosen.
  const shown = detail || (window.matchMedia?.('(min-width: 768px)').matches ? list?.[0] : null) || null;

  function replaceJob(j) {
    const swap = (arr) => arr?.map((x) => (x.id === j.id ? j : x));
    setJobs(swap);
    setMine((m) => m && { saved: j.savedByMe ? (m.saved.some((x) => x.id === j.id) ? swap(m.saved) : [j, ...m.saved]) : m.saved.filter((x) => x.id !== j.id), applied: j.appliedAt && !m.applied.some((x) => x.id === j.id) ? [j, ...m.applied] : swap(m.applied), posted: swap(m.posted) });
    setDetail(j);
  }
  function removeJob(id) {
    const drop = (arr) => arr?.filter((x) => x.id !== id);
    setJobs(drop);
    setMine((m) => m && { saved: drop(m.saved), applied: drop(m.applied), posted: drop(m.posted) });
    setDetail(null);
    setParam({ id: null });
  }

  const filterBtn = (key, value) => (
    <button key={value} type="button" className="pill" aria-pressed={params.get(key) === value} onClick={() => setParam({ [key]: params.get(key) === value ? null : value, id: null })}>{value}</button>
  );

  return (
    <main className="page jobs-page">
      <div className="jobs-top">
        <div className="tabs card" role="tablist" aria-label="Jobs">
          <button className="tab" role="tab" type="button" aria-selected={tab === 'search'} onClick={() => setParam({ tab: null, id: null })}>Find jobs</button>
          {MINE.map(([k, label]) => <button key={k} className="tab" role="tab" type="button" aria-selected={tab === k} onClick={() => setParam({ tab: k, id: null })}>{label}</button>)}
          <button className="btn btn-primary" type="button" style={{ marginLeft: 'auto', alignSelf: 'center' }} onClick={() => setPosting(true)}><Icon name="plus" size="xs" />Post a job</button>
        </div>
        {tab === 'search' && (
          <form className="card job-search" role="search" onSubmit={(e) => { e.preventDefault(); setParam({ q: q.trim() || null, location: loc.trim() || null, id: null }); }}>
            <div className="search-field"><Icon name="search" size="sm" /><label className="sr-only" htmlFor="job-q">Title, skill or company</label><input id="job-q" type="search" placeholder="Title, skill or company" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="search-field"><Icon name="pin" size="sm" /><label className="sr-only" htmlFor="job-loc">City or country</label><input id="job-loc" type="search" placeholder="City or country" value={loc} onChange={(e) => setLoc(e.target.value)} /></div>
            <button className="btn btn-primary" type="submit">Search</button>
            <div className="pills" style={{ flexBasis: '100%', padding: 0 }} role="group" aria-label="Filters">
              {WORKPLACES.map((w) => filterBtn('workplace', w))}
              <span className="pill-sep" aria-hidden="true" />
              {TYPES.map((t) => filterBtn('type', t))}
            </div>
          </form>
        )}
      </div>

      <div className={`card jobs-shell${detail ? ' has-detail' : ''}`}>
        <section className="jobs-list" aria-label="Job results">
          <div className="jobs-list-head">
            <b>{tab === 'search' ? 'Jobs for you' : MINE.find(([k]) => k === tab)[1]}</b>
            {list && <span className="small muted">{fmt(list.length)} {list.length === 1 ? 'result' : 'results'}</span>}
          </div>
          {error && <div className="form-error" role="alert" style={{ margin: 12 }}>{error} <button className="link-btn" type="button" onClick={load}>Try again</button></div>}
          {!list && !error && <div style={{ padding: 12, display: 'grid', gap: 8 }}>{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}</div>}
          {list?.length === 0 && !error && (
            <div className="empty">
              <Icon name="briefcase" />
              {tab === 'search' && <><h3>No jobs match</h3><p>Try fewer words or clear a filter.</p><button className="btn btn-secondary" type="button" onClick={() => { setQ(''); setLoc(''); setParams({}, { replace: true }); }}>Clear search</button></>}
              {tab === 'saved' && <><h3>No saved jobs</h3><p>Save jobs to come back to them later.</p></>}
              {tab === 'applied' && <><h3>No applications yet</h3><p>Jobs you apply to will show up here with their status.</p></>}
              {tab === 'posted' && <><h3>You have not posted a job</h3><p>Hiring? Post a job and applicants come straight to you.</p><button className="btn btn-primary" type="button" onClick={() => setPosting(true)}>Post a job</button></>}
            </div>
          )}
          {list?.map((j) => <JobRow key={j.id} job={j} active={shown?.id === j.id} onSelect={(id) => setParam({ id })} />)}
        </section>
        <section className="jobs-detail" aria-label="Job details">
          {shown
            ? <JobDetail key={shown.id} job={shown} onChange={replaceJob} onRemoved={removeJob} onBack={() => setParam({ id: null })} />
            : list?.length ? <div className="empty"><Icon name="briefcase" /><h3>Select a job</h3><p>Choose a job from the list to see the details.</p></div> : null}
        </section>
      </div>

      {posting && (
        <JobForm onClose={() => { setPosting(false); setParam({ post: null }); }}
          onSaved={(j) => { toast('Job posted'); setMine((m) => m && { ...m, posted: [j, ...m.posted] }); setPosting(false); setParam({ tab: 'posted', id: j.id, post: null }); }} />
      )}
    </main>
  );
}
