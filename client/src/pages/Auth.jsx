import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

function Shell({ children }) {
  return (
    <main className="auth">
      <div className="auth-brand-wrap"><div className="auth-brand"><span className="brand" aria-hidden="true">N</span><span className="brand-word">Nexora</span></div><p className="tagline">Connect. Grow. Succeed.</p></div>
      <div className="card auth-card">{children}</div>
    </main>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); navigate(from, { replace: true }); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Shell>
      <div><h1>Sign in</h1><p className="muted">Stay up to date with your professional world.</p></div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="demo">Trying it out? Run <code>npm run seed</code>, then sign in with <b>iqra@nexora.dev</b> and password <b>nexora123</b>.</div>
      <p style={{ textAlign: 'center' }}>New to Nexora? <Link className="hashtag" to="/signup">Join now</Link></p>
    </Shell>
  );
}

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', headline: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true); setError('');
    try { await signup(form); navigate('/', { replace: true }); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Shell>
      <div><h1>Make the most of your working life</h1><p className="muted">Create your free account.</p></div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="field"><label htmlFor="name">Full name</label><input className="input" id="name" autoComplete="name" maxLength={80} required value={form.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="su-email">Email</label><input className="input" id="su-email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} /></div>
        <div className="field"><label htmlFor="su-password">Password</label><input className="input" id="su-password" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set('password')} /><span className="hint">At least 8 characters.</span></div>
        <div className="field"><label htmlFor="headline">Headline <span className="small">(optional)</span></label><input className="input" id="headline" maxLength={160} placeholder="e.g. Product Designer at Brightpath" value={form.headline} onChange={set('headline')} /></div>
        <button className="btn btn-primary btn-lg" type="submit" disabled={busy || !form.name || !form.email || !form.password}>{busy ? 'Creating account…' : 'Agree & join'}</button>
      </form>
      <p style={{ textAlign: 'center' }}>Already on Nexora? <Link className="hashtag" to="/login">Sign in</Link></p>
    </Shell>
  );
}
