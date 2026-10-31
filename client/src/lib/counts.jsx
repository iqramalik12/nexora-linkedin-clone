import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

// Badge numbers for the navbar, refreshed every 15 seconds and whenever a live event arrives.
// Also keeps one live stream open per tab and re-broadcasts its events as window events:
// 'nx:message' (detail = the message), 'nx:notification' and 'nx:live' (stream reconnected, refetch).
const CountsContext = createContext({ unread: 0, invites: 0, notifications: 0, refresh: () => {} });

export function CountsProvider({ children }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState({ unread: 0, invites: 0, notifications: 0 });
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [m, i, n] = await Promise.all([api.get('/messages/unread'), api.get('/connections/invitations'), api.get('/notifications/unread')]);
      setCounts({ unread: m.unread, invites: i.received.length, notifications: n.unread });
    } catch { /* badges are best effort */ }
  }, [user]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    if (!user || typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/messages/stream');
    const fire = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
    es.addEventListener('message', (e) => { try { fire('nx:message', JSON.parse(e.data)); } catch { /* ignore bad event */ } refresh(); });
    es.addEventListener('notification', () => { fire('nx:notification'); refresh(); });
    es.addEventListener('read', refresh);
    es.addEventListener('open', () => fire('nx:live'));
    return () => es.close();
  }, [user, refresh]);
  return <CountsContext.Provider value={{ ...counts, refresh }}>{children}</CountsContext.Provider>;
}

export const useCounts = () => useContext(CountsContext);
