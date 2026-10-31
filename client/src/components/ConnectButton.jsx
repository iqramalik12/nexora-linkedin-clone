import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useCounts } from '../lib/counts.jsx';
import { useToast } from '../lib/toast.jsx';
import Icon from './Icon.jsx';

// Shows the right action for a relationship: Connect, Pending, Accept, or Message.
export default function ConnectButton({ userId, name, relationship, onChange, compact = false }) {
  const toast = useToast();
  const { refresh } = useCounts();
  const [busy, setBusy] = useState(false);
  const status = relationship?.status || 'none';

  async function run(fn, done) {
    setBusy(true);
    try {
      const d = await fn();
      onChange?.(d?.relationship || { status: 'none' });
      if (done) toast(done);
      refresh();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  if (status === 'self') return null;
  if (status === 'connected') {
    return <Link className="btn btn-primary" to={`/messaging/${userId}`}><Icon name="send" size="xs" />Message</Link>;
  }
  if (status === 'sent') {
    return (
      <button className="btn btn-ghost" type="button" disabled={busy} title="Withdraw invitation"
        onClick={() => run(() => api.del(`/connections/${relationship.connectionId}`), 'Invitation withdrawn')}>
        <Icon name="clock" size="xs" />Pending
      </button>
    );
  }
  if (status === 'received') {
    return (
      <button className="btn btn-primary" type="button" disabled={busy}
        onClick={() => run(() => api.post(`/connections/${relationship.connectionId}/accept`), `You are now connected with ${name}`)}>
        <Icon name="check" size="xs" />Accept
      </button>
    );
  }
  return (
    <button className={`btn ${compact ? 'btn-ghost' : 'btn-primary'}`} type="button" disabled={busy}
      onClick={() => run(() => api.post(`/connections/request/${userId}`), `Invitation sent to ${name}`)}>
      <Icon name="userPlus" size="xs" />Connect
    </button>
  );
}
