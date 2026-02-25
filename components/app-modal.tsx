'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type AppModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
};

export function AppModal({
  open,
  title,
  description,
  children,
  onCancel,
  onConfirm,
  confirmText = '确认',
  cancelText = '取消',
  confirmDisabled = false
}: AppModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKeydown);
    };
  }, [open, onCancel]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      <button className="absolute inset-0 h-full w-full bg-zinc-900/45 backdrop-blur-[2px]" onClick={onCancel} type="button" aria-label="关闭弹窗" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-xl rounded-2xl border border-zinc-300 bg-[rgba(245,244,240,0.98)] p-5 shadow-xl shadow-zinc-900/20 sm:p-6">
          <h3 className="text-xl font-semibold text-zinc-800">{title}</h3>
          {description && <p className="mt-1 text-sm text-zinc-600">{description}</p>}
          <div className="mt-4">{children}</div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="rounded-md border border-[var(--line-strong)] bg-white px-4 py-2 text-sm text-zinc-700 active:scale-[0.98]" onClick={onCancel} type="button">
              {cancelText}
            </button>
            {onConfirm && (
              <button className="btn" disabled={confirmDisabled} onClick={onConfirm} type="button">
                {confirmText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
