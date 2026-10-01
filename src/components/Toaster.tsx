import { useEffect, useRef, useState } from 'react';

import { _setToastListener } from '../lib/toast';

interface ToastItem {
  id: number;
  message: string;
  exiting: boolean;
}

let nextId = 0;

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>[]>>(new Map());

  const dismiss = (id: number) => {
    timers.current.get(id)?.forEach(clearTimeout);
    timers.current.delete(id);
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  };

  useEffect(() => {
    _setToastListener((message) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, exiting: false }]);

      const t1 = setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      }, 2600);

      const t2 = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timers.current.delete(id);
      }, 3000);

      timers.current.set(id, [t1, t2]);
    });

    return () => _setToastListener(null);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2.5 pl-4 pr-2 py-2.5 bg-slate-900 text-white text-sm rounded-lg shadow-lg
            transition-all duration-300
            ${toast.exiting ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'}`}
        >
          <svg className="text-indigo-400 shrink-0" width={14} height={14} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="ml-1 text-slate-400 hover:text-white transition-colors p-1 rounded"
            aria-label="Dismiss"
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
