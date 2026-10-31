import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { fmt, timeAgo } from '../lib/format.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';

function RichText({ text }) {
  return text.split(/(#\w+)/g).map((part, i) => (part.startsWith('#') ? <span key={i} className="hashtag">{part}</span> : part));
}

// Other open lists (feed, profile, saved) listen for these and stay in sync.
const broadcast = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

function useClickAway(open, close) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!ref.current?.contains(e.target)) close(); };
    const esc = (e) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, close]);
  return ref;
}

// The original post inside a repost.
function Embedded({ post }) {
  if (post === null) {
    return <div className="embed embed-gone"><Icon name="info" size="sm" />This post is no longer available.</div>;
  }
  const a = post.author;
  return (
    <Link className="embed" to={`/posts/${post.id}`}>
      <div className="embed-head">
        <Avatar user={a} size={32} />
        <div style={{ minWidth: 0 }}>
          <div className="post-author">{a.name}</div>
          <div className="post-sub">{a.headline} · {timeAgo(post.createdAt)}</div>
        </div>
      </div>
      {post.text && <div className="embed-text"><RichText text={post.text} /></div>}
      {post.imageUrl && <img className="post-img" src={post.imageUrl} alt="" loading="lazy" />}
    </Link>
  );
}

function QuoteModal({ post, onClose, onDone }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const target = post.repostOf || post;
  async function submit() {
    setBusy(true); setError('');
    try { onDone(await api.post(`/posts/${post.id}/repost`, { text })); onClose(); }
    catch (e) { setError(e.message); setBusy(false); }
  }
  return (
    <Modal onClose={onClose} labelledBy="quote-who"
      footer={<button className="btn btn-primary" type="button" disabled={busy || !text.trim()} onClick={submit}>{busy ? 'Posting…' : 'Post'}</button>}>
      <div className="modal-head">
        <Avatar user={user} size={48} />
        <b id="quote-who" style={{ flex: 1 }}>Repost with your thoughts</b>
        <button className="icon-btn" type="button" data-close onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className="modal-body">
        <label className="sr-only" htmlFor="quote-text">Your thoughts</label>
        <textarea id="quote-text" className="composer-text" style={{ minHeight: 100 }} placeholder="Add your thoughts…" maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} />
        <Embedded post={target} />
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

export default function PostCard({ post, onChange, onDelete, onHide, startWithComments = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const [showComments, setShowComments] = useState(startWithComments);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [repostMenu, setRepostMenu] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const textRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useClickAway(menu, () => setMenu(false));
  const repostRef = useClickAway(repostMenu, () => setRepostMenu(false));
  const mine = post.author?.id === user.id;
  const isRepost = post.repostOf !== undefined;
  const plainRepost = isRepost && !post.text;
  const target = post.repostOf || post; // what a repost of this card shares
  const canRepost = target.author?.id !== user.id && post.repostOf !== null;
  const [connecting, setConnecting] = useState(false);

  async function connect() {
    setConnecting(true);
    try {
      const d = await api.post(`/connections/request/${post.author.id}`);
      broadcast('nx:author-status', { id: post.author.id, status: d.relationship.status });
      onChange({ ...post, authorStatus: d.relationship.status });
      toast(d.relationship.status === 'connected' ? `You are now connected with ${post.author.name}` : `Invitation sent to ${post.author.name}`);
    } catch (e) { toast(e.message); }
    setConnecting(false);
  }

  function hide() {
    onHide(post.id);
    toast('Post hidden from your feed');
  }

  useLayoutEffect(() => {
    const el = textRef.current;
    if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight + 2);
  }, [post.text, expanded]);

  const changed = (p) => { onChange(p); broadcast('nx:post-updated', p); };

  async function like() {
    // Optimistic: flip now, reconcile with the server's answer.
    onChange({ ...post, likedByMe: !post.likedByMe, likeCount: post.likeCount + (post.likedByMe ? -1 : 1) });
    try {
      const d = await api.post(`/posts/${post.id}/like`);
      changed(d.post);
    } catch (e) {
      onChange(post);
      toast(e.message);
    }
  }

  async function save() {
    setMenu(false);
    try {
      const d = await api.post(`/posts/${post.id}/save`);
      changed(d.post);
      toast(d.post.savedByMe ? 'Saved. Find it under Saved items.' : 'Removed from saved items');
    } catch (e) { toast(e.message); }
  }

  function reposted(d) {
    broadcast('nx:posted', d.post);
    broadcast('nx:post-updated', d.original);
    if (d.original.id === post.id) onChange(d.original);
    toast('Reposted');
  }

  async function repost() {
    setRepostMenu(false);
    try { reposted(await api.post(`/posts/${post.id}/repost`)); } catch (e) { toast(e.message); }
  }

  async function undoRepost() {
    setRepostMenu(false);
    try {
      const d = await api.del(`/posts/${target.id}/repost`);
      broadcast('nx:post-removed', d.removedId);
      broadcast('nx:post-updated', d.original);
      if (d.original.id === post.id) onChange(d.original);
      if (d.removedId === post.id) onDelete(post.id);
      toast('Repost removed');
    } catch (e) { toast(e.message); }
  }

  async function addComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      const d = await api.post(`/posts/${post.id}/comments`, { text: comment });
      changed(d.post);
      setComment('');
    } catch (err) {
      toast(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(id) {
    try {
      const d = await api.del(`/posts/${post.id}/comments/${id}`);
      changed(d.post);
    } catch (err) { toast(err.message); }
  }

  async function remove() {
    setMenu(false);
    try {
      await api.del(`/posts/${post.id}`);
      onDelete(post.id);
      broadcast('nx:post-removed', post.id);
      toast('Post deleted');
    } catch (err) { toast(err.message); }
  }

  async function copyLink() {
    setMenu(false);
    try { await navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`); toast('Link copied'); }
    catch { toast('Could not copy the link'); }
  }

  function openComments() {
    setShowComments(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const a = post.author;
  const isReposted = post.repostedByMe || (mine && plainRepost);
  return (
    <article className="card post" aria-label={`Post by ${a.name}`}>
      {plainRepost && (
        <div className="repost-line"><Avatar user={a} size={24} /><span><Link to={`/in/${a.id}`}><b>{mine ? 'You' : a.name}</b></Link> reposted this</span></div>
      )}
      <div className="post-head">
        <Link to={`/in/${a.id}`} tabIndex={-1}><Avatar user={a} /></Link>
        <div className="post-meta">
          <div className="post-author"><Link to={`/in/${a.id}`}>{a.name}</Link>{mine && <span className="deg">· You</span>}</div>
          <div className="post-sub">{a.headline}</div>
          <div className="post-sub post-time"><Link to={`/posts/${post.id}`}><time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time></Link> · <Icon name="globe" size="xs" label="Visible to everyone" /></div>
        </div>
        {(post.authorStatus === 'none' || post.authorStatus === 'received') && (
          <button className="connect-link" type="button" disabled={connecting} onClick={connect}><Icon name="plus" size="sm" />{post.authorStatus === 'received' ? 'Accept' : 'Connect'}</button>
        )}
        {post.authorStatus === 'sent' && <span className="pending-link"><Icon name="clock" size="xs" />Pending</span>}
        <div className="post-menu" ref={menuRef}>
          <button className="icon-btn" type="button" aria-label="Post options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Icon name="more" size="sm" /></button>
          {menu && (
            <div className="menu" role="menu">
              <button type="button" role="menuitem" onClick={save}><Icon name="bookmark" size="sm" />{post.savedByMe ? 'Unsave' : 'Save'}</button>
              <button type="button" role="menuitem" onClick={copyLink}><Icon name="link" size="sm" />Copy link to post</button>
              {mine && <button type="button" role="menuitem" onClick={remove}><Icon name="trash" size="sm" />Delete post</button>}
              {onHide && !mine && <button type="button" role="menuitem" onClick={() => { setMenu(false); hide(); }}><Icon name="eyeOff" size="sm" />Not interested</button>}
            </div>
          )}
        </div>
        {onHide && !mine && <button className="icon-btn" type="button" aria-label={`Hide post by ${a.name}`} onClick={hide}><Icon name="x" size="sm" /></button>}
      </div>
      {post.text && (
        <div className="post-body">
          <div ref={textRef} className={`text${expanded ? '' : ' clamp'}`}><RichText text={post.text} /></div>
          {clamped && !expanded && <button className="see-more" type="button" onClick={() => setExpanded(true)}>See more</button>}
        </div>
      )}
      {post.imageUrl && <img className="post-img" src={post.imageUrl} alt="" loading="lazy" style={{ marginTop: 8 }} />}
      {isRepost && <div style={{ padding: '8px 16px 0' }}><Embedded post={post.repostOf} /></div>}
      <div className="reactions">
        <span className="rx">
          {post.likeCount > 0 && <span className="rx-dot" aria-hidden="true"><Icon name="like" /></span>}
          {post.likeCount > 0 && <span>{fmt(post.likeCount)}</span>}
        </span>
        <span className="rx">
          {post.comments.length > 0 && (
            <button className="link-btn" type="button" onClick={() => setShowComments((s) => !s)}>
              {fmt(post.comments.length)} {post.comments.length === 1 ? 'comment' : 'comments'}
            </button>
          )}
          {post.comments.length > 0 && post.repostCount > 0 && <span aria-hidden="true">·</span>}
          {post.repostCount > 0 && <span>{fmt(post.repostCount)} {post.repostCount === 1 ? 'repost' : 'reposts'}</span>}
        </span>
      </div>
      <div className="post-actions">
        <button className="p-action" type="button" aria-pressed={post.likedByMe} onClick={like}><Icon name="like" size="sm" /><span>Like</span></button>
        <button className="p-action" type="button" aria-expanded={showComments} onClick={openComments}><Icon name="comment" size="sm" /><span>Comment</span></button>
        <div className="post-menu repost-wrap" ref={repostRef}>
          <button className="p-action" type="button" aria-haspopup="menu" aria-expanded={repostMenu} aria-pressed={isReposted} disabled={!canRepost && !isReposted}
            title={canRepost || isReposted ? undefined : 'You cannot repost your own post'} onClick={() => setRepostMenu((m) => !m)}>
            <Icon name="repeat" size="sm" /><span>Repost</span>
          </button>
          {repostMenu && (
            <div className="menu menu-up" role="menu">
              {isReposted
                ? <button type="button" role="menuitem" onClick={undoRepost}><Icon name="x" size="sm" />Undo repost</button>
                : <button type="button" role="menuitem" onClick={repost}><Icon name="repeat" size="sm" />Repost</button>}
              {canRepost && <button type="button" role="menuitem" onClick={() => { setRepostMenu(false); setQuoting(true); }}><Icon name="pencil" size="sm" />Repost with your thoughts</button>}
            </div>
          )}
        </div>
        <Link className="p-action" to={mine ? '/messaging' : `/messaging/${a.id}`}><Icon name="send" size="sm" /><span>Send</span></Link>
      </div>
      {showComments && (
        <>
          <form className="comment-box" onSubmit={addComment}>
            <Avatar user={user} size={40} />
            <label className="sr-only" htmlFor={`c-${post.id}`}>Add a comment</label>
            <input id={`c-${post.id}`} ref={inputRef} placeholder="Add a comment…" value={comment} maxLength={1250} onChange={(e) => setComment(e.target.value)} autoComplete="off" />
            <button className="btn btn-primary" type="submit" disabled={busy || !comment.trim()}>Reply</button>
          </form>
          {post.comments.length > 0 && (
            <div className="comment-list">
              {post.comments.map((c) => (
                <div className="comment" key={c.id}>
                  <Link to={`/in/${c.author?.id}`} tabIndex={-1}><Avatar user={c.author} size={32} /></Link>
                  <div className="comment-bubble">
                    <div className="top">
                      <div><b><Link to={`/in/${c.author?.id}`}>{c.author?.name}</Link></b> <span className="small muted">{timeAgo(c.createdAt)}</span></div>
                      {(c.author?.id === user.id || mine) && (
                        <button className="link-btn" type="button" onClick={() => deleteComment(c.id)} aria-label="Delete comment">Delete</button>
                      )}
                    </div>
                    <div className="small muted">{c.author?.headline}</div>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {quoting && <QuoteModal post={post} onClose={() => setQuoting(false)} onDone={reposted} />}
    </article>
  );
}
