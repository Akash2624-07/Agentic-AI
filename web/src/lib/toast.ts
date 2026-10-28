import { useSyncExternalStore } from 'react';

export type ToastKind = 'ok' | 'info' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function toast(kind: ToastKind, title: string, body?: string, duration = kind === 'error' ? 9000 : 4000) {
  const id = nextId++;
  // At most three on screen.
  toasts = [...toasts.slice(-2), { id, kind, title, body }];
  emit();
  window.setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useToasts = () => useSyncExternalStore(subscribe, () => toasts);
