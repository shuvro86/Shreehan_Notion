'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const isLogin = pathname === '/login';
  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => { if (!active) return; setAuthorized(response.ok); if (response.ok && isLogin) router.replace('/'); else if (!response.ok && !isLogin) router.replace('/login'); })
      .catch(() => { if (active && !isLogin) router.replace('/login'); });
    return () => { active = false; };
  }, [isLogin, router]);
  if (isLogin) return <>{children}</>;
  return authorized ? <>{children}</> : <div className="auth-loading" role="status" aria-live="polite">Opening your workspace…</div>;
}
