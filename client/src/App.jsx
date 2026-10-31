import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import Feed from './pages/Feed.jsx';
import Profile from './pages/Profile.jsx';
import Network from './pages/Network.jsx';
import Messaging from './pages/Messaging.jsx';
import { NotFound, Search, Settings } from './pages/Misc.jsx';
import Jobs from './pages/Jobs.jsx';
import Notifications from './pages/Notifications.jsx';
import { PostPage, Saved } from './pages/PostPage.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="auth"><span className="brand" aria-label="Loading Nexora">N</span></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Feed />} />
        <Route path="in/:id" element={<Profile />} />
        <Route path="mynetwork" element={<Network />} />
        <Route path="messaging" element={<Messaging />} />
        <Route path="messaging/:userId" element={<Messaging />} />
        <Route path="search" element={<Search />} />
        <Route path="settings" element={<Settings />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="posts/:id" element={<PostPage />} />
        <Route path="saved" element={<Saved />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
