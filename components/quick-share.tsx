'use client';

import { useState } from 'react';

type QuickShareProps = {
  url: string;
  title: string;
  className?: string;
};

export function QuickShare({ url, title, className }: QuickShareProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function copyToClipboard() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function onShare() {
    try {
      setSharing(true);
      if (navigator.share) {
        await navigator.share({
          title,
          url
        });
        return;
      }
      await copyToClipboard();
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className={className || 'flex items-center gap-2'}>
      <button type="button" className="btn-secondary" onClick={onShare} disabled={sharing}>
        {sharing ? '处理中...' : '快速分享'}
      </button>
      <button type="button" className="btn-secondary" onClick={copyToClipboard}>
        {copied ? '已复制链接' : '复制链接'}
      </button>
    </div>
  );
}
