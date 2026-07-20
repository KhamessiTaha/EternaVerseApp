// src/components/ui/ToastProvider.jsx
//
// App-wide notifications, replacing browser alert()s. Mount once at the app
// root; any component can then call:
//   const toast = useToast();
//   toast("Universe deleted", "success");
// Toasts stack bottom-right, auto-dismiss, and dismiss on click.
import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

export const useToast = () => useContext(ToastContext);

const VARIANT_STYLE = {
  success: { border: 'border-good/50', dot: 'bg-good' },
  error: { border: 'border-critical/50', dot: 'bg-critical' },
  info: { border: 'border-line-bright', dot: 'bg-accent' },
};

const MAX_VISIBLE = 4;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, variant = 'info', duration = 4000) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, variant }]);
    if (duration) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => {
          const style = VARIANT_STYLE[t.variant] || VARIANT_STYLE.info;
          return (
            <div
              key={t.id}
              onClick={() => dismiss(t.id)}
              className={`pointer-events-auto cursor-pointer bg-void-raised/95 backdrop-blur-sm border ${style.border} px-4 py-3 font-mono text-[12px] text-ink max-w-sm flex items-start gap-2.5`}
              style={{ animation: 'toast-in 0.22s ease-out' }}
            >
              <span className={`w-[6px] h-[6px] rounded-full mt-1 shrink-0 ${style.dot}`} />
              <span className="leading-relaxed">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
