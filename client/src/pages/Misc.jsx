import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';

export function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [users, setUsers] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setUsers(null); setJobs(null); setError('');
    const qs = encodeURIComponent(q);
    Promise.all([api.get(`/users?q=${qs}`), api.get(`/jobs?q=${qs}`)])
      .then(([u, j]) => { setUsers(u.users); setJobs(j.jobs.slice(0, 5)); })
      .catch((e) => setError(e.message));
  }, [q]);
  return (
    <main className="page single">
      <section className="card" aria-labelledby="sr-h">
        <div className="card-head"><h1 className="card-title" id="sr-h">People matching “{q}”</h1></div>
        {error && <div className="form-error" role="alert" style={{ margin: 16 }}>{error}</div>}
        {users === null && !error && <div style={{ padding: 16 }}><div className="skeleton" style={{ height: 56 }} /></div>}
        {users?.length === 0 && <div className="empty"><Icon name="search" /><h3>No people found</h3><p>Try a different name or job title.</p></div>}
        {users?.map((u) => (
          <Link key={u.id} to={`/in/${u.id}`} className="list-row" style={{ textDecoration: 'none' }}>
            <Avatar user={u} size={56} />
            <div className="info"><div className="person-name">{u.name}</div><div className="person-desc">{u.headline}</div><div className="small muted">{u.location}</div></div>
          </Link>
        ))}
      </section>
      {jobs?.length > 0 && (
        <section className="card" aria-labelledby="sj-h">
          <div className="card-head"><h2 className="card-title" id="sj-h">Jobs matching “{q}”</h2><Link className="link-btn" style={{ fontSize: 14, fontWeight: 600 }} to={`/jobs?q=${encodeURIComponent(q)}`}>See all jobs</Link></div>
          {jobs.map((j) => (
            <Link key={j.id} to={`/jobs?q=${encodeURIComponent(q)}&id=${j.id}`} className="list-row" style={{ textDecoration: 'none' }}>
              <span className="exp-logo"><Icon name="briefcase" /></span>
              <div className="info"><div className="person-name">{j.title}</div><div className="person-desc">{[j.company, j.location].filter(Boolean).join(' · ')}</div><div className="small muted">{j.workplace} · {j.type}</div></div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

export function Settings() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwError, setPwError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delError, setDelError] = useState('');

  async function changePw(e) {
    e.preventDefault(); setPwError('');
    try { await api.put('/auth/password', pw); setPw({ currentPassword: '', newPassword: '' }); toast('Password changed. Other devices were signed out.'); }
    catch (err) { setPwError(err.message); }
  }
  async function del() {
    setDelError('');
    try { await api.del('/users/me', { password: delPw }); await logout(); navigate('/signup'); }
    catch (err) { setDelError(err.message); }
  }

  return (
    <main className="page single">
      <h1 className="section-title" style={{ margin: '0 0 4px' }}>Settings & privacy</h1>
      <section className="card card-pad" aria-labelledby="pw-h">
        <h2 className="card-title" id="pw-h" style={{ marginBottom: 12 }}>Change password</h2>
        <form onSubmit={changePw} style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
          {pwError && <div className="form-error" role="alert">{pwError}</div>}
          <div className="field"><label htmlFor="cur-pw">Current password</label><input id="cur-pw" className="input" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw((s) => ({ ...s, currentPassword: e.target.value }))} /></div>
          <div className="field"><label htmlFor="new-pw">New password</label><input id="new-pw" className="input" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw((s) => ({ ...s, newPassword: e.target.value }))} /><span className="hint">At least 8 characters.</span></div>
          <button className="btn btn-primary" type="submit" style={{ justifySelf: 'start' }} disabled={!pw.currentPassword || !pw.newPassword}>Save password</button>
        </form>
      </section>
      <section className="card card-pad" aria-labelledby="sess-h">
        <h2 className="card-title" id="sess-h">Sign out everywhere</h2>
        <p className="muted">Ends your session on every device, including this one.</p>
        <button className="btn btn-secondary" type="button" onClick={async () => { await logout(true); navigate('/login'); }}>Sign out of all sessions</button>
      </section>
      <section className="card card-pad" aria-labelledby="del-h">
        <h2 className="card-title" id="del-h">Delete account</h2>
        <p className="muted">Permanently removes your profile, posts, comments, likes, connections and messages. This cannot be undone.</p>
        <button className="btn btn-danger" type="button" onClick={() => setDeleting(true)}><Icon name="trash" size="xs" />Delete account</button>
      </section>
      {deleting && (
        <Modal title="Delete your account?" onClose={() => setDeleting(false)}
          footer={<><button className="btn btn-plain" type="button" onClick={() => setDeleting(false)}>Cancel</button><button className="btn btn-danger" type="button" disabled={!delPw} onClick={del}>Delete forever</button></>}>
          <div className="modal-body">
            <p style={{ margin: 0 }}>Everything you created on Nexora will be deleted. Enter your password to confirm.</p>
            {delError && <div className="form-error" role="alert">{delError}</div>}
            <div className="field"><label htmlFor="del-pw">Password</label><input id="del-pw" className="input" type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></div>
          </div>
        </Modal>
      )}
    </main>
  );
}

export function NotFound() {
  return (
    <main className="page single">
      <div className="card empty"><Icon name="search" /><h1 style={{ fontSize: 20 }}>This page does not exist</h1><p>Check the link, or head back to your feed.</p><Link className="btn btn-primary" to="/">Go to home</Link></div>
    </main>
  );
}
