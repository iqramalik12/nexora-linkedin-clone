import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import { ComposerModal } from './Composer.jsx';
import MessagingDock from './MessagingDock.jsx';

// App shell for signed-in pages. The composer lives here so the phone "Post" tab can open it anywhere.
export default function Layout() {
  const [composing, setComposing] = useState(null); // null, or { pickPhoto }
  const navigate = useNavigate();
  const location = useLocation();
  const openComposer = (opts = {}) => setComposing(opts);
  return (
    <>
      <Navbar onCompose={() => openComposer()} />
      <Outlet context={{ openComposer }} />
      <MessagingDock />
      {composing && (
        <ComposerModal
          pickPhoto={composing.pickPhoto}
          onClose={() => setComposing(null)}
          onPosted={(post) => {
            window.dispatchEvent(new CustomEvent('nx:posted', { detail: post }));
            if (location.pathname !== '/') navigate('/');
          }}
        />
      )}
    </>
  );
}
