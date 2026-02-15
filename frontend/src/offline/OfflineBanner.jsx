import { useState, useEffect, useCallback, useRef } from 'react';
import { isOnline, subscribe } from './connectivity';

// ─── Toast ────────────────────────────────────────────────

const TOAST_DURATION = 4000;

function Toast({ message, type, onDone }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300); // wait for exit animation
    }, TOAST_DURATION);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`offline-toast offline-toast-${type} ${visible ? 'offline-toast-visible' : ''}`}
    >
      <span className="offline-toast-icon">{type === 'offline' ? '⚡' : '✓'}</span>
      {message}
    </div>
  );
}

// ─── Web Notification (guarded) ───────────────────────────

function showWebNotification(title, body) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/favicon.ico', tag: 'connectivity' });
  } catch (_) { /* SW-only environments */ }
}

// ─── OfflineBanner ────────────────────────────────────────

export default function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());
  const [toasts, setToasts] = useState([]);
  const prevOnline = useRef(online);
  const toastId = useRef(0);

  const addToast = useCallback((message, type) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsub = subscribe((status) => {
      setOnline(status);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (prevOnline.current === online) return;
    prevOnline.current = online;

    if (!online) {
      addToast('You are offline. Showing cached data.', 'offline');
      showWebNotification('Wildfire Intel', 'You are offline. Data may be stale.');
    } else {
      addToast('Back online. Refreshing data...', 'online');
      showWebNotification('Wildfire Intel', 'Connection restored.');
    }
  }, [online, addToast]);

  return (
    <>
      {/* Fixed banner */}
      {!online && (
        <div className="offline-banner">
          <span className="offline-banner-dot" />
          Offline — showing last known data
        </div>
      )}

      {/* Toast stack */}
      <div className="offline-toast-container">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} onDone={() => removeToast(t.id)} />
        ))}
      </div>
    </>
  );
}
