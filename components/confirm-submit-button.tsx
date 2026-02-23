'use client';

type ConfirmSubmitButtonProps = {
  confirmText: string;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
};

export function ConfirmSubmitButton({ confirmText, className, children, disabled }: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      disabled={disabled}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
