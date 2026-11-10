export type ToastType = 'success' | 'error';

type ToastListener = (message: string, type: ToastType) => void;

let listener: ToastListener | null = null;

export function addToast(message: string, type: ToastType = 'success') {
  listener?.(message, type);
}

export function _setToastListener(fn: ToastListener | null) {
  listener = fn;
}
