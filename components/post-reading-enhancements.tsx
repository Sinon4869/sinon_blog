'use client';

import { useEffect, useMemo, useState } from 'react';

type TocItem = { id: string; text: string; level: number };

export function PostReadingEnhancements({ containerId = 'post-content' }: { containerId?: string }) {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const root = document.getElementById(containerId);
    if (!root) return;

    const headings = Array.from(root.querySelectorAll('h1, h2, h3')) as HTMLHeadingElement[];
    headings.forEach((h, i) => {
      if (!h.id) h.id = `sec-${i}`;
    });
    setToc(
      headings.map((h) => ({
        id: h.id,
        text: h.textContent?.trim() || '章节',
        level: Number(h.tagName.replace('H', '')) || 2
      }))
    );

    const pres = Array.from(root.querySelectorAll('pre')) as HTMLPreElement[];
    pres.forEach((pre) => {
      if (pre.dataset.enhanced === '1') return;
      pre.dataset.enhanced = '1';
      pre.classList.add('group');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '复制';
      btn.className = 'absolute right-2 top-2 rounded border border-zinc-300 bg-white/90 px-2 py-1 text-xs text-zinc-700';
      pre.style.position = 'relative';
      btn.onclick = async () => {
        const text = pre.innerText || '';
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = '已复制';
          setTimeout(() => (btn.textContent = '复制'), 1200);
        } catch {
          btn.textContent = '失败';
        }
      };
      pre.appendChild(btn);
    });

    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    imgs.forEach((img) => {
      if (img.dataset.lightboxBound === '1') return;
      img.dataset.lightboxBound = '1';
      img.style.cursor = 'zoom-in';
      img.onclick = () => setLightbox({ src: img.currentSrc || img.src, alt: img.alt || '' });
    });
  }, [containerId]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      if (total <= 0) return setProgress(0);
      setProgress(Math.max(0, Math.min(100, Math.round((window.scrollY / total) * 100))));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hasToc = useMemo(() => toc.length >= 2, [toc.length]);

  return (
    <>
      <div className="pointer-events-none fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-zinc-300/50 bg-white/45 px-2 py-1 text-[10px] font-medium tracking-wide text-zinc-500/80 backdrop-blur sm:block">
        {progress}%
      </div>

      {hasToc && (
        <aside className="card mb-4">
          <p className="text-xs tracking-[0.2em] text-zinc-500">目录</p>
          <div className="mt-2 space-y-1">
            {toc.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="block text-sm text-zinc-700 hover:underline" style={{ marginLeft: `${(t.level - 1) * 10}px` }}>
                {t.text}
              </a>
            ))}
          </div>
        </aside>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.src} alt={lightbox.alt} className="max-h-[90vh] max-w-[90vw] object-contain" />
        </div>
      )}
    </>
  );
}
