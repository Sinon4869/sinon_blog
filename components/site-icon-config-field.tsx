'use client';

import { useRef, useState } from 'react';

type Props = {
  initialUrl?: string;
};

export function SiteIconConfigField({ initialUrl = '' }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) {
      throw new Error(data?.error || '上传失败');
    }
    return String(data.url);
  }

  return (
    <div className="space-y-2">
      <label className="mb-1 block text-sm text-zinc-600">站点图标图片 URL（可选）</label>
      <input className="input" name="siteIconUrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://.../icon.png" />

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploading(true);
          setMsg('上传中...');
          try {
            const nextUrl = await uploadFile(file);
            setUrl(nextUrl);
            setMsg('上传成功，已填入 URL');
          } catch (err) {
            setMsg(err instanceof Error ? err.message : '上传失败');
          } finally {
            setUploading(false);
          }
        }} />
        <button type="button" className="btn-secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? '上传中...' : '上传图片'}
        </button>
        {url && (
          <button type="button" className="btn-secondary" onClick={() => setUrl('')}>
            清空图片
          </button>
        )}
      </div>

      {msg && <p className="text-xs text-zinc-600">{msg}</p>}
      <p className="text-xs text-zinc-500">填写后优先使用图片作为导航 Logo 与 favicon；留空时使用上方字符图标。</p>
    </div>
  );
}
