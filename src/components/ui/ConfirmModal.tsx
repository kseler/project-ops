import { useEffect } from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  danger = false,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <>
      <div
        onClick={onCancel}
        className="fixed inset-0 bg-black/30 z-50"
      />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-xl shadow-xl px-6 py-5 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-sm px-3.5 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`text-sm px-3.5 py-1.5 rounded-md text-white transition-colors ${
              danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
