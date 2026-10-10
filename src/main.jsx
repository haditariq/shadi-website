import React, { Component, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import GuestPortal from './GuestPortal';
const Admin = lazy(() => import('./Admin'));
const PhotoUpload = lazy(() => import('./PhotoUpload'));
// A page that fails to load (weak signal at the venue) must not stay blank.
class LoadGuard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="site guest-bg load-failed">
        <p>This page could not be loaded. Please check your connection.</p>
        <button className="primary" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  }
}
function App() {
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const onHash = () => setRoute(location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <LoadGuard>
      <Suspense fallback={<p className="footer-note">Loading…</p>}>
        {route.startsWith('#admin') ? (
          <Admin />
        ) : route.startsWith('#photos') ? (
          <PhotoUpload />
        ) : (
          <GuestPortal />
        )}
      </Suspense>
    </LoadGuard>
  );
}
createRoot(document.getElementById('root')).render(<App />);
