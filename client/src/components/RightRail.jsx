import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { timeAgo, fmt } from '../lib/format.js';
import Avatar from './Avatar.jsx';
import ConnectButton from './ConnectButton.jsx';
import Icon from './Icon.jsx';

const stories = [
  ['Remote hiring picks up in Q4', '2h ago · 4,812 readers'],
  ['Design teams adopt token pipelines', '5h ago · 1,977 readers'],
  ['Karachi startups raise record seed', '8h ago · 3,140 readers'],
  ['Four-day week pilots report results', '1d ago · 9,206 readers'],
  ['What recruiters scan in 6 seconds', '1d ago · 12,450 readers'],
];

export function Suggestions({ limit = 3, title = 'People you may know' }) {
  const [people, setPeople] = useState(null);
  const [rels, setRels] = useState({});
  useEffect(() => { api.get(`/users/suggestions?limit=${limit}`).then((d) => setPeople(d.users)).catch(() => setPeople([])); }, [limit]);
  return (
    <section className="card card-pad" aria-labelledby="sug-title">
      <h2 className="card-title" id="sug-title" style={{ marginBottom: 8 }}>{title}</h2>
      {people === null && <div className="skeleton" style={{ height: 120 }} />}
      {people?.length === 0 && <p className="muted" style={{ margin: 0 }}>You have reached everyone for now. Invite colleagues to join.</p>}
      {people?.map((p) => (
        <div className="person-row" key={p.id}>
          <Link to={`/in/${p.id}`} tabIndex={-1}><Avatar user={p} /></Link>
          <div className="info">
            <Link className="person-name" to={`/in/${p.id}`}>{p.name}</Link>
            <div className="person-desc" style={{ marginBottom: 8 }}>{p.headline}</div>
            <ConnectButton compact userId={p.id} name={p.name} relationship={rels[p.id]} onChange={(r) => setRels((s) => ({ ...s, [p.id]: r }))} />
          </div>
        </div>
      ))}
      <Link className="see-all" to="/mynetwork">View all recommendations <Icon name="arrowRight" size="xs" /></Link>
    </section>
  );
}

// Newest open jobs, for the home page.
function JobsForYou() {
  const [jobs, setJobs] = useState(null);
  useEffect(() => { api.get('/jobs').then((d) => setJobs(d.jobs.filter((j) => !j.isPoster && !j.appliedAt).slice(0, 3))).catch(() => setJobs([])); }, []);
  if (jobs?.length === 0) return null;
  return (
    <section className="card card-pad" aria-labelledby="jfy-title">
      <h2 className="card-title" id="jfy-title" style={{ marginBottom: 4 }}>Jobs for you</h2>
      {jobs === null && <div className="skeleton" style={{ height: 120 }} />}
      {jobs?.map((j) => (
        <Link className="mini-job" key={j.id} to={`/jobs?id=${j.id}`}>
          <span className="mini-job-title">{j.title}</span>
          <span className="person-desc">{[j.company, j.location].filter(Boolean).join(' · ')}</span>
          <span className="small muted">{j.workplace} · {timeAgo(j.createdAt)}{j.applicantCount ? ` · ${fmt(j.applicantCount)} ${j.applicantCount === 1 ? 'applicant' : 'applicants'}` : ''}</span>
        </Link>
      ))}
      <Link className="see-all" to="/jobs">Show all jobs <Icon name="arrowRight" size="xs" /></Link>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <nav aria-label="Footer"><span>About</span><span>Accessibility</span><span>Help Center</span><span>Privacy & Terms</span><span>Advertising</span><span>Get the app</span></nav>
      <p className="footer-brand"><span className="brand brand-xs" aria-hidden="true">N</span><b>Nexora</b> Corporation © {new Date().getFullYear()}</p>
      <p className="tagline-small">Connect. Grow. Succeed.</p>
    </footer>
  );
}

export default function RightRail() {
  const [allNews, setAllNews] = useState(false);
  return (
    <aside className="col sticky hide-tablet" aria-label="News and suggestions">
      <section className="card news" aria-labelledby="news-title">
        <div className="news-head"><h2 className="card-title" id="news-title">Nexora News</h2><Icon name="info" size="sm" /></div>
        <p className="news-sub">Top stories</p>
        <ol>{(allNews ? stories : stories.slice(0, 3)).map(([h, m]) => <li key={h}><a href="#news" onClick={(e) => e.preventDefault()}><span className="h">{h}</span><span className="m">{m}</span></a></li>)}</ol>
        <button className="show-more" type="button" aria-expanded={allNews} onClick={() => setAllNews((s) => !s)}>Show {allNews ? 'less' : 'more'} <Icon name={allNews ? 'up' : 'down'} size="xs" /></button>
      </section>
      <Suggestions title="Add to your network" />
      <JobsForYou />
      <Footer />
    </aside>
  );
}
