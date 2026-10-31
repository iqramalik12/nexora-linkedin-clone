import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import PostCard from '../components/PostCard.jsx';
import ProfileCard from '../components/ProfileCard.jsx';
import { Suggestions } from '../components/RightRail.jsx';
import { PostSkeleton } from './Feed.jsx';

// One post with its comments open: where notifications and "Copy link" lead.
export function PostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setPost(null); setError('');
    api.get(`/posts/${id}`).then((d) => setPost(d.post)).catch((e) => setError(e.message));
  }, [id]);
  return (
    <main className="page">
      <aside className="col sticky hide-phone"><ProfileCard /></aside>
      <section className="col" aria-label="Post">
        <h1 className="sr-only">Post</h1>
        {error && <div className="card empty" role="alert"><Icon name="article" /><h3>Post not available</h3><p>{error}</p><Link className="btn btn-secondary" to="/">Back to feed</Link></div>}
        {!post && !error && <PostSkeleton />}
        {post && <PostCard post={post} startWithComments onChange={setPost} onDelete={() => navigate('/')} />}
      </section>
      <aside className="col sticky hide-tablet"><Suggestions /></aside>
    </main>
  );
}

export function Saved() {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  const load = () => { setError(''); api.get('/posts/saved').then((d) => setPosts(d.posts)).catch((e) => { setError(e.message); setPosts([]); }); };
  useEffect(load, []);
  return (
    <main className="page">
      <aside className="col sticky hide-phone"><ProfileCard /></aside>
      <section className="col" aria-labelledby="saved-h">
        <div className="card card-pad"><h1 className="section-title" id="saved-h" style={{ margin: 0 }}>Saved posts</h1><p className="muted" style={{ margin: '4px 0 0' }}>Only you can see what you save.</p></div>
        {error && <div className="card empty" role="alert"><h3>We could not load your saved posts</h3><p>{error}</p><button className="btn btn-secondary" type="button" onClick={load}>Try again</button></div>}
        {posts === null && <PostSkeleton />}
        {posts?.length === 0 && !error && <div className="card empty"><Icon name="bookmark" /><h3>Nothing saved yet</h3><p>Use the ··· menu on any post and choose Save to keep it here.</p></div>}
        {posts?.map((p) => (
          <PostCard key={p.id} post={p}
            onChange={(np) => setPosts((ps) => (np.savedByMe ? ps.map((x) => (x.id === np.id ? np : x)) : ps.filter((x) => x.id !== np.id)))}
            onDelete={(pid) => setPosts((ps) => ps.filter((x) => x.id !== pid))} />
        ))}
      </section>
      <aside className="col sticky hide-tablet"><Suggestions /></aside>
    </main>
  );
}
