import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useCounts } from '../lib/counts.jsx';
import { clock, dayLabel, timeAgo } from '../lib/format.js';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';

function NewMessage({ onClose }) {
  const navigate = useNavigate();
  const [conns, setConns] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/connections').then((d) => setConns(d.connections)).catch(() => setConns([])); }, []);
  const shown = (conns || []).filter((c) => c.user.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal title="New message" onClose={onClose}>
      <div className="modal-body">
        <div className="field"><label htmlFor="nm-q">Choose a connection</label><input id="nm-q" className="input" placeholder="Type a name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {conns === null && <div className="skeleton" style={{ height: 80 }} />}
        {conns?.length === 0 && <p className="muted">You can message people once you are connected. <Link className="hashtag" to="/mynetwork">Find people</Link></p>}
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {shown.map((c) => (
            <button key={c.id} className="conv" type="button" onClick={() => { onClose(); navigate(`/messaging/${c.user.id}`); }}>
              <Avatar user={c.user} size={40} />
              <div className="info"><div className="name">{c.user.name}</div><div className="preview">{c.user.headline}</div></div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function Thread({ userId, onSent }) {
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    try { setData(await api.get(`/messages/${userId}`)); setError(''); } catch (e) { setError(e.message); }
  }, [userId]);

  useEffect(() => {
    setData(null); lastCount.current = 0; load();
    // New messages arrive over the live stream; the slow poll is only a fallback.
    const onMessage = (e) => { if (e.detail?.from === userId || e.detail?.to === userId) load(); };
    window.addEventListener('nx:message', onMessage);
    window.addEventListener('nx:live', load);
    const t = setInterval(load, 15000);
    return () => { clearInterval(t); window.removeEventListener('nx:message', onMessage); window.removeEventListener('nx:live', load); };
  }, [load, userId]);

  useEffect(() => {
    if (data && data.messages.length !== lastCount.current) {
      lastCount.current = data.messages.length;
      bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
      onSent();
    }
  }, [data, onSent]);

  async function send(e) {
    e?.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const d = await api.post(`/messages/${userId}`, { text });
      setData((s) => (s.messages.some((m) => m.id === d.message.id) ? s : { ...s, messages: [...s.messages, d.message] }));
      setText('');
    } catch (err) { setError(err.message); } finally { setSending(false); }
  }

  if (error && !data) return <div className="thread"><div className="empty" role="alert"><h3>Conversation not available</h3><p>{error}</p></div></div>;
  if (!data) return <div className="thread"><div className="thread-body"><div className="skeleton" style={{ height: 40, width: '50%' }} /><div className="skeleton" style={{ height: 40, width: '40%', alignSelf: 'flex-end' }} /></div></div>;

  let lastDay = '';
  return (
    <div className="thread">
      <div className="thread-head">
        <Link className="icon-btn show-phone-only" to="/messaging" aria-label="Back to conversations"><Icon name="arrowLeft" /></Link>
        <Link to={`/in/${data.user.id}`} tabIndex={-1}><Avatar user={data.user} size={40} /></Link>
        <div style={{ minWidth: 0 }}><Link className="person-name" to={`/in/${data.user.id}`}>{data.user.name}</Link><div className="person-desc">{data.user.headline}</div></div>
      </div>
      <div className="thread-body" ref={bodyRef} aria-live="polite">
        {data.messages.length === 0 && <div className="empty"><p>Say hello to {data.user.name.split(' ')[0]}.</p></div>}
        {data.messages.map((m) => {
          const day = dayLabel(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.from === me.id;
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && <div className="day">{day}</div>}
              <div className={`bubble-row${mine ? ' mine' : ''}`}>
                <div className="bubble" title={clock(m.createdAt)}>{m.text}<div className="small" style={{ opacity: .75, marginTop: 2 }}>{clock(m.createdAt)}</div></div>
              </div>
            </div>
          );
        })}
      </div>
      {error && <div className="form-error" role="alert" style={{ margin: '0 16px 8px' }}>{error}</div>}
      {data.canMessage ? (
        <form className="thread-foot" onSubmit={send}>
          <label className="sr-only" htmlFor="msg-text">Write a message</label>
          <textarea id="msg-text" rows={1} placeholder="Write a message…" maxLength={2000} value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="btn btn-primary" type="submit" disabled={sending || !text.trim()}>Send</button>
        </form>
      ) : (
        <div className="notice">You are no longer connected with {data.user.name.split(' ')[0]}. <Link className="hashtag" to={`/in/${data.user.id}`}>Connect again</Link> to send messages.</div>
      )}
    </div>
  );
}

export default function Messaging() {
  const { userId } = useParams();
  const { refresh } = useCounts();
  const [convs, setConvs] = useState(null);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try { const d = await api.get('/messages'); setConvs(d.conversations); setError(''); refresh(); } catch (e) { setError(e.message); setConvs((c) => c || []); }
  }, [refresh]);
  useEffect(() => {
    load();
    window.addEventListener('nx:message', load);
    window.addEventListener('nx:live', load);
    const t = setInterval(load, 20000); // fallback if the live stream is down
    return () => { clearInterval(t); window.removeEventListener('nx:message', load); window.removeEventListener('nx:live', load); };
  }, [load]);

  return (
    <main className="page single" style={{ gridTemplateColumns: 'minmax(0, 1128px)' }}>
      <h1 className="sr-only">Messaging</h1>
      <div className={`card msg-shell${userId ? ' has-thread' : ''}`}>
        <div className="msg-list">
          <div className="msg-list-head">
            <h2 className="card-title">Messaging</h2>
            <button className="icon-btn" type="button" aria-label="New message" onClick={() => setComposing(true)}><Icon name="pencil" size="sm" /></button>
          </div>
          {convs === null && <div style={{ padding: 16, display: 'grid', gap: 12 }}><div className="skeleton" style={{ height: 48 }} /><div className="skeleton" style={{ height: 48 }} /></div>}
          {error && <div className="form-error" role="alert" style={{ margin: 12 }}>{error}</div>}
          {convs?.length === 0 && !error && (
            <div className="empty"><Icon name="inbox" /><h3>No messages yet</h3><p>Start a conversation with one of your connections.</p><button className="btn btn-secondary" type="button" onClick={() => setComposing(true)}>New message</button></div>
          )}
          {convs?.map((c) => (
            <Link key={c.user.id} to={`/messaging/${c.user.id}`} className={`conv${c.user.id === userId ? ' active' : ''}${c.unread ? ' unread' : ''}`}>
              <Avatar user={c.user} size={48} />
              <div className="info">
                <div className="top"><span className="name">{c.user.name}</span><span className="small muted">{timeAgo(c.last.createdAt)}</span></div>
                <div className="preview">{c.last.from === c.user.id ? '' : 'You: '}{c.last.text}</div>
              </div>
              {c.unread > 0 && <span className="dot" aria-label={`${c.unread} unread`} />}
            </Link>
          ))}
        </div>
        {userId ? <Thread key={userId} userId={userId} onSent={load} /> : (
          <div className="thread"><div className="empty" style={{ margin: 'auto' }}><Icon name="msg" /><h3>Select a conversation</h3><p>Or start a new one with a connection.</p></div></div>
        )}
      </div>
      {composing && <NewMessage onClose={() => setComposing(false)} />}
    </main>
  );
}
