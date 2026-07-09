// src/components/ui/ConfirmDialog.jsx
//
// In-app replacement for window.confirm - observatory-styled modal.
// Controlled: render with open + callbacks. ESC and backdrop click cancel.
import { useEffect } from 'react';
import { Button } from './primitives';

export const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-void/85 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className={`w-[90vw] max-w-md bg-void border ${danger ? 'border-critical/50' : 'border-line'} p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`font-sans text-lg font-medium mb-2 ${danger ? 'text-critical' : 'text-ink'}`}>
          {title}
        </h3>
        <p className="font-mono text-[12px] text-ink-dim leading-relaxed mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} className="px-5 py-2">
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} className="px-5 py-2">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
