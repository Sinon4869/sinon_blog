'use client';

import { useRef, useState } from 'react';
import { AppModal } from '@/components/app-modal';

type ConfirmSubmitButtonProps = {
  confirmText: string;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
};

export function ConfirmSubmitButton({ confirmText, className, children, disabled }: ConfirmSubmitButtonProps) {
  const [open, setOpen] = useState(false);
  const pendingButtonRef = useRef<HTMLButtonElement | null>(null);
  const passRef = useRef(false);

  return (
    <>
      <button
        type="submit"
        className={className}
        disabled={disabled}
        onClick={(e) => {
          if (passRef.current) {
            passRef.current = false;
            return;
          }
          e.preventDefault();
          pendingButtonRef.current = e.currentTarget;
          setOpen(true);
        }}
      >
        {children}
      </button>
      <AppModal
        open={open}
        title="二次确认"
        description={confirmText}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          const btn = pendingButtonRef.current;
          setOpen(false);
          if (!btn) return;
          passRef.current = true;
          btn.click();
        }}
        confirmText="确认"
      >
        <p className="text-sm text-zinc-600">请确认是否继续执行该操作。</p>
      </AppModal>
    </>
  );
}
