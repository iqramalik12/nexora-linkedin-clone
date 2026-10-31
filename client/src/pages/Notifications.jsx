import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useCounts } from '../lib/counts.jsx';
import { useToast } from '../lib/toast.jsx';
import { timeAgo } from '../lib/format.js';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import ProfileCard from '../components/ProfileCard.jsx';
import { Suggestions } from '../components/RightRail.jsx';

const FILTERS = [['all', 'All'], ['posts', 'My posts'], ['network', 'Network'], ['jobs', 'Jobs']];
const GROUP = { like: 'posts', comment: 'posts', repost: 'posts', invite: 'network', accept: 'network', apply: 'jobs' };

function describe(n) {
  const who = <b>{n.actor.name}</b>;
  const snippet = n.post?.text ? <>: “{n.post.text.length > 80 ? `${n.post.text.slice(0, 80)}…` : n.post.text}”</> : '';
  switch (n.type) {
    case 'like': return <>{who} liked your post{snippet}</>;
    case 'comment': return <>{who} commented on your post{snippet}</>;
    case 'repost': return <>{who} reposted your post{snippet}</>;
    case 'invite': return <>{who} sent you an invitation to connect</>;
    case 'accept': return <>{who} accepted your invitation. Say hello!</>;
    case 'apply': return <>{who} applied to your job <b>{n.job?.title || ''}</b></>;
    default: return who;
  }
}

function target(n) {
  if (n.post) return `/posts/${n.post.id}`;
  if (n.type === 'invite') return '/mynetwork';
  if (n.type === 'accept') return `/messaging/${n.actor.id}`;
  if (n.job) return `/jobs?id=${n.job.id}`;
  return `/in/${n.actor.id}`;
}

const ICON = { like: 'like', comment: 'comment', repost: 'repeat', invite: 'userPlus', accept: 'users', apply: 'briefcase' };

export default function Notifications() {
  const { refresh } = useCounts();
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setError('');
    try { setList((await api.get('/notifications')).notifications); } catch (e) { setError(e.message); setList((l) => l || []); }
  }, []);

  useEffect(() => {
    load();
    const onLive = () => load();
    window.addEventListener('nx:notification', onLive);
    return () => window.removeEventListener('nx:notification', onLive);
  }, [load]);

  async function open(n) {
    if (!n.read) {
      setList((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      api.post(`/notifications/${n.id}/read`).then(refresh).catch(() => {});
    }
    navigate(target(n));
  }

  async function readAll() {
    try { await api.post('/notifications/read-all'); setList((l) => l.map((x) => ({ ...x, read: true }))); refresh(); }
    catch (e) { toast(e.message); }
  }

  async function remove(n) {
    try { await api.del(`/notifications/${n.id}`); setList((l) => l.filter((x) => x.id !== n.id)); refresh(); }
    catch (e) { toast(e.message); }
  }

  const shown = (list || []).filter((n) => filter === 'all' || GROUP[n.type] === filter);
  const unread = (list || []).filter((n) => !n.read).length;

  return (
    <main className="page">
      <aside className="col sticky hide-phone"><ProfileCard /></aside>
      <section className="card" aria-labelledby="nt-h">
        <div className="card-head">
          <h1 className="card-title" id="nt-h">Notifications</h1>
          <button className="btn btn-plain" type="button" disabled={!unread} onClick={readAll}><Icon name="check" size="xs" />Mark all as read</button>
        </div>
        <div className="pills" role="group" aria-label="Filter notifications">
          {FILTERS.map(([k, label]) => <button key={k} type="button" className="pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>)}
        </div>
        {error && <div className="form-error" role="alert" style={{ margin: 16 }}>{error} <button className="link-btn" type="button" onClick={load}>Try again</button></div>}
        {list === null && <div style={{ padding: 16, display: 'grid', gap: 8 }}><div className="skeleton" style={{ height: 56 }} /><div className="skeleton" style={{ height: 56 }} /></div>}
        {list && shown.length === 0 && !error && (
          <div className="empty"><Icon name="bell" /><h3>No notifications yet</h3><p>When people like, comment on or repost your posts, invite you, or apply to your jobs, you will see it here.</p></div>
        )}
        <ul className="notif-list">
          {shown.map((n) => (
            <li key={n.id} className={`notif${n.read ? '' : ' unread'}`}>
              <button type="button" className="notif-main" onClick={() => open(n)}>
                <span className="notif-av"><Avatar user={n.actor} size={48} /><span className={`notif-ico t-${n.type}`}><Icon name={ICON[n.type]} size="xs" /></span></span>
                <span className="notif-text">{describe(n)}</span>
                <span className="small muted notif-time">{timeAgo(n.createdAt)}</span>
              </button>
              {!n.read && <span className="dot" aria-label="Unread" />}
              <button className="icon-btn" type="button" aria-label="Delete notification" onClick={() => remove(n)}><Icon name="x" size="sm" /></button>
            </li>
          ))}
        </ul>
      </section>
      <aside className="col sticky hide-tablet"><Suggestions /><p className="small muted" style={{ textAlign: 'center' }}><Link to="/settings">Settings & privacy</Link></p></aside>
    </main>
  );
}
