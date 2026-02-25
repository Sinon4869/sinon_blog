'use client';

import { useEffect, useState } from 'react';

export function AdminNotice({ notice, type }: { notice?: string; type?: 'success' | 'error' }) {
  const [visible, setVisible] = useState(Boolean(notice));

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => setVisible(false), 2600);

    const url = new URL(window.location.href);
    url.searchParams.delete('notice');
    url.searchParams.delete('type');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice || !visible) return null;

  return (
    <div className={`admin-notice sticky top-20 z-30 rounded-xl border px-3 py-2 text-sm ${type === 'error' ? 'border-red-300 bg-red-50 text-red-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
      {notice}
    </div>
  );
}
