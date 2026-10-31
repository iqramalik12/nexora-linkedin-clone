import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useCounts } from '../lib/counts.jsx';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';

function Badge({ n, label }) {
  if (!n) return null;
  return <span className="badge" aria-label={`${n} ${label}`}>{n > 99 ? '99+' : n}</span>;
}

export default function Navbar({ onCompose }) {
  const { user, logout } = useAuth();
  const { unread, invites, notifications } = useCounts();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(new URLSearchParams(location.search).get('q') || '');
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const [biz, setBiz] = useState(false);
  const bizRef = useRef(null);

  useEffect(() => { setOpen(false); setBiz(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open && !biz) return;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
      if (!bizRef.current?.contains(e.target)) setBiz(false);
    };
    const esc = (e) => { if (e.key === 'Escape') { setOpen(false); setBiz(false); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open, biz]);

  const cls = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`;
  const bcls = ({ isActive }) => (isActive ? 'active' : '');

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/" aria-label="Nexora home">N</Link>
          <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`); }}>
            <label className="sr-only" htmlFor="global-search">Search people</label>
            <Icon name="search" size="sm" />
            <input id="global-search" type="search" placeholder="Search people and jobs" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <nav className="nav" aria-label="Primary">
            <NavLink className={(a) => `${cls(a)} hide-phone`} to="/" end><Icon name="home" /><span className="label">Home</span></NavLink>
            <NavLink className={(a) => `${cls(a)} hide-phone`} to="/mynetwork"><Icon name="users" /><Badge n={invites} label="invitations" /><span className="label">My Network</span></NavLink>
            <NavLink className={(a) => `${cls(a)} hide-phone`} to="/jobs"><Icon name="briefcase" /><span className="label">Jobs</span></NavLink>
            <NavLink className={cls} to="/messaging"><Icon name="msg" /><Badge n={unread} label="unread messages" /><span className="label">Messaging</span></NavLink>
            <NavLink className={(a) => `${cls(a)} hide-phone`} to="/notifications"><Icon name="bell" /><Badge n={notifications} label="new notifications" /><span className="label">Notifications</span></NavLink>
            <div className="me-wrap" ref={menuRef}>
              <button className="nav-item" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <Avatar user={user} size={24} />
                <span className="label">Me <Icon name="down" size="xs" /></span>
              </button>
              {open && (
                <div className="menu" role="menu">
                  <div className="menu-head">
                    <Avatar user={user} size={56} />
                    <div style={{ minWidth: 0 }}><b>{user.name}</b><span className="small">{user.headline}</span></div>
                  </div>
                  <Link className="btn btn-secondary" to={`/in/${user.id}`} role="menuitem" style={{ display: 'flex' }}>View profile</Link>
                  <span className="menu-tagline">Nexora · Connect. Grow. Succeed.</span>
                  <Link to="/saved" role="menuitem">Saved posts</Link>
                  <Link to="/jobs?tab=applied" role="menuitem">My jobs</Link>
                  <Link to="/settings" role="menuitem">Settings & privacy</Link>
                  <button className="menu-link" type="button" role="menuitem" onClick={async () => { await logout(); navigate('/login'); }}>Sign out</button>
                </div>
              )}
            </div>
            <span className="nav-sep hide-tablet" aria-hidden="true" />
            <div className="me-wrap hide-tablet" ref={bizRef}>
              <button className="nav-item" type="button" aria-haspopup="menu" aria-expanded={biz} onClick={() => setBiz((o) => !o)}>
                <Icon name="grid" />
                <span className="label">For Business <Icon name="down" size="xs" /></span>
              </button>
              {biz && (
                <div className="menu biz-menu" role="menu">
                  <b className="biz-title">Hiring on Nexora</b>
                  <Link to="/jobs?post=1" role="menuitem"><Icon name="plus" size="sm" />Post a job<small>Free, reaches everyone on Nexora</small></Link>
                  <Link to="/jobs?tab=posted" role="menuitem"><Icon name="briefcase" size="sm" />Your job posts<small>Applicants, edit, close</small></Link>
                  <Link to="/mynetwork" role="menuitem"><Icon name="users" size="sm" />Find people<small>Grow your network</small></Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>
      <nav className="bottombar" aria-label="Primary (mobile)">
        <NavLink className={bcls} to="/" end><Icon name="home" />Home</NavLink>
        <NavLink className={bcls} to="/mynetwork"><Icon name="users" /><Badge n={invites} label="invitations" />Network</NavLink>
        <button type="button" onClick={onCompose}><Icon name="plus" />Post</button>
        <NavLink className={bcls} to="/notifications"><Icon name="bell" /><Badge n={notifications} label="new notifications" />Alerts</NavLink>
        <NavLink className={bcls} to="/jobs"><Icon name="briefcase" />Jobs</NavLink>
      </nav>
    </>
  );
}
