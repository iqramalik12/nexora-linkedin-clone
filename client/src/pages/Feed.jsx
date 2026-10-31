import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api.js';
import Composer from '../components/Composer.jsx';
import Icon from '../components/Icon.jsx';
import PostCard from '../components/PostCard.jsx';
import { LeftRail } from '../components/ProfileCard.jsx';
import RightRail from '../components/RightRail.jsx';

export function PostSkeleton() {
  return (
    <div className="card sk-post" aria-hidden="true">
      <div style={{ display: 'flex', gap: 8 }}><div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} /><div style={{ flex: 1, display: 'grid', gap: 6 }}><div className="skeleton" style={{ height: 12, width: '40%' }} /><div className="skeleton" style={{ height: 10, width: '60%' }} /></div></div>
      <div className="skeleton" style={{ height: 12 }} /><div className="skeleton" style={{ height: 12, width: '85%' }} />
    </div>
  );
}

export function usePosts(query = '') {
  const [posts, setPosts] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (before) => {
    setError('');
    try {
      const qs = new URLSearchParams(query);
      if (before) qs.set('before', before);
      const d = await api.get(`/posts?${qs}`);
      setPosts((p) => (before ? [...(p || []), ...d.posts] : d.posts));
      setCursor(d.nextCursor);
    } catch (e) { setError(e.message); setPosts((p) => p || []); }
  }, [query]);

  useEffect(() => { setPosts(null); load(); }, [load]);
  // Keep this list in step with changes made from another card (reposts, likes on the original).
  useEffect(() => {
    const onUpdated = (e) => setPosts((ps) => ps && ps.map((p) => (p.id === e.detail.id ? e.detail : p)));
    const onRemoved = (e) => setPosts((ps) => ps && ps.filter((p) => p.id !== e.detail));
    const onAuthor = (e) => setPosts((ps) => ps && ps.map((p) => (p.author.id === e.detail.id ? { ...p, authorStatus: e.detail.status } : p)));
    window.addEventListener('nx:post-updated', onUpdated);
    window.addEventListener('nx:post-removed', onRemoved);
    window.addEventListener('nx:author-status', onAuthor);
    return () => {
      window.removeEventListener('nx:post-updated', onUpdated);
      window.removeEventListener('nx:post-removed', onRemoved);
      window.removeEventListener('nx:author-status', onAuthor);
    };
  }, []);

  const more = async () => { setLoadingMore(true); await load(cursor); setLoadingMore(false); };
  const update = (post) => setPosts((ps) => ps.map((p) => (p.id === post.id ? post : p)));
  const remove = (id) => setPosts((ps) => ps.filter((p) => p.id !== id));
  const prepend = (post) => setPosts((ps) => [post, ...(ps || []).filter((p) => p.id !== post.id)]);
  return { posts, cursor, error, loadingMore, more, update, remove, prepend, reload: () => load() };
}

// `hideable`: show the ✕ that hides a post from this list (home feed only).
export function PostList({ feed, emptyTitle, emptyText, hideable = false }) {
  const { posts, cursor, error, loadingMore, more, update, remove, reload } = feed;
  if (posts === null) return <><PostSkeleton /><PostSkeleton /></>;
  return (
    <>
      {error && (
        <div className="card empty" role="alert"><h3>We could not load posts</h3><p>{error}</p><button className="btn btn-secondary" type="button" onClick={reload}>Try again</button></div>
      )}
      {!error && posts.length === 0 && (
        <div className="card empty"><Icon name="article" /><h3>{emptyTitle}</h3><p>{emptyText}</p></div>
      )}
      {posts.map((p) => <PostCard key={p.id} post={p} onChange={update} onDelete={remove} onHide={hideable ? remove : undefined} />)}
      {cursor && <button className="btn btn-secondary" type="button" style={{ alignSelf: 'center' }} disabled={loadingMore} onClick={more}>{loadingMore ? 'Loading…' : 'Show more posts'}</button>}
    </>
  );
}

const SORTS = [['top', 'Top'], ['recent', 'Recent']];

function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="sort" ref={ref}>
      <button type="button" className="sort-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Sort by: <b>{SORTS.find(([k]) => k === value)[1]}</b> <Icon name="down" size="xs" />
      </button>
      {open && (
        <div className="menu sort-menu" role="menu">
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" role="menuitemradio" aria-checked={value === k} onClick={() => { onChange(k); setOpen(false); }}>
              {label}{value === k && <Icon name="check" size="sm" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Feed() {
  const { openComposer } = useOutletContext();
  const [sort, setSort] = useState(() => { try { return localStorage.getItem('nx:sort') === 'recent' ? 'recent' : 'top'; } catch { return 'top'; } });
  const changeSort = (s) => { setSort(s); try { localStorage.setItem('nx:sort', s); } catch { /* per-browser preference only */ } };
  const feed = usePosts(sort === 'top' ? 'sort=top' : '');
  const { prepend } = feed;
  useEffect(() => {
    const onPosted = (e) => prepend(e.detail);
    window.addEventListener('nx:posted', onPosted);
    return () => window.removeEventListener('nx:posted', onPosted);
  }, [prepend]);

  return (
    <main className="page">
      <LeftRail />
      <section className="col" aria-label="Feed">
        <h1 className="sr-only">Home feed</h1>
        <Composer onOpen={openComposer} />
        <SortMenu value={sort} onChange={changeSort} />
        <PostList feed={feed} hideable emptyTitle="Your feed is quiet" emptyText="Share your first post or connect with people to see their updates here." />
      </section>
      <RightRail />
    </main>
  );
}
