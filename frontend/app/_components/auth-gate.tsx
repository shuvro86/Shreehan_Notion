'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [offline, setOffline] = useState(false);
  const isLogin = pathname === '/login';
  useEffect(() => {
    let active = true;
    let checking = false;
    let lastActivity = 0;
    const originalFetch = window.fetch;
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('shreehan-session') : null;
    const signedOut = () => {
      if (!active) return;
      setAuthorized(false);
      if (!isLogin) router.replace('/login');
    };
    const check = async () => {
      if (checking || !active) return;
      checking = true;
      try {
        const response = await originalFetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
        if (!active) return;
        if (response.status === 401) signedOut();
        else if (response.ok) {
          setAuthorized(true);
          setOffline(false);
          if (isLogin) router.replace('/');
        } else setOffline(true);
      } catch { if (active) setOffline(true); }
      finally { checking = false; }
    };
    // Observe all same-origin API requests so a revoked session immediately hides private UI.
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const input = args[0];
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
        if (response.status === 401 && !isLogin) signedOut();
        if (response.ok && ['/api/auth/logout', '/api/auth/logout-all'].includes(url.pathname)) {
          channel?.postMessage('changed');
          signedOut();
        }
        if (response.ok && ['/api/auth/login', '/api/auth/set-password', '/api/auth/change-password', '/api/auth/reset-password'].includes(url.pathname)) channel?.postMessage('changed');
      }
      return response;
    };
    const activity = () => {
      if (isLogin || document.visibilityState !== 'visible' || Date.now() - lastActivity < 60_000) return;
      lastActivity = Date.now();
      void window.fetch('/api/auth/activity', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    };
    const visible = () => { if (document.visibilityState === 'visible') void check(); };
    if (channel) channel.onmessage = () => { window.location.reload(); };
    window.addEventListener('focus', visible);
    window.addEventListener('pageshow', visible);
    document.addEventListener('visibilitychange', visible);
    for (const event of ['pointerdown', 'keydown', 'scroll']) document.addEventListener(event, activity, { passive: true });
    const timer = window.setInterval(visible, 30_000);
    void check();
    return () => {
      active = false;
      window.fetch = originalFetch;
      channel?.close();
      window.clearInterval(timer);
      window.removeEventListener('focus', visible);
      window.removeEventListener('pageshow', visible);
      document.removeEventListener('visibilitychange', visible);
      for (const event of ['pointerdown', 'keydown', 'scroll']) document.removeEventListener(event, activity);
    };
  }, [isLogin, pathname, router]);
  if (isLogin) return <>{children}</>;
  return authorized ? <>{children}</> : <div className="auth-loading" role="status" aria-live="polite">{offline ? 'Connection interrupted. Retrying your session…' : 'Opening your workspace…'}</div>;
}
