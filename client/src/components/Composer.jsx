import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { prepareImage, uploadImage } from '../lib/image.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';

const MAX = 3000;

// `pickPhoto` opens the file picker as soon as the modal opens (the "Photo" button).
export function ComposerModal({ onClose, onPosted, pickPhoto = false }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null); // data URL preview
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { if (pickPhoto) fileRef.current?.click(); }, [pickPhoto]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try { setPhoto(await prepareImage(file)); } catch (err) { setError(err.message); }
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const image = photo ? (await uploadImage(photo)).id : undefined;
      const d = await api.post('/posts', { text, image });
      onPosted(d.post);
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      labelledBy="composer-who"
      footer={<>
        <button className="icon-btn" type="button" aria-label="Add a photo" onClick={() => fileRef.current?.click()}><Icon name="image" className="c-photo" /></button>
        <span className="count">{text.length.toLocaleString()} / {MAX.toLocaleString()}</span>
        <button className="btn btn-primary" type="button" disabled={busy || (!text.trim() && !photo)} onClick={submit}>{busy ? 'Posting…' : 'Post'}</button>
      </>}
    >
      <div className="modal-head">
        <Avatar user={user} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b id="composer-who" style={{ fontSize: 18 }}>{user.name}</b>
          <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="globe" size="xs" />Post to everyone</div>
        </div>
        <button className="icon-btn" type="button" data-close onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className="modal-body">
        <label className="sr-only" htmlFor="composer-text">What do you want to share?</label>
        <textarea id="composer-text" className="composer-text" placeholder="What do you want to share?" maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} />
        {photo && (
          <div className="photo-preview">
            <img src={photo} alt="Selected photo" />
            <button className="icon-btn" type="button" aria-label="Remove photo" onClick={() => setPhoto(null)}><Icon name="x" size="sm" /></button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onFile} aria-label="Choose a photo" />
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

export default function Composer({ onOpen }) {
  const { user } = useAuth();
  return (
    <div className="card composer">
      <div className="composer-row">
        <Avatar user={user} />
        <button className="start-post" type="button" onClick={() => onOpen()}>Start a post</button>
      </div>
      <div className="composer-actions">
        <button className="c-action" type="button" onClick={() => onOpen({ pickPhoto: true })}><Icon name="image" className="c-photo" /><span>Photo</span></button>
        <Link className="c-action" to="/jobs?post=1"><Icon name="briefcase" className="c-video" /><span>Post a job</span></Link>
        <button className="c-action" type="button" onClick={() => onOpen()}><Icon name="article" className="c-article" /><span>Write article</span></button>
      </div>
    </div>
  );
}
