import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCounts } from '../lib/counts.jsx';
import { timeAgo } from '../lib/format.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';

// Collapsible conversation list pinned to the bottom right on wide screens.
export default function MessagingDock() {
  const { user } = useAuth();
  const { unread } = useCounts();
  const location = useLocation();
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('nx:dock') === 'open'; } catch { return false; } });
  const [list, setList] = useState(null);

  const load = useCallback(() => { api.get('/messages').then((d) => setList(d.conversations)).catch(() => setList((l) => l || [])); }, []);
  useEffect(() => {
    if (!open) return undefined;
    load();
    window.addEventListener('nx:message', load);
    return () => window.removeEventListener('nx:message', load);
  }, [open, load]);

  const toggle = () => setOpen((o) => {
    try { localStorage.setItem('nx:dock', o ? 'closed' : 'open'); } catch { /* per-browser preference only */ }
    return !o;
  });

  if (location.pathname.startsWith('/messaging')) return null;
  return (
    <aside className={`dock${open ? ' open' : ''}`} aria-label="Messaging">
      <div className="dock-head">
        <button type="button" className="dock-title" aria-expanded={open} onClick={toggle}>
          <span className="dock-av"><Avatar user={user} size={32} /><span className="online" aria-hidden="true" /></span>
          <b>Messaging</b>
          {unread > 0 && <span className="count-pill" aria-label={`${unread} unread`}>{unread}</span>}
        </button>
        <Link className="icon-btn" to="/messaging" aria-label="Open messaging"><Icon name="pencil" size="sm" /></Link>
        <button type="button" className="icon-btn" aria-label={open ? 'Minimise messaging' : 'Expand messaging'} onClick={toggle}><Icon name={open ? 'down' : 'up'} size="sm" /></button>
      </div>
      {open && (
        <div className="dock-body">
          {list === null && <div style={{ padding: 12, display: 'grid', gap: 8 }}><div className="skeleton" style={{ height: 48 }} /><div className="skeleton" style={{ height: 48 }} /></div>}
          {list?.length === 0 && <div className="empty" style={{ padding: 20 }}><p style={{ margin: 0 }}>No messages yet. Message a connection to start a conversation.</p></div>}
          {list?.map((c) => (
            <Link key={c.user.id} className={`conv${c.unread ? ' unread' : ''}`} to={`/messaging/${c.user.id}`}>
              <Avatar user={c.user} size={40} />
              <span className="info">
                <span className="top"><span className="name">{c.user.name}</span><span className="small muted">{timeAgo(c.last.createdAt)}</span></span>
                <span className="preview">{c.last.from === user.id ? 'You: ' : ''}{c.last.text}</span>
              </span>
              {c.unread > 0 && <span className="dot" aria-label={`${c.unread} unread`} />}
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
