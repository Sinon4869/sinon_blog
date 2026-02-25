'use client';

import { useEffect, useState } from 'react';

export function AdminNotice({ notice, type }: { notice?: string; type?: 'success' | 'error' }) {
  const [visible, setVisible] = useState(Boolean(notice));

  useEffect(() => {
    if (!notice) return;

    document.body.classList.remove('modal-open');
    const timer = setTimeout(() => setVisible(false), 4200);

    const url = new URL(window.location.href);
    url.searchParams.delete('notice');
    url.searchParams.delete('type');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice || !visible) return null;

  return (
    <div className={`admin-notice fixed left-1/2 top-20 z-[130] w-[min(920px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border px-3 py-2 text-sm shadow-lg ${type === 'error' ? 'border-red-300 bg-red-50 text-red-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
      {notice}
    </div>
  );
}
