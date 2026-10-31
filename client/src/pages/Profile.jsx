import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { fmt } from '../lib/format.js';
import { prepareImage, uploadImage } from '../lib/image.js';
import Avatar from '../components/Avatar.jsx';
import ConnectButton from '../components/ConnectButton.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import { Suggestions } from '../components/RightRail.jsx';
import { PostList, usePosts } from './Feed.jsx';

function EditProfile({ user, onClose, onSaved }) {
  const [f, setF] = useState({
    name: user.name, headline: user.headline, location: user.location, about: user.about,
    skills: user.skills.join(', '),
    experience: user.experience.map(({ title, company, start, end }) => ({ title, company, start, end })),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setExp = (i, k) => (e) => setF((s) => ({ ...s, experience: s.experience.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) }));

  async function save() {
    setBusy(true); setError('');
    try {
      const d = await api.put('/users/me', {
        name: f.name, headline: f.headline, location: f.location, about: f.about,
        skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean),
        experience: f.experience.filter((x) => x.title.trim() || x.company.trim()),
      });
      onSaved(d.user);
      onClose();
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <Modal title="Edit profile" onClose={onClose}
      footer={<button className="btn btn-primary" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>}>
      <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="field"><label htmlFor="e-name">Name</label><input id="e-name" className="input" maxLength={80} value={f.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="e-headline">Headline</label><input id="e-headline" className="input" maxLength={160} value={f.headline} onChange={set('headline')} /></div>
        <div className="field"><label htmlFor="e-location">Location</label><input id="e-location" className="input" maxLength={100} value={f.location} onChange={set('location')} /></div>
        <div className="field"><label htmlFor="e-about">About</label><textarea id="e-about" className="textarea" maxLength={2000} value={f.about} onChange={set('about')} /></div>
        <div className="field"><label htmlFor="e-skills">Skills</label><input id="e-skills" className="input" value={f.skills} onChange={set('skills')} /><span className="hint">Separate skills with commas.</span></div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
          <legend style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Experience</legend>
          {f.experience.map((x, i) => (
            <div className="edit-row" key={i}>
              <button className="icon-btn remove" type="button" aria-label={`Remove experience ${i + 1}`} onClick={() => setF((s) => ({ ...s, experience: s.experience.filter((_, j) => j !== i) }))}><Icon name="x" size="sm" /></button>
              <div className="field"><label htmlFor={`x-t-${i}`}>Title</label><input id={`x-t-${i}`} className="input" maxLength={100} value={x.title} onChange={setExp(i, 'title')} /></div>
              <div className="field"><label htmlFor={`x-c-${i}`}>Company</label><input id={`x-c-${i}`} className="input" maxLength={100} value={x.company} onChange={setExp(i, 'company')} /></div>
              <div className="field"><label htmlFor={`x-s-${i}`}>Start</label><input id={`x-s-${i}`} className="input" maxLength={20} placeholder="2022" value={x.start} onChange={setExp(i, 'start')} /></div>
              <div className="field"><label htmlFor={`x-e-${i}`}>End</label><input id={`x-e-${i}`} className="input" maxLength={20} placeholder="Present" value={x.end} onChange={setExp(i, 'end')} /></div>
            </div>
          ))}
          <button className="btn btn-secondary" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setF((s) => ({ ...s, experience: [...s.experience, { title: '', company: '', start: '', end: '' }] }))}><Icon name="plus" size="xs" />Add position</button>
        </fieldset>
      </div>
    </Modal>
  );
}

// Change or remove the profile photo ('avatar') or the cover photo ('cover').
function PhotoModal({ kind, user, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = kind === 'avatar' ? user.avatarUrl : user.coverUrl;
  const label = kind === 'avatar' ? 'Profile photo' : 'Cover photo';

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try { setPreview(await prepareImage(file, kind === 'avatar' ? 480 : 1600)); } catch (err) { setError(err.message); }
  }
  async function save(value) {
    setBusy(true); setError('');
    try {
      const id = value === null ? null : (await uploadImage(value)).id;
      onSaved((await api.put('/users/me', { [kind]: id })).user);
      onClose();
    } catch (err) { setError(err.message); setBusy(false); }
  }

  const shown = preview || current;
  return (
    <Modal title={label} onClose={onClose}
      footer={<>
        {current && !preview && <button className="btn btn-plain" type="button" disabled={busy} onClick={() => save(null)} style={{ marginRight: 'auto' }}><Icon name="trash" size="xs" />Delete</button>}
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="camera" size="xs" />{shown ? 'Choose another' : 'Upload photo'}</button>
        {preview && <button className="btn btn-primary" type="button" disabled={busy} onClick={() => save(preview)}>{busy ? 'Saving…' : 'Save photo'}</button>}
      </>}>
      <div className="modal-body" style={{ alignItems: 'center' }}>
        {shown
          ? <img src={shown} alt={`${label} preview`} className={kind === 'avatar' ? 'photo-round' : 'photo-cover'} />
          : <div className="empty" style={{ padding: 16 }}><Icon name="camera" /><p style={{ margin: 0 }}>{kind === 'avatar' ? 'A photo helps people recognise you.' : 'A cover photo makes your profile stand out.'}</p></div>}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onFile} aria-label={`Choose a ${label.toLowerCase()}`} />
        {error && <div className="form-error" role="alert" style={{ alignSelf: 'stretch' }}>{error}</div>}
      </div>
    </Modal>
  );
}

export default function Profile() {
  const { id } = useParams();
  const { user: me, setUser } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState(null); // 'avatar' | 'cover' | null
  const query = useMemo(() => `author=${id}`, [id]);
  const feed = usePosts(query);

  useEffect(() => {
    setData(null); setError('');
    api.get(`/users/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <main className="page single"><div className="card empty" role="alert"><Icon name="users" /><h1 style={{ fontSize: 20 }}>Profile not available</h1><p>{error}</p><Link className="btn btn-secondary" to="/">Back to home</Link></div></main>;
  if (!data) return <main className="page two"><div className="card" style={{ height: 320 }}><div className="skeleton" style={{ height: '100%' }} /></div></main>;

  const u = data.user;
  const isMe = data.relationship.status === 'self';
  return (
    <main className="page two">
      <div className="col">
        <section className="card" aria-labelledby="p-name">
          <div className="p-cover" style={u.coverUrl ? { backgroundImage: `url(${u.coverUrl})` } : undefined}>
            {isMe && <button className="icon-btn cover-btn" type="button" aria-label="Edit cover photo" onClick={() => setPhoto('cover')}><Icon name="camera" size="sm" /></button>}
          </div>
          <div className="p-main">
            <div className="p-head">
              {isMe
                ? <button type="button" className="avatar-btn" aria-label="Change profile photo" onClick={() => setPhoto('avatar')}><Avatar user={u} size={152} /><span className="avatar-cam"><Icon name="camera" size="sm" /></span></button>
                : <Avatar user={u} size={152} />}
              {isMe && <button className="icon-btn" type="button" aria-label="Edit profile" style={{ marginTop: 12 }} onClick={() => setEditing(true)}><Icon name="pencil" /></button>}
            </div>
            <h1 className="p-name" id="p-name">{u.name}</h1>
            <p className="p-headline">{u.headline || (isMe ? <span className="muted">Add a headline so people know what you do.</span> : null)}</p>
            <p className="p-meta">
              {u.location && <span>{u.location}</span>}
              <Link to={isMe ? '/mynetwork' : '#'} onClick={(e) => !isMe && e.preventDefault()}>{fmt(data.connectionCount)} {data.connectionCount === 1 ? 'connection' : 'connections'}</Link>
            </p>
            <div className="p-actions">
              {isMe ? (
                <>
                  <button className="btn btn-primary" type="button" onClick={() => setEditing(true)}><Icon name="pencil" size="xs" />Edit profile</button>
                  <Link className="btn btn-secondary" to="/settings">Settings</Link>
                </>
              ) : (
                <>
                  <ConnectButton userId={u.id} name={u.name} relationship={data.relationship} onChange={(r) => setData((d) => ({ ...d, relationship: r, connectionCount: d.connectionCount + (r.status === 'connected' ? 1 : 0) }))} />
                  {data.relationship.status !== 'connected' && <button className="btn btn-ghost" type="button" onClick={() => toast(`Connect with ${u.name.split(' ')[0]} to send a message`)}>Message</button>}
                  {data.relationship.status === 'connected' && (
                    <button className="btn btn-ghost" type="button" onClick={async () => {
                      try { await api.del(`/connections/${data.relationship.connectionId}`); setData((d) => ({ ...d, relationship: { status: 'none' }, connectionCount: d.connectionCount - 1 })); toast('Connection removed'); }
                      catch (e) { toast(e.message); }
                    }}>Remove connection</button>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <section className="card card-pad" aria-labelledby="about-h">
          <h2 className="section-title" id="about-h">About</h2>
          {u.about ? <p className="about">{u.about}</p> : <p className="muted" style={{ margin: 0 }}>{isMe ? 'Write a short summary of your work and what you are looking for.' : 'Nothing here yet.'}</p>}
        </section>

        <section className="card card-pad" aria-labelledby="exp-h">
          <h2 className="section-title" id="exp-h">Experience</h2>
          {u.experience.length === 0 && <p className="muted" style={{ margin: 0 }}>{isMe ? 'Add positions to show where you have worked.' : 'No positions listed.'}</p>}
          {u.experience.map((x) => (
            <div className="exp" key={x.id}>
              <span className="exp-logo"><Icon name="building" /></span>
              <div><b>{x.title}</b><div>{x.company}</div><div className="small muted">{[x.start, x.end].filter(Boolean).join(' – ')}</div></div>
            </div>
          ))}
        </section>

        <section className="card card-pad" aria-labelledby="skills-h">
          <h2 className="section-title" id="skills-h">Skills</h2>
          {u.skills.length ? <div className="chips">{u.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</div> : <p className="muted" style={{ margin: 0 }}>No skills listed yet.</p>}
        </section>

        <section className="col" aria-labelledby="act-h">
          <div className="card card-pad"><h2 className="section-title" id="act-h" style={{ margin: 0 }}>Activity <span className="small muted">· {fmt(data.postCount)} posts</span></h2></div>
          <PostList feed={feed} emptyTitle={isMe ? 'You have not posted yet' : 'No posts yet'} emptyText={isMe ? 'Posts you share will show up here.' : `${u.name.split(' ')[0]} has not shared anything yet.`} />
        </section>
      </div>
      <aside className="col sticky hide-tablet"><Suggestions limit={5} /></aside>
      {photo && <PhotoModal kind={photo} user={u} onClose={() => setPhoto(null)} onSaved={(nu) => { setData((d) => ({ ...d, user: nu })); setUser(nu); if (photo === 'avatar') feed.reload(); toast(photo === 'avatar' ? 'Profile photo updated' : 'Cover photo updated'); }} />}
      {editing && <EditProfile user={u} onClose={() => setEditing(false)} onSaved={(nu) => { setData((d) => ({ ...d, user: nu })); setUser(nu); toast('Profile updated'); }} />}
    </main>
  );
}
