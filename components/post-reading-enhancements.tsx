'use client';

import { useEffect, useMemo, useState } from 'react';

type TocItem = { id: string; text: string; level: number };

function normalizeAnchorId(input: string) {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5\-_]/g, '');
  return s || 'section';
}

export function PostReadingEnhancements({ containerId = 'post-content' }: { containerId?: string }) {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState('');
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const root = document.getElementById(containerId);
    if (!root) return;

    const headings = Array.from(root.querySelectorAll('h1, h2, h3')) as HTMLHeadingElement[];
    const usedIds = new Set<string>();

    headings.forEach((h, i) => {
      let id = h.id?.trim();
      if (!id) {
        id = normalizeAnchorId(h.textContent || '');
      }
      if (!id) id = `sec-${i}`;

      let uniq = id;
      let n = 2;
      while (usedIds.has(uniq)) {
        uniq = `${id}-${n++}`;
      }
      h.id = uniq;
      usedIds.add(uniq);

      if (h.dataset.anchorBound !== '1') {
        h.dataset.anchorBound = '1';
        h.classList.add('group', 'scroll-mt-24');

        const anchorBtn = document.createElement('button');
        anchorBtn.type = 'button';
        anchorBtn.textContent = '#';
        anchorBtn.className = 'ml-2 align-middle text-zinc-400 opacity-0 transition group-hover:opacity-100';
        anchorBtn.title = '复制本段链接';
        anchorBtn.onclick = async (e) => {
          e.preventDefault();
          const url = `${window.location.origin}${window.location.pathname}#${h.id}`;
          try {
            await navigator.clipboard.writeText(url);
            anchorBtn.textContent = '已复制';
            setTimeout(() => (anchorBtn.textContent = '#'), 1200);
          } catch {
            anchorBtn.textContent = '失败';
            setTimeout(() => (anchorBtn.textContent = '#'), 1200);
          }
        };
        h.appendChild(anchorBtn);
      }
    });

    setToc(
      headings.map((h) => ({
        id: h.id,
        text: (h.textContent || '').replace(/已复制|失败/g, '').trim() || '章节',
        level: Number(h.tagName.replace('H', '')) || 2
      }))
    );

    const pres = Array.from(root.querySelectorAll('pre')) as HTMLPreElement[];
    pres.forEach((pre) => {
      if (pre.dataset.enhanced === '1') return;
      pre.dataset.enhanced = '1';
      pre.classList.add('group');
      pre.style.position = 'relative';

      const code = pre.querySelector('code');
      const className = code?.className || '';
      const lang = (className.match(/language-([a-zA-Z0-9]+)/)?.[1] || 'text').toLowerCase();

      const toolbar = document.createElement('div');
      toolbar.className = 'absolute right-2 top-2 z-10 flex items-center gap-1';

      const langBadge = document.createElement('span');
      langBadge.textContent = lang;
      langBadge.className = 'rounded border border-zinc-300 bg-white/90 px-2 py-1 text-[11px] text-zinc-600';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = '复制';
      copyBtn.className = 'rounded border border-zinc-300 bg-white/90 px-2 py-1 text-xs text-zinc-700';
      copyBtn.onclick = async () => {
        const text = code?.textContent || pre.innerText || '';
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = '已复制';
          setTimeout(() => (copyBtn.textContent = '复制'), 1200);
        } catch {
          copyBtn.textContent = '失败';
        }
      };

      const foldBtn = document.createElement('button');
      foldBtn.type = 'button';
      foldBtn.textContent = '折叠';
      foldBtn.className = 'rounded border border-zinc-300 bg-white/90 px-2 py-1 text-xs text-zinc-700';
      foldBtn.onclick = () => {
        const collapsed = pre.dataset.collapsed === '1';
        pre.dataset.collapsed = collapsed ? '0' : '1';
        pre.style.maxHeight = collapsed ? '' : '220px';
        pre.style.overflow = collapsed ? '' : 'hidden';
        foldBtn.textContent = collapsed ? '折叠' : '展开';
      };

      toolbar.appendChild(langBadge);
      toolbar.appendChild(copyBtn);
      toolbar.appendChild(foldBtn);
      pre.appendChild(toolbar);
    });

    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    imgs.forEach((img) => {
      if (img.dataset.lightboxBound === '1') return;
      img.dataset.lightboxBound = '1';
      img.style.cursor = 'zoom-in';
      img.onclick = () => setLightbox({ src: img.currentSrc || img.src, alt: img.alt || '' });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '0px 0px -65% 0px', threshold: [0.1, 0.5, 1] }
    );

    headings.forEach((h) => observer.observe(h));

    if (window.location.hash) {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = document.getElementById(id);
      if (target) {
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
      }
    }

    return () => observer.disconnect();
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
      {hasToc && (
        <aside className="card mb-4">
          <p className="text-[11px] tracking-[0.16em] text-zinc-500">阅读进度 · {progress}%</p>
          <p className="mt-2 text-xs tracking-[0.2em] text-zinc-500">目录</p>
          <div className="mt-2 space-y-1">
            {toc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className={`block text-sm hover:underline ${activeId === t.id ? 'font-semibold text-zinc-900' : 'text-zinc-700'}`}
                style={{ marginLeft: `${(t.level - 1) * 10}px` }}
              >
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
