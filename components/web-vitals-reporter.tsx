'use client';

import { useEffect } from 'react';

type LayoutShift = PerformanceEntry & { value: number; hadRecentInput: boolean };
type LcpEntry = PerformanceEntry & { startTime: number };

export function WebVitalsReporter() {
  useEffect(() => {
    const id = `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const send = (name: string, value: number) => {
      navigator.sendBeacon?.('/api/metrics/web-vitals', JSON.stringify({ id, name, value, ts: Date.now() }));
    };

    let cls = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShift[]) {
        if (!entry.hadRecentInput) cls += entry.value || 0;
      }
      send('CLS', cls);
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries() as LcpEntry[];
      const last = entries[entries.length - 1];
      if (last?.startTime) send('LCP', last.startTime);
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    return () => {
      clsObserver.disconnect();
      lcpObserver.disconnect();
    };
  }, []);

  return null;
}
