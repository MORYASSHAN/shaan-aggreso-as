import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const show = useCallback((message, tone = 'ok') => {
    const id = (nextId.current += 1);
    setToasts((all) => [...all, { id, message, tone }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="card fade-in pointer-events-auto flex max-w-md items-center gap-2.5 px-4 py-2.5 text-sm shadow-[0_12px_40px_rgb(0_0_0/0.6)]"
          >
            <span className={`size-1.5 shrink-0 rounded-full ${t.tone === 'ok' ? 'bg-ok' : 'bg-danger'}`} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
