import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCounts } from '../lib/counts.jsx';
import { fmt } from '../lib/format.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';

export default function ProfileCard() {
  const { user } = useAuth();
  const current = user.experience?.[0];
  return (
    <section className="card" aria-label="Your profile">
      <Link to={`/in/${user.id}`} tabIndex={-1} className="cover" style={user.coverUrl ? { backgroundImage: `url(${user.coverUrl})` } : undefined} aria-hidden="true" />
      <div className="profile-top">
        <Link to={`/in/${user.id}`} tabIndex={-1} className="profile-av"><Avatar user={user} size={72} /></Link>
        <h2 className="profile-name"><Link to={`/in/${user.id}`}>{user.name}</Link></h2>
        <p className="profile-headline">{user.headline || <Link className="hashtag" to={`/in/${user.id}`}>Add a headline</Link>}</p>
        {user.location && <p className="profile-loc">{user.location}</p>}
        {current && (
          <Link className="profile-co" to={`/in/${user.id}`}>
            <span className="exp-logo sm"><Icon name="building" size="xs" /></span>
            <span>{current.company}</span>
          </Link>
        )}
      </div>
    </section>
  );
}

export function StatsCard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/users/me/stats').then(setStats).catch(() => {}); }, []);
  const v = (k) => (stats ? fmt(stats[k]) : '–');
  return (
    <section className="card stats" aria-label="Your stats">
      <Link className="stat" to={`/in/${user.id}`}><span>Profile viewers</span><b>{v('profileViews')}</b></Link>
      <Link className="stat" to={`/in/${user.id}`}><span>Reactions on your posts</span><b>{v('reactions')}</b></Link>
      <Link className="stat" to="/mynetwork"><span>Connections</span><b>{v('connections')}</b><small>Grow your network</small></Link>
    </section>
  );
}

export function ShortcutsCard() {
  const { notifications, invites } = useCounts();
  const items = [
    ['/saved', 'bookmark', 'Saved items'],
    ['/jobs?tab=applied', 'briefcase', 'My jobs'],
    ['/mynetwork', 'users', 'My network', invites],
    ['/notifications', 'bell', 'Notifications', notifications],
    ['/settings', 'settings', 'Settings & privacy'],
  ];
  return (
    <nav className="card shortcuts" aria-label="Shortcuts">
      {items.map(([to, icon, label, n]) => (
        <Link key={to} to={to}><Icon name={icon} size="sm" /><span>{label}</span>{n > 0 && <span className="count-pill">{n > 99 ? '99+' : n}</span>}</Link>
      ))}
    </nav>
  );
}

// Left column of the home feed.
export function LeftRail() {
  return (
    <aside className="col sticky hide-phone" aria-label="Your profile and shortcuts">
      <ProfileCard />
      <StatsCard />
      <ShortcutsCard />
    </aside>
  );
}
