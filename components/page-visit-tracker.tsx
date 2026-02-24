'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

function shouldTrack(pathname: string) {
  if (!pathname) return false;
  if (pathname === '/' || pathname === '/search') return true;
  return pathname.startsWith('/posts/');
}

export function PageVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !shouldTrack(pathname)) return;
    fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ path: pathname })
    }).catch(() => {
      // best effort
    });
  }, [pathname]);

  return null;
}
