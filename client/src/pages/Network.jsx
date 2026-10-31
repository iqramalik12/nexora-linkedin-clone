import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useCounts } from '../lib/counts.jsx';
import { useToast } from '../lib/toast.jsx';
import { timeAgo } from '../lib/format.js';
import Avatar from '../components/Avatar.jsx';
import ConnectButton from '../components/ConnectButton.jsx';
import Icon from '../components/Icon.jsx';

function Row({ user, sub, children }) {
  return (
    <div className="list-row">
      <Link to={`/in/${user.id}`} tabIndex={-1}><Avatar user={user} size={56} /></Link>
      <div className="info">
        <Link className="person-name" to={`/in/${user.id}`}>{user.name}</Link>
        <div className="person-desc">{user.headline}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
      <div className="acts">{children}</div>
    </div>
  );
}

export default function Network() {
  const toast = useToast();
  const { refresh } = useCounts();
  const [inv, setInv] = useState(null);
  const [conns, setConns] = useState(null);
  const [people, setPeople] = useState(null);
  const [rels, setRels] = useState({});
  const [tab, setTab] = useState('received');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [i, c, s] = await Promise.all([api.get('/connections/invitations'), api.get('/connections'), api.get('/users/suggestions?limit=12')]);
      setInv(i); setConns(c.connections); setPeople(s.users);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(fn, msg) {
    try { await fn(); toast(msg); await load(); refresh(); } catch (e) { toast(e.message); }
  }

  if (error) return <main className="page single"><div className="card empty" role="alert"><h3>We could not load your network</h3><p>{error}</p><button className="btn btn-secondary" type="button" onClick={load}>Try again</button></div></main>;
  if (!inv) return <main className="page single"><div className="card" style={{ height: 240 }}><div className="skeleton" style={{ height: '100%' }} /></div></main>;

  const list = tab === 'received' ? inv.received : inv.sent;
  return (
    <main className="page single">
      <h1 className="sr-only">My Network</h1>
      <section className="card" aria-label="Invitations">
        <div className="card-head"><h2 className="card-title">Invitations</h2></div>
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" type="button" aria-selected={tab === 'received'} onClick={() => setTab('received')}>Received ({inv.received.length})</button>
          <button className="tab" role="tab" type="button" aria-selected={tab === 'sent'} onClick={() => setTab('sent')}>Sent ({inv.sent.length})</button>
        </div>
        <div role="tabpanel">
          {list.length === 0 && <div className="empty"><p style={{ margin: 0 }}>{tab === 'received' ? 'No pending invitations.' : 'You have no invitations waiting for a reply.'}</p></div>}
          {list.map((x) => (
            <Row key={x.id} user={x.user} sub={`${tab === 'received' ? 'Sent you an invitation' : 'Invited'} ${timeAgo(x.createdAt).toLowerCase()}${timeAgo(x.createdAt) === 'Just now' ? '' : ' ago'}`}>
              {tab === 'received' ? (
                <>
                  <button className="btn btn-plain" type="button" onClick={() => act(() => api.del(`/connections/${x.id}`), 'Invitation ignored')}>Ignore</button>
                  <button className="btn btn-secondary" type="button" onClick={() => act(() => api.post(`/connections/${x.id}/accept`), `You are now connected with ${x.user.name}`)}>Accept</button>
                </>
              ) : (
                <button className="btn btn-ghost" type="button" onClick={() => act(() => api.del(`/connections/${x.id}`), 'Invitation withdrawn')}>Withdraw</button>
              )}
            </Row>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="conn-h">
        <div className="card-head"><h2 className="card-title" id="conn-h">{conns.length} {conns.length === 1 ? 'Connection' : 'Connections'}</h2></div>
        {conns.length === 0 && <div className="empty"><Icon name="users" /><h3>No connections yet</h3><p>Connect with people you know to message them and see their posts.</p></div>}
        {conns.map((c) => (
          <Row key={c.id} user={c.user} sub={`Connected ${new Date(c.since).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}>
            <Link className="btn btn-secondary" to={`/messaging/${c.user.id}`}>Message</Link>
            <button className="btn btn-plain" type="button" aria-label={`Remove ${c.user.name}`} onClick={() => act(() => api.del(`/connections/${c.id}`), 'Connection removed')}>Remove</button>
          </Row>
        ))}
      </section>

      <section className="card" aria-labelledby="pymk-h">
        <div className="card-head"><h2 className="card-title" id="pymk-h">People you may know</h2></div>
        {people.length === 0 ? <div className="empty"><p style={{ margin: 0 }}>No new suggestions right now.</p></div> : (
          <div className="grid-people">
            {people.map((p) => (
              <div className="pcard" key={p.id}>
                <div className="cover" />
                <Avatar user={p} size={72} />
                <div className="body">
                  <Link className="person-name" to={`/in/${p.id}`}>{p.name}</Link>
                  <div className="person-desc">{p.headline}</div>
                  <ConnectButton compact userId={p.id} name={p.name} relationship={rels[p.id]} onChange={(r) => setRels((s) => ({ ...s, [p.id]: r }))} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
