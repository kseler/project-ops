type ToastListener = (message: string) => void;

let listener: ToastListener | null = null;

export function addToast(message: string) {
  listener?.(message);
}

export function _setToastListener(fn: ToastListener | null) {
  listener = fn;
}
